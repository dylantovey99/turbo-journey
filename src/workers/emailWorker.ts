import { connectDatabase } from '@/models/database';
import { connectRedis, EmailQueue } from '@/services/queue';
import { logger } from '@/utils/logger';
import { setupGlobalErrorHandlers } from '@/utils/errorHandler';

class EmailWorker {
  private emailQueue: EmailQueue;
  private isShuttingDown: boolean = false;

  constructor() {
    this.emailQueue = EmailQueue.getInstance();
  }

  async start(): Promise<void> {
    try {
      // Setup global error handlers
      setupGlobalErrorHandlers();

      // Connect to database and Redis
      await connectDatabase();
      logger.info('Email Worker: Database connected');

      await connectRedis();
      logger.info('Email Worker: Redis connected');

      logger.info('🔄 Email Worker started and listening for jobs');

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

      // Keep the worker alive
      this.keepAlive();

    } catch (error) {
      logger.error('Failed to start Email Worker:', error);
      process.exit(1);
    }
  }

  private keepAlive(): void {
    setInterval(() => {
      if (!this.isShuttingDown) {
        logger.debug('Email Worker: Health check - worker is alive');
      }
    }, 30000); // 30 seconds
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info(`Email Worker: Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop processing new jobs
      await this.emailQueue.close();
      logger.info('Email Worker: Queue closed');

      // Close database connections
      const { disconnectDatabase } = await import('@/models/database');
      await disconnectDatabase();
      logger.info('Email Worker: Database disconnected');

      // Close Redis connections
      const { disconnectRedis } = await import('@/services/queue/redis');
      await disconnectRedis();
      logger.info('Email Worker: Redis disconnected');

      logger.info('Email Worker: Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Email Worker: Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new EmailWorker();
  worker.start().catch((error) => {
    logger.error('Email Worker startup failed:', error);
    process.exit(1);
  });
}

export default EmailWorker;