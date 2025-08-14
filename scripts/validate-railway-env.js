#!/usr/bin/env node

/**
 * Railway Environment Validation Script
 * Validates required environment variables before Railway deployment
 */

const fs = require('fs');
const crypto = require('crypto');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) { log('green', `✅ ${message}`); }
function error(message) { log('red', `❌ ${message}`); }
function warning(message) { log('yellow', `⚠️  ${message}`); }
function info(message) { log('blue', `ℹ️  ${message}`); }

class RailwayEnvValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
  }

  validateEnvironment() {
    log('blue', '🚂 Railway Environment Validation\n');
    
    const requiredVars = {
      'MONGODB_URI': 'MongoDB connection string',
      'REDIS_URL': 'Redis connection URL', 
      'ANTHROPIC_API_KEY': 'Claude AI API key',
      'JWT_SECRET': 'JWT signing secret (32+ characters)'
    };

    const optionalVars = {
      'MISSIVE_API_TOKEN': 'Missive integration token',
      'ORGANIZATION_DOMAINS': 'Your domain(s)',
      'ORGANIZATION_NAME': 'Company name',
      'DEFAULT_FROM_EMAIL': 'Email sender address',
      'DEFAULT_FROM_NAME': 'Email sender name'
    };

    // Check required variables
    info('Checking required environment variables...');
    for (const [varName, description] of Object.entries(requiredVars)) {
      if (!process.env[varName]) {
        this.errors.push(`Missing required variable: ${varName} (${description})`);
      } else {
        this.validateVariable(varName, process.env[varName]);
        success(`${varName}: ✓`);
      }
    }

    // Check optional variables
    info('\nChecking optional environment variables...');
    for (const [varName, description] of Object.entries(optionalVars)) {
      if (!process.env[varName]) {
        this.warnings.push(`Optional variable not set: ${varName} (${description})`);
      } else {
        success(`${varName}: ✓`);
      }
    }

    this.generateReport();
  }

  validateVariable(name, value) {
    switch (name) {
      case 'MONGODB_URI':
        if (!value.startsWith('mongodb://') && !value.startsWith('mongodb+srv://')) {
          this.errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
        }
        if (value.includes('localhost') || value.includes('127.0.0.1')) {
          this.warnings.push('MONGODB_URI appears to be localhost - ensure it\'s accessible from Railway');
        }
        break;

      case 'REDIS_URL':
        if (!value.startsWith('redis://') && !value.startsWith('rediss://')) {
          this.errors.push('REDIS_URL must start with redis:// or rediss://');
        }
        if (value.includes('localhost') || value.includes('127.0.0.1')) {
          this.warnings.push('REDIS_URL appears to be localhost - ensure it\'s accessible from Railway');
        }
        break;

      case 'ANTHROPIC_API_KEY':
        if (!value.startsWith('sk-ant-')) {
          this.errors.push('ANTHROPIC_API_KEY should start with sk-ant-');
        }
        if (value.length < 50) {
          this.warnings.push('ANTHROPIC_API_KEY appears to be too short');
        }
        break;

      case 'JWT_SECRET':
        if (value.length < 32) {
          this.errors.push('JWT_SECRET must be at least 32 characters long');
        }
        if (value === 'your-jwt-secret-here' || value === 'development-jwt-secret-not-for-production') {
          this.errors.push('JWT_SECRET is using a default/development value - generate a secure random string');
        }
        break;

      case 'MISSIVE_API_TOKEN':
        if (value && !value.startsWith('missive_pat-')) {
          this.warnings.push('MISSIVE_API_TOKEN should start with missive_pat-');
        }
        break;
    }
  }

  generateJWTSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateReport() {
    console.log('\n' + '='.repeat(50));
    log('cyan', '📊 VALIDATION REPORT');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      success('🎉 All environment variables are properly configured!');
      success('✈️  Ready for Railway deployment!');
    } else {
      if (this.errors.length > 0) {
        log('red', `\n❌ CRITICAL ERRORS (${this.errors.length}):`);
        this.errors.forEach(err => console.log(`   • ${err}`));
      }

      if (this.warnings.length > 0) {
        log('yellow', `\n⚠️  WARNINGS (${this.warnings.length}):`);
        this.warnings.forEach(warn => console.log(`   • ${warn}`));
      }
    }

    // Provide helpful suggestions
    console.log('\n' + '='.repeat(50));
    log('blue', '💡 SETUP SUGGESTIONS');
    console.log('='.repeat(50));

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      const newSecret = this.generateJWTSecret();
      info('Generate a secure JWT secret:');
      console.log(`   JWT_SECRET=${newSecret}`);
    }

    if (!process.env.MONGODB_URI) {
      info('MongoDB Atlas setup:');
      console.log('   1. Visit https://cloud.mongodb.com');
      console.log('   2. Create free cluster');
      console.log('   3. Get connection string');
      console.log('   4. Replace <password> with your password');
    }

    if (!process.env.REDIS_URL) {
      info('Redis Cloud setup:');
      console.log('   1. Visit https://redis.com/try-free/');
      console.log('   2. Create free database');
      console.log('   3. Copy connection URL');
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      info('Anthropic API Key setup:');
      console.log('   1. Visit https://console.anthropic.com');
      console.log('   2. Create API key');
      console.log('   3. Copy key (starts with sk-ant-)');
    }

    console.log('\n' + '='.repeat(50));
    log('blue', '🚂 RAILWAY DEPLOYMENT');
    console.log('='.repeat(50));
    
    if (this.errors.length === 0) {
      success('Ready to deploy to Railway!');
      console.log('\nNext steps:');
      console.log('1. Push code to GitHub');
      console.log('2. Connect Railway to your repository');
      console.log('3. Add environment variables in Railway dashboard');
      console.log('4. Deploy automatically');
    } else {
      error('Fix the errors above before deploying to Railway');
    }

    console.log('\nFor detailed instructions, see: RAILWAY_DEPLOYMENT.md');
  }
}

// Load environment variables from .env.railway if it exists
if (fs.existsSync('.env.railway')) {
  const envConfig = fs.readFileSync('.env.railway', 'utf8');
  envConfig.split('\n').forEach(line => {
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/\${.*?}/g, ''); // Remove variable substitutions
      if (value && !value.startsWith('${')) {
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

// Run validation
if (require.main === module) {
  const validator = new RailwayEnvValidator();
  validator.validateEnvironment();
}

module.exports = RailwayEnvValidator;