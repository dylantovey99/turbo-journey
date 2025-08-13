import { config } from '@/config';
import { MissiveClient } from '@/services/missive/MissiveClient';
import { logger } from '@/utils/logger';
import mongoose from 'mongoose';

export interface ValidationResult {
  valid: boolean;
  service: string;
  details: string;
  severity: 'error' | 'warning' | 'info';
  remedy?: string;
}

export interface SystemValidationReport {
  overallStatus: 'healthy' | 'warning' | 'critical';
  validationResults: ValidationResult[];
  missingConfigurations: string[];
  warnings: string[];
  recommendations: string[];
}

export class ConfigurationValidator {
  private static instance: ConfigurationValidator;

  private constructor() {}

  public static getInstance(): ConfigurationValidator {
    if (!ConfigurationValidator.instance) {
      ConfigurationValidator.instance = new ConfigurationValidator();
    }
    return ConfigurationValidator.instance;
  }

  /**
   * Validate complete system configuration and connectivity
   */
  public async validateSystemConfiguration(): Promise<SystemValidationReport> {
    logger.info('Starting system configuration validation');

    const validationResults: ValidationResult[] = [];
    const missingConfigurations: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // 1. Validate Missive configuration
    const missiveValidation = await this.validateMissiveConfiguration();
    validationResults.push(...missiveValidation.results);
    missingConfigurations.push(...missiveValidation.missing);
    warnings.push(...missiveValidation.warnings);
    recommendations.push(...missiveValidation.recommendations);

    // 2. Validate database connectivity
    const dbValidation = await this.validateDatabaseConfiguration();
    validationResults.push(...dbValidation.results);
    missingConfigurations.push(...dbValidation.missing);
    warnings.push(...dbValidation.warnings);

    // 3. Validate AI services configuration
    const aiValidation = await this.validateAIConfiguration();
    validationResults.push(...aiValidation.results);
    missingConfigurations.push(...aiValidation.missing);
    warnings.push(...aiValidation.warnings);

    // 4. Validate webhook configuration
    const webhookValidation = this.validateWebhookConfiguration();
    validationResults.push(...webhookValidation.results);
    missingConfigurations.push(...webhookValidation.missing);
    warnings.push(...webhookValidation.warnings);
    recommendations.push(...webhookValidation.recommendations);

    // 5. Determine overall status
    const hasErrors = validationResults.some(r => r.severity === 'error');
    const hasWarnings = validationResults.some(r => r.severity === 'warning') || warnings.length > 0;

    const overallStatus = hasErrors ? 'critical' : hasWarnings ? 'warning' : 'healthy';

    const report: SystemValidationReport = {
      overallStatus,
      validationResults,
      missingConfigurations,
      warnings,
      recommendations
    };

    logger.info('System configuration validation completed', {
      overallStatus,
      errors: validationResults.filter(r => r.severity === 'error').length,
      warnings: validationResults.filter(r => r.severity === 'warning').length,
      missing: missingConfigurations.length
    });

    return report;
  }

