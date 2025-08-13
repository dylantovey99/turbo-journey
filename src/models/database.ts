import mongoose, { ConnectOptions } from 'mongoose';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export async function connectDatabase(retryAttempt: number = 0): Promise<void> {
  const maxRetries = config.server.isCloudDeployment ? 10 : 3;
  const baseDelay = 1000;
  
  try {
    const options: ConnectOptions = {
      connectTimeoutMS: config.database.connectTimeoutMS,
      serverSelectionTimeoutMS: config.database.serverSelectionTimeoutMS,
      maxPoolSize: config.database.maxPoolSize,
      retryWrites: config.database.retryWrites,
      w: config.database.writeConcern,
      // Stricter connection handling for cloud deployments
      bufferCommands: false,
      bufferMaxEntries: 0,
      // Additional cloud-specific options
      heartbeatFrequencyMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip IPv6
    };

    await mongoose.connect(config.database.mongoUri, options);
    logger.info('MongoDB connected successfully', {
      host: config.database.mongoUri.split('@')[1]?.split('/')[0] || 'localhost',
      isCloudDeployment: config.server.isCloudDeployment,
      retryAttempt
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