#!/usr/bin/env node

/**
 * Railway Deployment Test Script
 * Tests the application locally with Railway-like environment settings
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

class RailwayDeploymentTest {
  constructor() {
    this.testResults = {
      build: false,
      environment: false,
      startup: false,
      health: false
    };
  }

  async runTests() {
    log('blue', '🚂 Railway Deployment Test Suite\n');
    
    try {
      await this.testBuildProcess();
      await this.testEnvironmentVariables();
      await this.testServerStartup();
      await this.testHealthEndpoint();
      
      this.generateReport();
    } catch (error) {
      log('red', `❌ Test suite failed: ${error.message}`);
      process.exit(1);
    }
  }

  async testBuildProcess() {
    log('cyan', '🔨 Testing build process...');
    
    try {
      // Test if build:production script works
      const buildResult = await this.runCommand('npm', ['run', 'build:production']);
      
      if (buildResult.success) {
        // Check if dist directory and main files exist
        if (fs.existsSync('dist/server.js') && fs.existsSync('dist/alias.js')) {
          log('green', '✅ Build process successful');
          log('green', '✅ Required build artifacts exist');
          this.testResults.build = true;
        } else {
          throw new Error('Build artifacts missing');
        }
      } else {
        throw new Error('Build process failed');
      }
    } catch (error) {
      log('red', `❌ Build test failed: ${error.message}`);
    }
    
    console.log();
  }

  async testEnvironmentVariables() {
    log('cyan', '🔧 Testing environment configuration...');
    
    // Load Railway environment
    this.loadRailwayEnv();
    
    const requiredVars = ['NODE_ENV', 'PORT'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length === 0) {
      log('green', '✅ Core environment variables configured');
      
      // Test Railway-specific settings
      if (process.env.NODE_ENV === 'production') {
        log('green', '✅ Production environment configured');
      }
      
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        log('green', '✅ Puppeteer configuration present');
      }
      
      this.testResults.environment = true;
    } else {
      log('red', `❌ Missing environment variables: ${missingVars.join(', ')}`);
    }
    
    console.log();
  }

  async testServerStartup() {
    log('cyan', '🚀 Testing server startup...');
    
    try {
      // Test railway:start script
      const port = process.env.PORT || 3000;
      log('blue', `Starting server on port ${port}...`);
      
      const serverProcess = spawn('npm', ['run', 'railway:start'], {
        env: { ...process.env, PORT: port },
        stdio: 'pipe'
      });
      
      let serverOutput = '';
      serverProcess.stdout.on('data', (data) => {
        serverOutput += data.toString();
      });
      
      serverProcess.stderr.on('data', (data) => {
        serverOutput += data.toString();
      });
      
      // Wait for server to start (up to 30 seconds)
      const startupPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          serverProcess.kill();
          reject(new Error('Server startup timeout'));
        }, 30000);
        
        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
        
        // Check for successful startup indicators
        const checkStartup = () => {
          if (serverOutput.includes('Server ready') || 
              serverOutput.includes('listening on port') ||
              serverOutput.includes(`port ${port}`)) {
            clearTimeout(timeout);
            serverProcess.kill();
            resolve();
          }
        };
        
        serverProcess.stdout.on('data', checkStartup);
        serverProcess.stderr.on('data', checkStartup);
        
        // Also check after a brief delay
        setTimeout(checkStartup, 5000);
      });
      
      await startupPromise;
      log('green', '✅ Server startup successful');
      this.testResults.startup = true;
      
    } catch (error) {
      log('red', `❌ Server startup failed: ${error.message}`);
    }
    
    console.log();
  }

  async testHealthEndpoint() {
    log('cyan', '🏥 Testing health endpoint...');
    
    try {
      // Start a minimal server test
      const axios = require('axios').default;
      const port = process.env.PORT || 3000;
      
      log('blue', 'Starting temporary server for health check...');
      
      const serverProcess = spawn('npm', ['run', 'railway:start'], {
        env: { ...process.env, PORT: port },
        stdio: 'pipe'
      });
      
      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      try {
        const response = await axios.get(`http://localhost:${port}/health`, {
          timeout: 5000
        });
        
        if (response.status === 200 && response.data.status) {
          log('green', '✅ Health endpoint responding');
          log('green', `✅ Health status: ${response.data.status}`);
          this.testResults.health = true;
        } else {
          throw new Error('Health endpoint returned invalid response');
        }
      } catch (error) {
        log('yellow', `⚠️  Health endpoint test failed: ${error.message}`);
        log('yellow', '   This may be due to missing database connections in test environment');
      } finally {
        serverProcess.kill();
      }
      
    } catch (error) {
      log('red', `❌ Health endpoint test failed: ${error.message}`);
    }
    
    console.log();
  }

  loadRailwayEnv() {
    const envFile = '.env.railway';
    if (fs.existsSync(envFile)) {
      const envConfig = fs.readFileSync(envFile, 'utf8');
      envConfig.split('\n').forEach(line => {
        if (line && !line.startsWith('#') && line.includes('=')) {
          const [key, ...valueParts] = line.split('=');
          let value = valueParts.join('=');
          
          // Handle Railway environment variable substitutions
          if (value.includes('${')) {
            value = value.replace(/\${PORT}/g, '3000');
            value = value.replace(/\${.*?}/g, 'test-value');
          }
          
          if (value && !value.startsWith('${')) {
            process.env[key.trim()] = value.trim();
          }
        }
      });
    }
  }

  async runCommand(command, args) {
    return new Promise((resolve) => {
      const process = spawn(command, args, { stdio: 'pipe' });
      
      process.on('close', (code) => {
        resolve({ success: code === 0, code });
      });
      
      process.on('error', () => {
        resolve({ success: false, code: 1 });
      });
    });
  }

  generateReport() {
    console.log('\n' + '='.repeat(50));
    log('cyan', '📊 DEPLOYMENT TEST REPORT');
    console.log('='.repeat(50));
    
    const passedTests = Object.values(this.testResults).filter(result => result === true).length;
    const totalTests = Object.keys(this.testResults).length;
    
    log('blue', `Test Results: ${passedTests}/${totalTests} passed\n`);
    
    for (const [test, passed] of Object.entries(this.testResults)) {
      if (passed) {
        log('green', `✅ ${test}: PASSED`);
      } else {
        log('red', `❌ ${test}: FAILED`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (passedTests === totalTests) {
      log('green', '🎉 All tests passed! Ready for Railway deployment.');
      console.log('\nNext steps:');
      console.log('1. Set up external services (MongoDB Atlas, Redis Cloud)');
      console.log('2. Connect Railway to your GitHub repository');
      console.log('3. Configure environment variables in Railway dashboard');
      console.log('4. Deploy!');
    } else {
      log('yellow', '⚠️  Some tests failed. Review the issues above.');
      console.log('\nCommon fixes:');
      console.log('- Ensure all dependencies are installed: npm install');
      console.log('- Check TypeScript compilation: npm run typecheck');
      console.log('- Verify environment configuration: npm run validate:railway');
    }
    
    console.log('\nFor complete deployment guide: RAILWAY_DEPLOYMENT.md');
  }
}

// Run tests
if (require.main === module) {
  const tester = new RailwayDeploymentTest();
  tester.runTests().catch(console.error);
}

module.exports = RailwayDeploymentTest;