import { logger } from '@/utils/logger';
import { config } from '@/config';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required environment variables for production
  if (config.server.isProduction) {
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('localhost')) {
      warnings.push('MONGODB_URI not configured for production - using localhost fallback');
    }

    if (!process.env.REDIS_URL || process.env.REDIS_URL.includes('localhost')) {
      warnings.push('REDIS_URL not configured for production - using localhost fallback');
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret') {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }

    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
  }

  // Validate API keys for core functionality
  if (!config.claude.apiKey) {
    warnings.push('ANTHROPIC_API_KEY not configured - AI functionality will be limited');
  }

  if (!config.missive.apiToken) {
    warnings.push('MISSIVE_API_TOKEN not configured - email functionality will be disabled');
  }

  // Validate URLs
  try {
    new URL(config.missive.baseUrl);
  } catch {
    warnings.push('MISSIVE_API_BASE_URL is not a valid URL');
  }

  // Validate numeric configurations
  if (isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    errors.push('PORT must be a valid number between 1 and 65535');
  }

  if (config.claude.maxTokens < 1 || config.claude.maxTokens > 4000) {
    warnings.push('CLAUDE_MAX_TOKENS should be between 1 and 4000');
  }

  if (config.claude.temperature < 0 || config.claude.temperature > 1) {
    warnings.push('CLAUDE_TEMPERATURE should be between 0 and 1');
  }

  // Check cloud deployment readiness
  if (config.server.isCloudDeployment) {
    if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
      warnings.push('PUPPETEER_EXECUTABLE_PATH not set for cloud deployment');
    }

    if (process.env.NODE_ENV !== 'production') {
      warnings.push('Cloud deployment detected but NODE_ENV is not production');
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings
  };
}

export function logValidationResults(result: ValidationResult): void {
  if (result.errors.length > 0) {
    logger.error('Environment validation failed:', { errors: result.errors });
  }

  if (result.warnings.length > 0) {
    logger.warn('Environment validation warnings:', { warnings: result.warnings });
  }

  if (result.isValid && result.warnings.length === 0) {
    logger.info('Environment validation passed successfully');
  }
}

export function getEnvironmentInfo(): Record<string, any> {
  return {
    nodeEnv: config.server.nodeEnv,
    isProduction: config.server.isProduction,
    isCloudDeployment: config.server.isCloudDeployment,
    platform: process.platform,
    nodeVersion: process.version,
    port: config.server.port,
    hasMongoDB: !!process.env.MONGODB_URI,
    hasRedis: !!process.env.REDIS_URL,
    hasClaudeAPI: !!config.claude.apiKey,
    hasMissiveAPI: !!config.missive.apiToken,
    deployment: {
      railway: !!process.env.RAILWAY_ENVIRONMENT,
      vercel: !!process.env.VERCEL,
      netlify: !!process.env.NETLIFY,
      codespaces: !!process.env.CODESPACE_NAME,
      render: !!process.env.RENDER,
      heroku: !!process.env.HEROKU_APP_NAME,
    }
  };
}