  /**
   * Validate Missive API configuration and connectivity
   */
  private async validateMissiveConfiguration(): Promise<{
    results: ValidationResult[];
    missing: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const results: ValidationResult[] = [];
    const missing: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check required configuration
    if (!config.missive?.apiToken) {
      missing.push('MISSIVE_API_TOKEN');
      results.push({
        valid: false,
        service: 'Missive API',
        details: 'Missive API token is not configured',
        severity: 'error',
        remedy: 'Set MISSIVE_API_TOKEN environment variable'
      });
    } else {
      // Test API connectivity
      try {
        const missiveClient = MissiveClient.getInstance();
        const isHealthy = await missiveClient.healthCheck();
        
        if (isHealthy) {
          results.push({
            valid: true,
            service: 'Missive API',
            details: 'API connectivity verified',
            severity: 'info'
          });

          // Test account access
          try {
            const accountInfo = await missiveClient.getAccountInfo();
            results.push({
              valid: true,
              service: 'Missive Account',
              details: `Account access verified: ${accountInfo.name || 'Unknown'}`,
              severity: 'info'
            });
          } catch (accountError) {
            results.push({
              valid: false,
              service: 'Missive Account',
              details: 'Cannot access account information. Check API token permissions.',
              severity: 'warning',
              remedy: 'Verify API token has account:read permissions'
            });
            warnings.push('Missive account access limited');
          }

        } else {
          results.push({
            valid: false,
            service: 'Missive API',
            details: 'API health check failed',
            severity: 'error',
            remedy: 'Check API token validity and network connectivity'
          });
        }
      } catch (error) {
        results.push({
          valid: false,
          service: 'Missive API',
          details: `API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
          remedy: 'Verify API token and network connectivity'
        });
      }
    }

    if (!config.missive?.baseUrl) {
      missing.push('MISSIVE_BASE_URL');
      warnings.push('Using default Missive API URL');
    }

    if (!config.missive?.defaultAccountId) {
      missing.push('MISSIVE_DEFAULT_ACCOUNT_ID');
      warnings.push('No default account ID configured');
      recommendations.push('Set MISSIVE_DEFAULT_ACCOUNT_ID for improved performance');
    }

    return { results, missing, warnings, recommendations };
  }

  /**
   * Validate database configuration and connectivity
   */
  private async validateDatabaseConfiguration(): Promise<{
    results: ValidationResult[];
    missing: string[];
    warnings: string[];
  }> {
    const results: ValidationResult[] = [];
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check database connection string
    if (!process.env.MONGODB_URI && !process.env.DATABASE_URL) {
      missing.push('MONGODB_URI or DATABASE_URL');
      results.push({
        valid: false,
        service: 'Database',
        details: 'Database connection string not configured',
        severity: 'error',
        remedy: 'Set MONGODB_URI or DATABASE_URL environment variable'
      });
    } else {
      // Test database connectivity
      try {
        
        if (mongoose.connection.readyState === 1) {
          results.push({
            valid: true,
            service: 'Database',
            details: 'Database connection active',
            severity: 'info'
          });

          // Test model access
          try {
            const { EmailJobModel } = await import('@/models');
            const count = await EmailJobModel.countDocuments({});
            
            results.push({
              valid: true,
              service: 'Database Models',
              details: `Database models accessible. ${count} email jobs in database.`,
              severity: 'info'
            });
          } catch (modelError) {
            results.push({
              valid: false,
              service: 'Database Models',
              details: 'Cannot access database models',
              severity: 'error',
              remedy: 'Check database schema and model definitions'
            });
          }

        } else {
          results.push({
            valid: false,
            service: 'Database',
            details: 'Database connection not established',
            severity: 'error',
            remedy: 'Check database connection string and network connectivity'
          });
        }
      } catch (error) {
        results.push({
          valid: false,
          service: 'Database',
          details: `Database connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
          remedy: 'Verify database connection string and network access'
        });
      }
    }

    return { results, missing, warnings };
  }

