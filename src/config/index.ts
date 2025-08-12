import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  database: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/email-generator',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  missive: {
    apiToken: process.env.MISSIVE_API_TOKEN || '',
    baseUrl: process.env.MISSIVE_API_BASE_URL || 'https://public.missiveapp.com/v1',
    webhookSecret: process.env.MISSIVE_WEBHOOK_SECRET || '',
    defaultAccountId: process.env.MISSIVE_DEFAULT_ACCOUNT_ID || '',
  },
  
  organization: {
    domains: process.env.ORGANIZATION_DOMAINS?.split(',').map(d => d.trim()) || ['example.com'],
    name: process.env.ORGANIZATION_NAME || 'Email Generator',
  },
  
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '',
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7'),
  },
  
  email: {
    defaultFromEmail: process.env.DEFAULT_FROM_EMAIL || '',
    defaultFromName: process.env.DEFAULT_FROM_NAME || '',
  },
  
  rateLimits: {
    scrapingDelayMs: parseInt(process.env.SCRAPING_DELAY_MS || '2000'),
    missiveRateLimit: parseInt(process.env.MISSIVE_RATE_LIMIT_PER_SECOND || '1'),
    claudeRateLimit: parseInt(process.env.CLAUDE_RATE_LIMIT_PER_MINUTE || '60'),
  },
  
  scraping: {
    timeout: parseInt(process.env.SCRAPING_TIMEOUT || '30000'),
    maxRetries: parseInt(process.env.SCRAPING_MAX_RETRIES || '3'),
    userAgent: process.env.SCRAPING_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
    apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '30'),
  },
};

export default config;