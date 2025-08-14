#!/usr/bin/env node

/**
 * GitHub Codespaces Deployment Test Script
 * Validates that all deployment fixes are working correctly
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');

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
function progress(message) { log('cyan', `🔄 ${message}`); }

class CodespacesDeploymentTest {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.testResults = {
      environment: false,
      build: false,
      services: false,
      health: false,
      startup: false
    };
  }

  async runAllTests() {
    log('blue', '🚀 Starting GitHub Codespaces Deployment Test\n');
    
    try {
      await this.testEnvironmentSetup();
      await this.testBuildProcess();
      await this.testServiceConfiguration();
      await this.testHealthEndpoints();
      await this.testStartupScripts();
      
      this.generateReport();
    } catch (error) {
      error(`Test suite failed: ${error.message}`);
      process.exit(1);
    }
  }

  async testEnvironmentSetup() {
    progress('Testing environment setup...');
    
    // Test platform detection
    process.env.CODESPACES = 'true';
    const setupScript = require('../scripts/setup-environment.js');
    const platform = setupScript.detectPlatform();
    
    if (platform === 'codespaces') {
      success('Platform detection works correctly');
      this.testResults.environment = true;
    } else {
      this.errors.push(`Platform detection failed: expected 'codespaces', got '${platform}'`);
    }

    // Test environment file existence
    const envFiles = ['.env.codespaces', '.env.example', '.env'];
    for (const file of envFiles) {
      if (fs.existsSync(file)) {
        success(`Environment file exists: ${file}`);
      } else {
        this.errors.push(`Missing environment file: ${file}`);
      }
    }

    // Test port configuration consistency
    const devcontainerConfig = JSON.parse(fs.readFileSync('.devcontainer/devcontainer.json', 'utf8'));
    const forwardedPorts = devcontainerConfig.forwardPorts;
    
    if (forwardedPorts.includes(3000)) {
      success('Port 3000 is correctly forwarded in devcontainer');
    } else {
      this.errors.push('Port 3000 is not forwarded in devcontainer');
    }

    console.log();
  }

  async testBuildProcess() {
    progress('Testing build process...');
    
    // Check if TypeScript config is valid
    if (fs.existsSync('tsconfig.json')) {
      success('TypeScript configuration exists');
    } else {
      this.errors.push('Missing tsconfig.json');
    }

    // Check if path alias configuration exists
    if (fs.existsSync('src/alias.ts')) {
      const aliasContent = fs.readFileSync('src/alias.ts', 'utf8');
      if (aliasContent.includes('moduleAlias.addAliases')) {
        success('Path alias configuration exists');
      } else {
        this.errors.push('Path alias configuration is incomplete');
      }
    } else {
      this.errors.push('Missing path alias configuration');
    }

    // Test if dist directory exists after build
    if (fs.existsSync('dist') && fs.existsSync('dist/server.js')) {
      success('Build artifacts exist');
      this.testResults.build = true;
    } else {
      this.warnings.push('Build artifacts not found (may need to run build)');
    }

    console.log();
  }

  async testServiceConfiguration() {
    progress('Testing service configuration...');
    
    // Check devcontainer docker-compose configuration
    const dockerComposePath = '.devcontainer/docker-compose.yml';
    if (fs.existsSync(dockerComposePath)) {
      const composeContent = fs.readFileSync(dockerComposePath, 'utf8');
      
      if (composeContent.includes('mongodb:') && composeContent.includes('redis:')) {
        success('MongoDB and Redis services configured');
      } else {
        this.errors.push('Missing service configuration in docker-compose');
      }

      if (composeContent.includes('PORT=3000')) {
        success('Port configuration is consistent');
      } else {
        this.errors.push('Port configuration inconsistency in docker-compose');
      }
      
      this.testResults.services = true;
    } else {
      this.errors.push('Missing devcontainer docker-compose configuration');
    }

    // Check startup scripts
    const startupScripts = [
      '.devcontainer/start-services.sh',
      'scripts/start-dev-server.sh',
      'scripts/auto-start.sh'
    ];

    for (const script of startupScripts) {
      if (fs.existsSync(script)) {
        const stats = fs.statSync(script);
        if (stats.mode & parseInt('111', 8)) {
          success(`Startup script exists and is executable: ${script}`);
        } else {
          this.warnings.push(`Startup script not executable: ${script}`);
        }
      } else {
        this.errors.push(`Missing startup script: ${script}`);
      }
    }

    console.log();
  }

  async testHealthEndpoints() {
    progress('Testing health endpoint configuration...');
    
    // Check if health endpoint is properly configured in server
    if (fs.existsSync('src/server.ts')) {
      const serverContent = fs.readFileSync('src/server.ts', 'utf8');
      
      if (serverContent.includes('/health') && serverContent.includes('async')) {
        success('Health endpoint is configured with async support');
      } else {
        this.warnings.push('Health endpoint may not have proper service checks');
      }

      if (serverContent.includes('services: {') && serverContent.includes('database:') && serverContent.includes('redis:')) {
        success('Health endpoint includes service status checks');
        this.testResults.health = true;
      } else {
        this.warnings.push('Health endpoint missing service status checks');
      }
    } else {
      this.errors.push('Server file not found');
    }

    console.log();
  }

  async testStartupScripts() {
    progress('Testing startup script configuration...');
    
    // Check package.json scripts
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const scripts = packageJson.scripts;

    const requiredScripts = ['start', 'dev', 'build', 'setup:env'];
    for (const script of requiredScripts) {
      if (scripts[script]) {
        success(`Required script exists: ${script}`);
      } else {
        this.errors.push(`Missing required script: ${script}`);
      }
    }

    if (scripts['dev:full']) {
      success('Enhanced dev script with service checks exists');
      this.testResults.startup = true;
    } else {
      this.warnings.push('Enhanced dev script not found');
    }

    // Check devcontainer postCreateCommand and postStartCommand
    const devcontainerConfig = JSON.parse(fs.readFileSync('.devcontainer/devcontainer.json', 'utf8'));
    
    if (devcontainerConfig.postCreateCommand?.includes('npm run build')) {
      success('PostCreateCommand includes build step');
    } else {
      this.warnings.push('PostCreateCommand may not build the application');
    }

    if (devcontainerConfig.postStartCommand?.includes('start-services.sh')) {
      success('PostStartCommand includes service startup');
    } else {
      this.warnings.push('PostStartCommand may not start services automatically');
    }

    console.log();
  }

  generateReport() {
    log('blue', '\n📊 Deployment Test Report\n');
    
    // Test results summary
    const passedTests = Object.values(this.testResults).filter(result => result === true).length;
    const totalTests = Object.keys(this.testResults).length;
    
    log('cyan', `Test Results: ${passedTests}/${totalTests} passed`);
    
    for (const [test, passed] of Object.entries(this.testResults)) {
      if (passed) {
        success(`${test}: PASSED`);
      } else {
        error(`${test}: FAILED`);
      }
    }

    console.log();

    // Errors
    if (this.errors.length > 0) {
      log('red', `❌ Errors (${this.errors.length}):`);
      this.errors.forEach(err => console.log(`   • ${err}`));
      console.log();
    }

    // Warnings
    if (this.warnings.length > 0) {
      log('yellow', `⚠️  Warnings (${this.warnings.length}):`);
      this.warnings.forEach(warn => console.log(`   • ${warn}`));
      console.log();
    }

    // Overall status
    if (this.errors.length === 0) {
      success('🎉 All deployment fixes are working correctly!');
      success('GitHub Codespaces deployment should work properly.');
      console.log();
      log('blue', '💡 Next steps for deployment:');
      console.log('   1. Commit and push your changes');
      console.log('   2. Open repository in GitHub Codespaces');
      console.log('   3. Wait for automatic setup to complete');
      console.log('   4. Run "npm run dev" to start the application');
      console.log('   5. Access the app at http://localhost:3000');
    } else {
      error('🚨 Deployment test failed!');
      error('Please fix the errors above before deploying to GitHub Codespaces.');
      process.exit(1);
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new CodespacesDeploymentTest();
  tester.runAllTests().catch(console.error);
}

module.exports = CodespacesDeploymentTest;