  /**
   * Validate AI services configuration
   */
  private async validateAIConfiguration(): Promise<{
    results: ValidationResult[];
    missing: string[];
    warnings: string[];
  }> {
    const results: ValidationResult[] = [];
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check Claude API configuration
    if (!process.env.ANTHROPIC_API_KEY) {
      missing.push('ANTHROPIC_API_KEY');
      results.push({
        valid: false,
        service: 'Claude AI',
        details: 'Anthropic API key not configured',
        severity: 'error',
        remedy: 'Set ANTHROPIC_API_KEY environment variable'
      });
    } else {
      // Test Claude API connectivity
      try {
        const { ClaudeClient } = await import('@/services/ai/ClaudeClient');
        const claudeClient = ClaudeClient.getInstance();
        
        // Simple test call
        const testResponse = await claudeClient.createMessage([
          { role: 'user', content: 'Hello' }
        ], { maxTokens: 10 });

        if (testResponse) {
          results.push({
            valid: true,
            service: 'Claude AI',
            details: 'Claude API connectivity verified',
            severity: 'info'
          });
        }
      } catch (error) {
        results.push({
          valid: false,
          service: 'Claude AI',
          details: `Claude API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'error',
          remedy: 'Verify Anthropic API key and network connectivity'
        });
      }
    }

    return { results, missing, warnings };
  }

  /**
   * Validate webhook configuration
   */
  private validateWebhookConfiguration(): {
    results: ValidationResult[];
    missing: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const results: ValidationResult[] = [];
    const missing: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check webhook secret
    if (!config.missive?.webhookSecret) {
      missing.push('MISSIVE_WEBHOOK_SECRET');
      results.push({
        valid: false,
        service: 'Webhook Security',
        details: 'Webhook secret not configured',
        severity: 'warning',
        remedy: 'Set MISSIVE_WEBHOOK_SECRET for secure webhook handling'
      });
      warnings.push('Webhooks will not be secure without secret');
    } else {
      results.push({
        valid: true,
        service: 'Webhook Security',
        details: 'Webhook secret configured',
        severity: 'info'
      });
    }

    // Check organization domains
    if (!process.env.ORGANIZATION_DOMAINS) {
      missing.push('ORGANIZATION_DOMAINS');
      warnings.push('Organization domains not configured - reply filtering may be inaccurate');
      recommendations.push('Set ORGANIZATION_DOMAINS to improve reply detection accuracy');
    } else {
      results.push({
        valid: true,
        service: 'Organization Domains',
        details: 'Organization domains configured for reply filtering',
        severity: 'info'
      });
    }

    // Check webhook endpoint accessibility
    recommendations.push('Ensure webhook endpoint is publicly accessible at /api/webhooks/missive');
    recommendations.push('Configure webhook URL in Missive dashboard to enable real-time response notifications');

    return { results, missing, warnings, recommendations };
  }

  /**
   * Generate setup instructions based on validation results
   */
  public generateSetupInstructions(report: SystemValidationReport): {
    criticalActions: string[];
    recommendedActions: string[];
    configurationSteps: Array<{
      step: number;
      title: string;
      description: string;
      commands?: string[];
    }>;
  } {
    const criticalActions: string[] = [];
    const recommendedActions: string[] = [];

    // Extract critical actions from error results
    report.validationResults
      .filter(r => r.severity === 'error' && r.remedy)
      .forEach(r => criticalActions.push(r.remedy!));

    // Extract recommended actions from warnings and recommendations
    report.validationResults
      .filter(r => r.severity === 'warning' && r.remedy)
      .forEach(r => recommendedActions.push(r.remedy!));

    recommendedActions.push(...report.recommendations);

    // Generate step-by-step configuration
    const configurationSteps = [
      {
        step: 1,
        title: 'Environment Variables',
        description: 'Set required environment variables for API access',
        commands: [
          'cp .env.example .env',
          'nano .env  # Edit with your actual values',
          ...report.missingConfigurations.map(config => `# Add ${config}=your_value_here`)
        ]
      },
      {
        step: 2,
        title: 'Database Setup',
        description: 'Ensure MongoDB is running and accessible',
        commands: [
          'mongosh  # Test database connectivity',
          'npm run db:migrate  # Run any pending migrations'
        ]
      },
      {
        step: 3,
        title: 'Missive Configuration',
        description: 'Configure Missive API integration',
        commands: [
          '# 1. Generate API token in Missive settings',
          '# 2. Add webhook endpoint: https://your-domain.com/api/webhooks/missive',
          '# 3. Subscribe to events: message_added, conversation_updated',
          '# 4. Set webhook secret and add to MISSIVE_WEBHOOK_SECRET'
        ]
      },
      {
        step: 4,
        title: 'Test Configuration',
        description: 'Verify all services are working',
        commands: [
          'curl http://localhost:3000/api/webhooks/missive/health',
          'npm run test:config  # If available'
        ]
      }
    ];

    return {
      criticalActions,
      recommendedActions,
      configurationSteps
    };
  }
}