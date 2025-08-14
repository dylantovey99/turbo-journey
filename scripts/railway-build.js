#!/usr/bin/env node

/**
 * Railway-specific build script
 * Bypasses environment validation and focuses on compilation only
 */

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚂 Railway Build Process Starting...');
console.log('='.repeat(40));

// Set minimal environment for build
process.env.NODE_ENV = 'production';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

async function runCommand(command, args, description) {
  console.log(`🔧 ${description}...`);
  
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: 'inherit',
      env: process.env 
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${description} failed with code ${code}`);
        reject(new Error(`${description} failed`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ ${description} error:`, error.message);
      reject(error);
    });
  });
}

async function buildForRailway() {
  try {
    // Skip environment setup and linting for Railway builds
    console.log('🏗️  Building TypeScript...');
    
    // Clean build directory
    if (fs.existsSync('dist')) {
      console.log('🧹 Cleaning previous build...');
      fs.rmSync('dist', { recursive: true, force: true });
    }
    
    // Compile TypeScript
    await runCommand('npx', ['tsc', '--build'], 'TypeScript compilation');
    
    // Verify build output
    if (fs.existsSync('dist/server.js')) {
      console.log('✅ Build artifacts created successfully');
    } else {
      throw new Error('Build artifacts not found');
    }
    
    console.log('='.repeat(40));
    console.log('🎉 Railway build completed successfully!');
    console.log('📁 Build artifacts ready in dist/ directory');
    
  } catch (error) {
    console.error('='.repeat(40));
    console.error('❌ Railway build failed:', error.message);
    console.error('='.repeat(40));
    process.exit(1);
  }
}

// Run the build
buildForRailway();