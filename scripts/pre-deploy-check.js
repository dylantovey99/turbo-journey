#!/usr/bin/env node

/**
 * Pre-deployment verification script
 * Comprehensive checks before deploying to production
 */

const fs = require('fs');
const { execSync } = require('child_process');

function runCommand(command, description) {
  console.log(`🔄 ${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${description} passed`);
    return { success: true, output };
  } catch (error) {
    console.log(`❌ ${description} failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description} exists`);
    return true;
  } else {
    console.log(`❌ ${description} missing`);
    return false;
  }
}

async function preDeployCheck() {
  console.log('🚀 Running pre-deployment checks...\n');
  
  let allChecksPass = true;
  
  // 1. TypeScript compilation
  const tscResult = runCommand('npm run typecheck', 'TypeScript type checking');
  if (!tscResult.success) allChecksPass = false;
  
  // 2. Linting
  const lintResult = runCommand('npm run lint', 'ESLint code quality check');
  if (!lintResult.success) allChecksPass = false;
  
  // 3. Unit tests
  const testResult = runCommand('npm test -- --passWithNoTests', 'Unit tests');
  if (!testResult.success) allChecksPass = false;
  
  // 4. Build process
  const buildResult = runCommand('npm run build:compile', 'Production build');
  if (!buildResult.success) allChecksPass = false;
  
  // 5. Critical files check
  const criticalFiles = [
    { path: 'dist/server.js', desc: 'Main server file' },
    { path: 'dist/alias.js', desc: 'Path alias resolver' },
    { path: 'package.json', desc: 'Package configuration' },
    { path: 'Dockerfile', desc: 'Docker configuration' },
    { path: 'railway.toml', desc: 'Railway configuration' },
    { path: '.env.production', desc: 'Production environment template' }
  ];
  
  console.log('\n📁 Checking critical files...');
  for (const file of criticalFiles) {
    if (!checkFileExists(file.path, file.desc)) {
      allChecksPass = false;
    }
  }
  
  // 6. Package.json validation
  console.log('\n📦 Validating package.json...');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    if (!packageJson.engines) {
      console.log('❌ Missing engines field in package.json');
      allChecksPass = false;
    } else {
      console.log('✅ Engines field configured');
    }
    
    if (!packageJson.scripts.start) {
      console.log('❌ Missing start script in package.json');
      allChecksPass = false;
    } else {
      console.log('✅ Start script configured');
    }
    
    // Check for security vulnerabilities in dependencies
    const auditResult = runCommand('npm audit --audit-level=high', 'Security audit');
    // Note: Don't fail on audit issues, just warn
    if (!auditResult.success) {
      console.log('⚠️  Security vulnerabilities found - consider running npm audit fix');
    }
    
  } catch (error) {
    console.log('❌ Invalid package.json format');
    allChecksPass = false;
  }
  
  // 7. Docker build test (if Docker is available)
  console.log('\n🐳 Checking Docker configuration...');
  try {
    execSync('which docker', { stdio: 'pipe' });
    const dockerResult = runCommand('docker build -t test-build .', 'Docker build test');
    if (dockerResult.success) {
      // Clean up test image
      try {
        execSync('docker rmi test-build', { stdio: 'pipe' });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.log('⚠️  Docker not available - skipping Docker build test');
  }
  
  // 8. Environment configuration check
  console.log('\n🔧 Checking environment configuration...');
  const envResult = runCommand('node scripts/verify-environment.js', 'Environment validation');
  if (!envResult.success) allChecksPass = false;
  
  // Summary
  console.log('\n' + '='.repeat(50));
  if (allChecksPass) {
    console.log('🎉 All pre-deployment checks passed!');
    console.log('✅ Ready for deployment to production');
    console.log('\n📋 Next steps:');
    console.log('   1. Commit your changes: git add . && git commit -m "feat: production deployment ready"');
    console.log('   2. Push to trigger deployment: git push');
    console.log('   3. Monitor deployment logs for any issues');
    console.log('   4. Test deployed application health endpoint');
    process.exit(0);
  } else {
    console.log('💥 Pre-deployment checks failed!');
    console.log('❌ Fix the issues above before deploying');
    console.log('\n🔧 Suggested fixes:');
    console.log('   1. Run: npm run lint:fix');
    console.log('   2. Run: npm test -- --updateSnapshot');
    console.log('   3. Run: npm run build');
    console.log('   4. Check all environment variables are configured');
    process.exit(1);
  }
}

// Run checks
preDeployCheck().catch(error => {
  console.error('💥 Pre-deployment check failed with error:', error);
  process.exit(1);
});