#!/usr/bin/env node

/**
 * Environment Setup Script
 * Automatically detects the deployment platform and copies the appropriate environment file
 */

const fs = require('fs');
const path = require('path');

function detectPlatform() {
  // Railway detection
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) {
    return 'railway';
  }
  
  // Netlify detection
  if (process.env.NETLIFY || process.env.NETLIFY_BUILD_BASE) {
    return 'netlify';
  }
  
  // GitHub Codespaces detection
  if (process.env.CODESPACES || process.env.CODESPACE_NAME) {
    return 'codespaces';
  }
  
  // Heroku detection
  if (process.env.DYNO || process.env.HEROKU_APP_NAME) {
    return 'heroku';
  }
  
  // Render detection
  if (process.env.RENDER || process.env.RENDER_SERVICE_ID) {
    return 'render';
  }
  
  // Vercel detection
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return 'vercel';
  }
  
  // Default to production if no specific platform detected
  return 'production';
}

function setupEnvironment() {
  const platform = detectPlatform();
  const rootDir = path.join(__dirname, '..');
  const sourceFile = path.join(rootDir, `.env.${platform}`);
  const targetFile = path.join(rootDir, '.env');
  
  console.log(`🔍 Detected platform: ${platform}`);
  
  // Check if platform-specific env file exists
  if (!fs.existsSync(sourceFile)) {
    console.log(`⚠️  Platform-specific env file not found: .env.${platform}`);
    console.log(`📋 Using generic .env.production template`);
    
    const genericFile = path.join(rootDir, '.env.production');
    if (fs.existsSync(genericFile)) {
      fs.copyFileSync(genericFile, targetFile);
      console.log(`✅ Copied .env.production to .env`);
    } else {
      console.log(`❌ No environment file found. Please create .env manually.`);
      process.exit(1);
    }
    return;
  }
  
  // Copy platform-specific env file
  try {
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`✅ Copied .env.${platform} to .env`);
    
    // Set additional platform-specific environment variables
    setPlatformSpecificVars(platform);
    
    console.log(`🚀 Environment configured for ${platform}`);
  } catch (error) {
    console.error(`❌ Failed to setup environment:`, error.message);
    process.exit(1);
  }
}

function setPlatformSpecificVars(platform) {
  // Set runtime environment variables based on platform
  switch (platform) {
    case 'railway':
      process.env.IS_CLOUD_DEPLOYMENT = 'true';
      process.env.CLOUD_PLATFORM = 'railway';
      break;
    case 'netlify':
      process.env.IS_CLOUD_DEPLOYMENT = 'true';
      process.env.CLOUD_PLATFORM = 'netlify';
      process.env.DISABLE_PUPPETEER = 'true';
      process.env.FORCE_HTTP_SCRAPING = 'true';
      break;
    case 'codespaces':
      process.env.IS_CLOUD_DEPLOYMENT = 'false';
      process.env.CLOUD_PLATFORM = 'codespaces';
      break;
    case 'heroku':
      process.env.IS_CLOUD_DEPLOYMENT = 'true';
      process.env.CLOUD_PLATFORM = 'heroku';
      break;
    case 'render':
      process.env.IS_CLOUD_DEPLOYMENT = 'true';
      process.env.CLOUD_PLATFORM = 'render';
      break;
    case 'vercel':
      process.env.IS_CLOUD_DEPLOYMENT = 'true';
      process.env.CLOUD_PLATFORM = 'vercel';
      process.env.DISABLE_PUPPETEER = 'true';
      process.env.FORCE_HTTP_SCRAPING = 'true';
      break;
  }
}

function validateEnvironment() {
  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'REDIS_URL',
    'ANTHROPIC_API_KEY'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log(`⚠️  Missing required environment variables: ${missing.join(', ')}`);
    console.log(`📝 Please set these variables in your deployment platform`);
    return false;
  }
  
  console.log(`✅ All required environment variables are set`);
  return true;
}

if (require.main === module) {
  console.log(`🔧 Setting up environment configuration...`);
  setupEnvironment();
  
  // Load the environment file we just created
  require('dotenv').config();
  
  // Validate environment
  const isValid = validateEnvironment();
  
  if (!isValid) {
    console.log(`⚠️  Environment validation failed - some functionality may not work`);
    process.exit(0); // Don't fail the build, just warn
  }
  
  console.log(`🎉 Environment setup completed successfully!`);
}

module.exports = {
  detectPlatform,
  setupEnvironment,
  validateEnvironment
};