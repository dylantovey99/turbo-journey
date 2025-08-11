import { connectDatabase } from '@/models/database';
import { connectRedis } from '@/services/queue';
import { ScrapingService } from '@/services/scraper';
import { ProspectModel } from '@/models';
import { ProspectStatus } from '@/types';
import { logger } from '@/utils/logger';
import { setupGlobalErrorHandlers } from '@/utils/errorHandler';

class ScrapingWorker {
  private scrapingService: ScrapingService;
  private isShuttingDown: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.scrapingService = new ScrapingService();
  }

  async start(): Promise<void> {
    try {
      // Setup global error handlers
      setupGlobalErrorHandlers();

      // Connect to database and Redis
      await connectDatabase();
      logger.info('Scraping Worker: Database connected');

      await connectRedis();
      logger.info('Scraping Worker: Redis connected');

      // Initialize scraping service
      await this.scrapingService.initialize();
      logger.info('Scraping Worker: Scraping service initialized');

      // Start processing pending prospects
      this.startProcessing();

      logger.info('🕷️ Scraping Worker started and processing prospects');

      // Graceful shutdown handling
      process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

      // Keep the worker alive
      this.keepAlive();

    } catch (error) {
      logger.error('Failed to start Scraping Worker:', error);
      process.exit(1);
    }
  }

  private startProcessing(): void {
    const processProspects = async () => {
      if (this.isShuttingDown) return;

      try {
        // Get pending prospects
        const pendingProspects = await this.scrapingService.getPendingProspects(10);
        
        if (pendingProspects.length > 0) {
          logger.info(`Scraping Worker: Processing ${pendingProspects.length} pending prospects`);
          
          // Process in smaller batches to avoid overwhelming
          for (const prospectId of pendingProspects) {
            if (this.isShuttingDown) break;
            
            try {
              await this.scrapingService.scrapeProspect(prospectId);
              logger.info(`Scraping Worker: Successfully processed prospect ${prospectId}`);
              
              // Small delay between prospects
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
              logger.error(`Scraping Worker: Failed to process prospect ${prospectId}:`, error);
            }
          }
        } else {
          logger.debug('Scraping Worker: No pending prospects found');
        }

        // Check for retryable failed prospects every few cycles
        if (Math.random() < 0.3) { // 30% chance to check for retries
          const retryableProspects = await this.scrapingService.getRetryableFailedProspects(5);
          
          if (retryableProspects.length > 0) {
            logger.info(`Scraping Worker: Found ${retryableProspects.length} retryable failed prospects`);
            
            const retryResult = await this.scrapingService.retryFailedProspects(5);
            
            logger.info(`Scraping Worker: Retry attempt completed`, {
              attempted: retryResult.attempted,
              successful: retryResult.successful,
              failed: retryResult.failed
            });
          }
        }
      } catch (error) {
        logger.error('Scraping Worker: Error during processing cycle:', error);
      }
    };

    // Process every 30 seconds
    this.processingInterval = setInterval(processProspects, 30000);
    
    // Run immediately
    processProspects();
  }

  private keepAlive(): void {
    setInterval(() => {
      if (!this.isShuttingDown) {
        logger.debug('Scraping Worker: Health check - worker is alive');
      }
    }, 60000); // 60 seconds
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info(`Scraping Worker: Received ${signal}, starting graceful shutdown...`);

    try {
      // Stop processing interval
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = null;
      }

      // Close scraping service (browser cleanup)
      await this.scrapingService.close();
      logger.info('Scraping Worker: Scraping service closed');

      // Close database connections
      const { disconnectDatabase } = await import('@/models/database');
      await disconnectDatabase();
      logger.info('Scraping Worker: Database disconnected');

      // Close Redis connections
      const { disconnectRedis } = await import('@/services/queue/redis');
      await disconnectRedis();
      logger.info('Scraping Worker: Redis disconnected');

      logger.info('Scraping Worker: Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Scraping Worker: Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new ScrapingWorker();
  worker.start().catch((error) => {
    logger.error('Scraping Worker startup failed:', error);
    process.exit(1);
  });
}

export default ScrapingWorker;