import mongoose, { ConnectOptions } from 'mongoose';
import { config } from '@/config';
import { logger } from '@/utils/logger';

// Validate database configuration
function validateDatabaseConfig(): void {
  if (config.database.connectTimeoutMS < 5000) {
    logger.warn('Database connect timeout may be too low for cloud deployments', {
      currentTimeout: config.database.connectTimeoutMS,
      recommendedMinimum: 5000
    });
  }
  
  if (config.database.maxPoolSize > 20) {
    logger.warn('Database pool size may be too large for serverless environments', {
      currentPoolSize: config.database.maxPoolSize,
      recommendedMaximum: 20
    });
  }
  
  if (config.database.serverSelectionTimeoutMS < 5000) {
    logger.warn('Server selection timeout may be too low for cloud deployments', {
      currentTimeout: config.database.serverSelectionTimeoutMS,
      recommendedMinimum: 5000
    });
  }
}

// Verify database connection health
async function verifyConnectionHealth(): Promise<void> {
  try {
    await mongoose.connection.db.admin().ping();
    logger.info('Database connection verified successfully');
  } catch (error) {
    logger.error('Database connection verification failed:', error);
    throw new Error('Database connection unhealthy after successful connection');
  }
}

export async function connectDatabase(retryAttempt: number = 0): Promise<void> {
  const maxRetries = config.server.isCloudDeployment ? 10 : 3;
  const baseDelay = 1000;
  
  // Validate configuration on first attempt
  if (retryAttempt === 0) {
    validateDatabaseConfig();
  }
  
  try {
    const options: ConnectOptions = {
      connectTimeoutMS: config.database.connectTimeoutMS,
      serverSelectionTimeoutMS: config.database.serverSelectionTimeoutMS,
      maxPoolSize: config.database.maxPoolSize,
      retryWrites: config.database.retryWrites,
      w: config.database.writeConcern,
      
      // Stricter connection handling for cloud deployments
      bufferCommands: false,
      maxConnecting: 2, // Limit concurrent connection attempts
      minPoolSize: Math.min(2, config.database.maxPoolSize), // Ensure minimum connections
      autoIndex: !config.server.isProduction, // Disable in production for performance
      maxIdleTimeMS: 30000, // Close idle connections after 30 seconds
      
      // Additional cloud-specific options
      heartbeatFrequencyMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip IPv6
    };

    await mongoose.connect(config.database.mongoUri, options);
    
    // Verify connection health
    await verifyConnectionHealth();
    
    logger.info('MongoDB connected successfully', {
      host: config.database.mongoUri.split('@')[1]?.split('/')[0] || 'localhost',
      isCloudDeployment: config.server.isCloudDeployment,
      retryAttempt,
      connectionOptions: {
        maxPoolSize: config.database.maxPoolSize,
        minPoolSize: Math.min(2, config.database.maxPoolSize),
        maxConnecting: 2,
        autoIndex: !config.server.isProduction
      }
    });
  } catch (error) {
    logger.error(`MongoDB connection failed (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, error);
    
    if (retryAttempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, retryAttempt); // Exponential backoff
      logger.info(`Retrying MongoDB connection in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDatabase(retryAttempt + 1);
    }
    
    logger.error('MongoDB connection failed after all retries. This is a critical error.');
    throw new Error(`Failed to connect to MongoDB after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('MongoDB disconnection failed:', error);
    throw error;
  }
}

mongoose.connection.on('error', (error) => {
  logger.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

export default mongoose;