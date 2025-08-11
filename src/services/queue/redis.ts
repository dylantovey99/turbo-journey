import { createClient, RedisClientType } from 'redis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({ 
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.error('Redis max reconnection attempts reached');
            return false;
          }
          return Math.min(retries * 50, 1000);
        }
      }
    });
    this.setupEventHandlers();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.debug('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('end', () => {
      logger.info('Redis client connection ended');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.debug('Redis client reconnecting');
    });
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
        logger.info('Redis connected successfully');
      } catch (error) {
        logger.warn('Failed to connect to Redis, continuing without queue functionality:', error);
        // Don't throw error - allow server to start without Redis
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.disconnect();
        logger.info('Redis disconnected successfully');
      } catch (error) {
        logger.error('Failed to disconnect from Redis:', error);
        throw error;
      }
    }
  }

  public getClient(): RedisClientType {
    return this.client;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }
}

export async function connectRedis(): Promise<void> {
  const redis = RedisConnection.getInstance();
  
  // Add timeout to prevent hanging
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
  );
  
  try {
    await Promise.race([redis.connect(), timeout]);
  } catch (error) {
    logger.warn('Redis connection failed or timed out, continuing without queue functionality:', error);
    // Continue without Redis - don't throw
  }
}

export async function disconnectRedis(): Promise<void> {
  const redis = RedisConnection.getInstance();
  await redis.disconnect();
}

export function getRedisClient(): RedisClientType {
  const redis = RedisConnection.getInstance();
  return redis.getClient();
}