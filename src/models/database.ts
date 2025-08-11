import mongoose from 'mongoose';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.database.mongoUri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
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