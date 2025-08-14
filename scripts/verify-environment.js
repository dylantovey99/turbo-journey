#!/usr/bin/env node

/**
 * Environment verification script for build process
 * Validates that all required configurations are present for deployment
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

function validateEnvironment() {
  console.log('🔍 Verifying environment configuration...');
  
  const errors = [];
  const warnings = [];
  const info = [];

  // Check if dist directory exists
  if (!fs.existsSync('dist')) {
    errors.push('dist directory not found - build may have failed');
  } else {
    info.push('✅ dist directory exists');
  }

  // Check if main server file exists
  if (!fs.existsSync('dist/server.js')) {
    errors.push('dist/server.js not found - TypeScript compilation may have failed');
  } else {
    info.push('✅ dist/server.js exists');
  }

  // Check if alias file exists (critical for production)
  if (!fs.existsSync('dist/alias.js')) {
    errors.push('dist/alias.js not found - path alias resolution will fail in production');
  } else {
    info.push('✅ dist/alias.js exists');
    
    // Test alias resolution by attempting to require the main files
    try {
      const aliasContent = fs.readFileSync('dist/alias.js', 'utf8');
      if (aliasContent.includes('moduleAlias.addAliases')) {
        info.push('✅ Path aliases configured in compiled output');
      } else {
        warnings.push('Path aliases may not be properly configured');
      }
    } catch (err) {
      warnings.push('Could not verify path alias configuration');
    }
  }

  // Validate Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion < 18) {
    errors.push(`Node.js version ${nodeVersion} is too old - requires Node.js 18 or higher`);
  } else {
    info.push(`✅ Node.js version ${nodeVersion} is compatible`);
  }

  // Check package.json engines field
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!packageJson.engines) {
    warnings.push('package.json missing engines field - deployment platforms may use wrong Node.js version');
  } else {
    info.push('✅ package.json engines field configured');
  }

  // Check for production environment settings
  if (process.env.NODE_ENV === 'production') {
    info.push('✅ Running in production mode');
    
    // Critical production checks
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default-secret') {
      errors.push('JWT_SECRET must be set to a secure value in production');
    }
    
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
    
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('localhost')) {
      warnings.push('MONGODB_URI not configured for production - may cause connection issues');
    }
    
    if (!process.env.REDIS_URL || process.env.REDIS_URL.includes('localhost')) {
      warnings.push('REDIS_URL not configured for production - may cause connection issues');
    }
  } else {
    info.push('📝 Running in development mode');
  }

  // API key validation
  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY not configured - AI functionality will be limited');
  } else {
    info.push('✅ ANTHROPIC_API_KEY configured');
  }

  if (!process.env.MISSIVE_API_TOKEN) {
    warnings.push('MISSIVE_API_TOKEN not configured - email functionality will be disabled');
  } else {
    info.push('✅ MISSIVE_API_TOKEN configured');
  }

  // Puppeteer configuration for cloud deployment
  if (process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL || process.env.NETLIFY || process.env.CODESPACE_NAME) {
    if (!process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD) {
      warnings.push('PUPPETEER_SKIP_CHROMIUM_DOWNLOAD not set - may cause deployment issues');
    } else {
      info.push('✅ Puppeteer configured for cloud deployment');
    }
  }

  // Check dependencies
  if (!fs.existsSync('node_modules')) {
    errors.push('node_modules directory not found - run npm install');
  } else {
    info.push('✅ node_modules exists');
  }

  // Check critical dependencies
  const criticalDeps = ['express', 'mongoose', 'redis', 'puppeteer-core', 'module-alias'];
  for (const dep of criticalDeps) {
    if (!fs.existsSync(`node_modules/${dep}`)) {
      errors.push(`Critical dependency ${dep} not found`);
    }
  }

  // Print results
  console.log('\n📊 Environment Verification Results:');
  
  if (info.length > 0) {
    console.log('\n✅ Information:');
    info.forEach(msg => console.log(`  ${msg}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(msg => console.log(`  ⚠️  ${msg}`));
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(msg => console.log(`  ❌ ${msg}`));
  }

  if (errors.length === 0) {
    console.log('\n🎉 Environment verification passed!');
    if (warnings.length > 0) {
      console.log('   Note: There are warnings that should be addressed for optimal deployment.');
    }
    process.exit(0);
  } else {
    console.log('\n💥 Environment verification failed!');
    console.log('   Please fix the errors above before deploying.');
    process.exit(1);
  }
}

// Run verification
validateEnvironment();