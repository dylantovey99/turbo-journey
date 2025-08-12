#!/usr/bin/env ts-node

import { ConfigurationValidator } from '@/services/system/ConfigurationValidator';
import { MissiveIntegrationTest } from '@/tests/integration/MissiveIntegrationTest';
import { logger } from '@/utils/logger';

/**
 * Setup and validation script for Missive integration
 */
class MissiveIntegrationSetup {
  private configValidator: ConfigurationValidator;
  private integrationTest: MissiveIntegrationTest;

  constructor() {
    this.configValidator = ConfigurationValidator.getInstance();
    this.integrationTest = new MissiveIntegrationTest();
  }

  /**
   * Run complete setup validation and testing
   */
  public async runSetup(): Promise<void> {
    console.log('🚀 Starting Missive Integration Setup and Validation\n');

    try {
      // Step 1: Validate configuration
      console.log('📋 Step 1: Validating system configuration...');
      const configReport = await this.configValidator.validateSystemConfiguration();
      
      console.log(`Configuration Status: ${this.getStatusEmoji(configReport.overallStatus)} ${configReport.overallStatus.toUpperCase()}\n`);

      if (configReport.overallStatus === 'critical') {
        console.log('❌ Critical configuration issues found. Setup cannot continue.\n');
        this.displayConfigurationReport(configReport);
        this.displaySetupInstructions(configReport);
        return;
      }

      if (configReport.overallStatus === 'warning') {
        console.log('⚠️  Configuration warnings found. Setup will continue but issues should be addressed.\n');
        this.displayConfigurationReport(configReport);
      }

      // Step 2: Run integration tests
      console.log('🧪 Step 2: Running integration tests...');
      const testResults = await this.integrationTest.runCompleteIntegrationTest();
      
      console.log(`Integration Tests: ${testResults.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`Duration: ${testResults.overallDuration}ms`);
      console.log(`Tests: ${testResults.results.filter(r => r.success).length}/${testResults.results.length} passed\n`);

      // Display detailed results
      this.displayTestResults(testResults);

      // Step 3: Generate final report
      if (testResults.success && configReport.overallStatus === 'healthy') {
        console.log('🎉 Setup Complete! Missive integration is ready for use.\n');
        this.displaySuccessInstructions();
      } else {
        console.log('⚠️  Setup completed with issues. Please address the problems above.\n');
        if (configReport.overallStatus !== 'healthy') {
          this.displaySetupInstructions(configReport);
        }
      }

    } catch (error) {
      console.error('❌ Setup failed with unexpected error:', error);
      logger.error('Missive integration setup failed', error);
    }
  }

  /**
   * Display configuration report
   */
  private displayConfigurationReport(report: any): void {
    console.log('📊 Configuration Report:');
    
    // Show errors
    const errors = report.validationResults.filter((r: any) => r.severity === 'error');
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach((error: any) => {
        console.log(`  • ${error.service}: ${error.details}`);
        if (error.remedy) {
          console.log(`    💡 Fix: ${error.remedy}`);
        }
      });
    }

    // Show warnings  
    const warnings = report.validationResults.filter((r: any) => r.severity === 'warning');
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach((warning: any) => {
        console.log(`  • ${warning.service}: ${warning.details}`);
        if (warning.remedy) {
          console.log(`    💡 Fix: ${warning.remedy}`);
        }
      });
    }

    // Show missing configurations
    if (report.missingConfigurations.length > 0) {
      console.log('\n📝 Missing Environment Variables:');
      report.missingConfigurations.forEach((config: string) => {
        console.log(`  • ${config}`);
      });
    }

    console.log('');
  }

  /**
   * Display test results
   */
  private displayTestResults(results: any): void {
    console.log('🧪 Test Results:');
    
    results.results.forEach((result: any) => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.test} (${result.duration}ms)`);
      if (!result.success) {
        console.log(`     ${result.details}`);
      }
    });
    
    console.log('');
  }

  /**
   * Display setup instructions
   */
  private displaySetupInstructions(report: any): void {
    const instructions = this.configValidator.generateSetupInstructions(report);
    
    console.log('🔧 Setup Instructions:');
    
    if (instructions.criticalActions.length > 0) {
      console.log('\n❗ Critical Actions (Required):');
      instructions.criticalActions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
    }

    if (instructions.recommendedActions.length > 0) {
      console.log('\n💡 Recommended Actions:');
      instructions.recommendedActions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
    }

    console.log('\n📚 Detailed Configuration Steps:');
    instructions.configurationSteps.forEach((step) => {
      console.log(`\n${step.step}. ${step.title}`);
      console.log(`   ${step.description}`);
      if (step.commands) {
        step.commands.forEach((command) => {
          if (command.startsWith('#')) {
            console.log(`   💬 ${command}`);
          } else {
            console.log(`   $ ${command}`);
          }
        });
      }
    });

    console.log('');
  }

  /**
   * Display success instructions
   */
  private displaySuccessInstructions(): void {
    console.log('✨ Your Missive integration is fully configured and ready! Here\'s what you can do next:\n');
    
    console.log('📧 Email Generation & Sending:');
    console.log('  • Use MissiveEmailSender to send personalized emails');
    console.log('  • Emails are automatically tracked and monitored for responses\n');
    
    console.log('📊 Response Monitoring:');
    console.log('  • Responses are detected via webhooks (real-time) and polling (backup)');
    console.log('  • All responses are analyzed for quality and sentiment');
    console.log('  • Learning models are updated automatically\n');
    
    console.log('🔧 API Endpoints:');
    console.log('  • POST /api/webhooks/missive - Webhook handler for Missive');
    console.log('  • GET /api/webhooks/missive/health - Health check');
    console.log('  • POST /api/webhooks/missive/monitor-responses - Manual monitoring trigger\n');
    
    console.log('📈 Monitoring:');
    console.log('  • Check logs for response detection and analysis');
    console.log('  • Monitor database for learning model updates');
    console.log('  • Use MissiveResponseMonitor.getMonitoringStats() for statistics\n');
    
    console.log('🏗️  Production Deployment:');
    console.log('  • Ensure webhook endpoint is publicly accessible');
    console.log('  • Configure webhook URL in Missive dashboard');
    console.log('  • Set up monitoring and alerting for failed sends/responses');
    console.log('  • Consider setting up Redis for session management\n');
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '❌';
      default: return '❓';
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new MissiveIntegrationSetup();
  setup.runSetup().catch(error => {
    console.error('Setup script failed:', error);
    process.exit(1);
  });
}

export { MissiveIntegrationSetup };