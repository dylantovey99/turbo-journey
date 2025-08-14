#!/usr/bin/env node

/**
 * Environment Setup Script
 * Automatically detects the deployment platform and copies the appropriate environment file
 */

const fs = require('fs');
const path = require('path');

function detectPlatform() {
  // Railway detection
  if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_SERVICE_ID) {
    return 'railway';
  }
  
  // Netlify detection
  if (process.env.NETLIFY || process.env.NETLIFY_BUILD_BASE) {
    return 'netlify';
  }
  
  // GitHub Codespaces detection
  if (process.env.CODESPACES || process.env.CODESPACE_NAME || process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
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
  console.log(`📁 Looking for env file: ${sourceFile}`);
  console.log(`🎯 Target env file: ${targetFile}`);
  
  // Check if platform-specific env file exists
  if (!fs.existsSync(sourceFile)) {
    console.log(`⚠️  Platform-specific env file not found: .env.${platform}`);
    
    // For Railway and other cloud platforms, environment variables are provided via the platform
    // We don't need to copy local env files - just validate that critical env vars are available
    if (platform === 'railway' || platform === 'render' || platform === 'vercel' || platform === 'production') {
      console.log(`📋 Cloud platform detected: ${platform}`);
      console.log(`✅ Environment variables will be provided by ${platform} platform`);
      console.log(`ℹ️  No local .env file needed for cloud deployment`);
      
      // Set platform-specific variables
      setPlatformSpecificVars(platform);
      return;
    }
    
    console.log(`📋 Looking for generic .env.production template`);
    const genericFile = path.join(rootDir, '.env.production');
    if (fs.existsSync(genericFile)) {
      fs.copyFileSync(genericFile, targetFile);
      console.log(`✅ Copied .env.production to .env`);
    } else {
      console.log(`⚠️  No local environment template found`);
      console.log(`💡 For cloud deployment, environment variables should be set in the platform dashboard`);
      
      // Don't exit with error for cloud platforms
      if (platform === 'railway' || platform === 'render' || platform === 'vercel' || platform === 'production') {
        return;
      }
      
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
    'NODE_ENV'
  ];
  
  // These are required for runtime but can be missing during build
  const runtimeRequiredVars = [
    'MONGODB_URI',
    'REDIS_URL'
  ];
  
  // API keys are optional in development
  const optionalInDev = [
    'ANTHROPIC_API_KEY',
    'MISSIVE_API_TOKEN'
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  const missingRuntime = runtimeRequiredVars.filter(varName => !process.env[varName]);
  const missingOptional = optionalInDev.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log(`❌ Missing critical environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  if (missingRuntime.length > 0) {
    console.log(`⚠️  Missing runtime environment variables: ${missingRuntime.join(', ')}`);
    console.log(`📝 Please set these variables in your deployment platform dashboard`);
    
    // In cloud platforms, these will be provided at runtime
    const cloudPlatforms = ['railway', 'render', 'vercel', 'production', 'heroku'];
    const currentPlatform = detectPlatform();
    
    if (cloudPlatforms.includes(currentPlatform)) {
      console.log(`🔧 Continuing build - ${currentPlatform} will provide runtime variables`);
      console.log(`💡 Ensure environment variables are configured in ${currentPlatform} dashboard`);
    } else if (process.env.NODE_ENV === 'development' || process.env.CODESPACES || process.env.CODESPACE_NAME) {
      console.log(`🔧 Continuing in development mode with limited functionality`);
      console.log(`💡 Missing variables will use default values or be set up later`);
    } else {
      return false;
    }
  }
  
  if (missingOptional.length > 0) {
    console.log(`ℹ️  Optional API keys not set: ${missingOptional.join(', ')}`);
    console.log(`⚡ Some functionality will be limited without these keys`);
  }
  
  console.log(`✅ Core environment variables are set`);
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