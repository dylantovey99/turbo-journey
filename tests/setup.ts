import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { config } from '@/config';

// Mock external services
jest.mock('@/services/queue/redis', () => ({
  RedisConnection: {
    getInstance: jest.fn().mockReturnValue({
      connect: jest.fn(),
      disconnect: jest.fn(),
      getClient: jest.fn().mockReturnValue({
        ping: jest.fn().mockResolvedValue('PONG')
      }),
      isHealthy: jest.fn().mockReturnValue(true)
    })
  },
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
  getRedisClient: jest.fn().mockReturnValue({
    ping: jest.fn().mockResolvedValue('PONG')
  })
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setUserAgent: jest.fn(),
      setViewport: jest.fn(),
      goto: jest.fn(),
      waitForTimeout: jest.fn(),
      content: jest.fn().mockResolvedValue('<html><body>Test content</body></html>'),
      close: jest.fn()
    }),
    close: jest.fn()
  })
}));

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            relevantUSPs: ['Test USP 1', 'Test USP 2'],
            personalizationOpportunities: ['Test personalization'],
            recommendedTone: 'professional',
            confidence: 0.8
          })
        }],
        model: 'claude-3-sonnet-20240229',
        role: 'assistant',
        stop_reason: 'end_turn',
        stop_sequence: null,
        type: 'message',
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      })
    }
  }))
}));

jest.mock('axios', () => ({
  create: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  }),
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ data: {} })
}));

// Global test setup
let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // Clean up
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Global test utilities
global.testUtils = {
  createTestProspect: (overrides = {}) => ({
    website: 'https://test-company.com',
    contactEmail: 'test@test-company.com',
    contactName: 'Test User',
    companyName: 'Test Company',
    industry: 'Technology',
    status: 'pending',
    ...overrides
  }),
  
  createTestCampaign: (overrides = {}) => ({
    name: 'Test Campaign',
    marketingDocument: 'Test marketing document with value propositions',
    usps: ['Test USP 1', 'Test USP 2'],
    targetAudience: 'Technology companies',
    tone: 'professional',
    missiveAccountId: 'test-account-id',
    status: 'draft',
    ...overrides
  }),
  
  createTestEmailJob: (prospectId: string, campaignId: string, overrides = {}) => ({
    prospectId,
    campaignId,
    status: 'queued',
    attempts: 0,
    ...overrides
  })
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidObjectId(): R;
      toBeValidEmail(): R;
      toBeValidUrl(): R;
    }
  }
  
  var testUtils: {
    createTestProspect: (overrides?: any) => any;
    createTestCampaign: (overrides?: any) => any;
    createTestEmailJob: (prospectId: string, campaignId: string, overrides?: any) => any;
  };
}

expect.extend({
  toBeValidObjectId(received) {
    const pass = mongoose.Types.ObjectId.isValid(received);
    return {
      message: () => `expected ${received} to be a valid ObjectId`,
      pass
    };
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    return {
      message: () => `expected ${received} to be a valid email`,
      pass
    };
  },
  
  toBeValidUrl(received) {
    try {
      new URL(received);
      return { message: () => `expected ${received} to be a valid URL`, pass: true };
    } catch {
      return { message: () => `expected ${received} to be a valid URL`, pass: false };
    }
  }
});