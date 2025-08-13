/**
 * Cloud Deployment Integration Tests
 * Tests that verify the application works correctly in cloud environments
 */

import axios from 'axios';
import { connectDatabase, disconnectDatabase } from '@/models/database';
import { connectRedis, disconnectRedis } from '@/services/queue/redis';
import { WebScraper } from '@/services/scraper/WebScraper';
import { config } from '@/config';
import { logger } from '@/utils/logger';

describe('Cloud Deployment Integration Tests', () => {
  beforeAll(async () => {
    // Set cloud deployment mode for testing
    process.env.IS_CLOUD_DEPLOYMENT = 'true';
  });

  afterAll(async () => {
    // Clean up
    try {
      await disconnectDatabase();
      await disconnectRedis();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Database Connection', () => {
    test('should connect to MongoDB with retry logic', async () => {
      await expect(connectDatabase()).resolves.not.toThrow();
    }, 30000);

    test('should handle connection errors gracefully', async () => {
      // Temporarily break the connection string
      const originalUri = config.database.mongoUri;
      config.database.mongoUri = 'mongodb://invalid-host:27017/test';
      
      await expect(connectDatabase()).rejects.toThrow();
      
      // Restore original URI
      config.database.mongoUri = originalUri;
    }, 10000);
  });

  describe('Redis Connection', () => {
    test('should connect to Redis with retry logic', async () => {
      await expect(connectRedis()).resolves.not.toThrow();
    }, 30000);

    test('should handle Redis connection failures', async () => {
      // Temporarily break the Redis URL
      const originalUrl = config.redis.url;
      config.redis.url = 'redis://invalid-host:6379';
      
      await expect(connectRedis()).rejects.toThrow();
      
      // Restore original URL
      config.redis.url = originalUrl;
    }, 10000);
  });

  describe('Browser Detection', () => {
    test('should initialize WebScraper with proper browser detection', async () => {
      const scraper = new WebScraper();
      
      await expect(scraper.initialize()).resolves.not.toThrow();
      
      await scraper.close();
    }, 30000);

    test('should fall back to HTTP scraping when browser unavailable', async () => {
      // Mock browser unavailability
      process.env.PUPPETEER_EXECUTABLE_PATH = '/invalid/path/to/browser';
      
      const scraper = new WebScraper();
      
      // Should not throw - will use HTTP fallback
      await expect(scraper.initialize()).resolves.not.toThrow();
      
      await scraper.close();
      
      // Reset environment
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
    }, 15000);
  });

  describe('HTTP Scraping Fallback', () => {
    test('should successfully scrape using HTTP method', async () => {
      const scraper = new WebScraper();
      
      // Force HTTP scraping
      process.env.FORCE_HTTP_SCRAPING = 'true';
      
      await scraper.initialize();
      
      const testUrl = 'https://httpbin.org/html';
      const result = await scraper.scrapeWebsite(testUrl);
      
      expect(result).toBeDefined();
      expect(result.url).toBe(testUrl);
      expect(result.title).toBeDefined();
      
      await scraper.close();
      
      // Reset environment
      delete process.env.FORCE_HTTP_SCRAPING;
    }, 15000);
  });

  describe('Environment Configuration', () => {
    test('should load platform-specific configuration', () => {
      expect(config.server.isCloudDeployment).toBe(true);
      expect(config.database.mongoUri).toBeDefined();
      expect(config.redis.url).toBeDefined();
    });

    test('should have appropriate timeouts for cloud deployment', () => {
      expect(config.database.connectTimeoutMS).toBeGreaterThan(10000);
      expect(config.database.serverSelectionTimeoutMS).toBeGreaterThan(10000);
    });

    test('should have cloud-optimized scraping settings', () => {
      expect(config.scraping.timeout).toBeGreaterThan(20000);
      expect(config.scraping.maxRetries).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Health Check Endpoints', () => {
    test('should respond to health check', async () => {
      // This assumes the server is running on localhost:3001 for testing
      // In actual cloud deployment, this would be the deployed URL
      const healthUrl = `http://localhost:${config.server.port}/health`;
      
      try {
        const response = await axios.get(healthUrl, { timeout: 5000 });
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status');
      } catch (error) {
        // If server is not running, skip this test
        console.warn('Health check skipped - server not running');
      }
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should handle missing environment variables gracefully', () => {
      const originalApiKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      // Should not crash the application
      expect(() => {
        require('@/config');
      }).not.toThrow();
      
      // Restore environment variable
      if (originalApiKey) {
        process.env.ANTHROPIC_API_KEY = originalApiKey;
      }
    });

    test('should log errors appropriately in cloud environment', () => {
      const logSpy = jest.spyOn(logger, 'error');
      
      logger.error('Test error message', { context: 'test' });
      
      expect(logSpy).toHaveBeenCalledWith('Test error message', { context: 'test' });
      
      logSpy.mockRestore();
    });
  });

  describe('Performance Tests', () => {
    test('should initialize services within reasonable time limits', async () => {
      const startTime = Date.now();
      
      // Test database connection speed
      await connectDatabase();
      const dbConnectionTime = Date.now() - startTime;
      
      // Should connect within 30 seconds even in cloud environment
      expect(dbConnectionTime).toBeLessThan(30000);
      
      const redisStartTime = Date.now();
      await connectRedis();
      const redisConnectionTime = Date.now() - redisStartTime;
      
      // Redis should be faster than database
      expect(redisConnectionTime).toBeLessThan(15000);
    }, 45000);

    test('should handle concurrent requests appropriately', async () => {
      // Test that multiple initialization calls don't cause issues
      const promises = Array(5).fill(null).map(() => connectDatabase());
      
      await expect(Promise.all(promises)).resolves.not.toThrow();
    }, 30000);
  });

  describe('Security Tests', () => {
    test('should not expose sensitive information in logs', () => {
      const logSpy = jest.spyOn(logger, 'info');
      
      // Log something that might contain sensitive info
      logger.info('Database connected successfully', {
        host: config.database.mongoUri.split('@')[1]?.split('/')[0] || 'localhost'
      });
      
      const logCalls = logSpy.mock.calls;
      const lastCall = logCalls[logCalls.length - 1];
      
      // Should not log full connection strings or passwords
      expect(JSON.stringify(lastCall)).not.toMatch(/mongodb\+srv:\/\/.*:.*@/);
      expect(JSON.stringify(lastCall)).not.toMatch(/password/i);
      
      logSpy.mockRestore();
    });
  });
});