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
        connectTimeout: config.redis.connectTimeout,
        reconnectStrategy: (retries) => {
          if (retries > config.redis.maxRetriesPerRequest) {
            logger.error('Redis max reconnection attempts reached');
            return false;
          }
          return Math.min(retries * config.redis.retryDelayOnFailover, 5000);
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

  public async connect(retryAttempt: number = 0): Promise<void> {
    if (this.isConnected) {
      return;
    }
    
    const maxRetries = config.server.isCloudDeployment ? 10 : 3;
    const baseDelay = 1000;
    
    try {
      await this.client.connect();
      logger.info('Redis connected successfully', {
        isCloudDeployment: config.server.isCloudDeployment,
        retryAttempt
      });
    } catch (error) {
      logger.error(`Redis connection failed (attempt ${retryAttempt + 1}/${maxRetries + 1}):`, error);
      
      if (retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt); // Exponential backoff
        logger.info(`Retrying Redis connection in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect(retryAttempt + 1);
      }
      
      logger.error('Redis connection failed after all retries. Queue functionality will be unavailable.');
      throw new Error(`Failed to connect to Redis after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  
  // Increased timeout for cloud environments
  const connectionTimeout = config.server.isCloudDeployment ? 15000 : 10000;
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Redis connection timeout')), connectionTimeout)
  );
  
  try {
    await Promise.race([redis.connect(), timeout]);
  } catch (error) {
    logger.error('Critical: Redis connection failed completely:', error);
    throw error; // Don't continue without Redis - this is a deployment issue that needs to be fixed
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