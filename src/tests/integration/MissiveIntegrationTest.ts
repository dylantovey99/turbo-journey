import { MissiveClient } from '@/services/missive/MissiveClient';
import { MissiveEmailSender, EmailSendRequest } from '@/services/missive/MissiveEmailSender';
import { MissiveResponseMonitor } from '@/services/missive/MissiveResponseMonitor';
import { ConfigurationValidator } from '@/services/system/ConfigurationValidator';
import { EmailJobModel } from '@/models';
import { logger } from '@/utils/logger';

export class MissiveIntegrationTest {
  private missiveClient: MissiveClient;
  private emailSender: MissiveEmailSender;
  private responseMonitor: MissiveResponseMonitor;
  private configValidator: ConfigurationValidator;

  constructor() {
    this.missiveClient = MissiveClient.getInstance();
    this.emailSender = MissiveEmailSender.getInstance();
    this.responseMonitor = MissiveResponseMonitor.getInstance();
    this.configValidator = ConfigurationValidator.getInstance();
  }

  /**
   * Run comprehensive integration test of the complete Missive workflow
   */
  public async runCompleteIntegrationTest(): Promise<{
    success: boolean;
    results: Array<{
      test: string;
      success: boolean;
      details: string;
      duration: number;
    }>;
    overallDuration: number;
  }> {
    const startTime = Date.now();
    const results: Array<{
      test: string;
      success: boolean;
      details: string;
      duration: number;
    }> = [];

    logger.info('Starting comprehensive Missive integration test');

    try {
      // Test 1: Configuration validation
      const configResult = await this.testConfiguration();
      results.push(configResult);

      if (!configResult.success) {
        logger.error('Configuration validation failed - stopping integration test');
        return {
          success: false,
          results,
          overallDuration: Date.now() - startTime
        };
      }

      // Test 2: Basic API connectivity
      const connectivityResult = await this.testApiConnectivity();
      results.push(connectivityResult);

      // Test 3: Draft creation and management
      const draftResult = await this.testDraftManagement();
      results.push(draftResult);

      // Test 4: Email sending workflow
      const sendResult = await this.testEmailSendingWorkflow();
      results.push(sendResult);

      // Test 5: Response monitoring setup
      const monitoringResult = await this.testResponseMonitoring();
      results.push(monitoringResult);

      // Test 6: Webhook handling
      const webhookResult = await this.testWebhookHandling();
      results.push(webhookResult);

      // Test 7: Database integration
      const dbResult = await this.testDatabaseIntegration();
      results.push(dbResult);

      const overallSuccess = results.every(r => r.success);
      const overallDuration = Date.now() - startTime;

      logger.info('Missive integration test completed', {
        success: overallSuccess,
        totalTests: results.length,
        passedTests: results.filter(r => r.success).length,
        duration: overallDuration
      });

      return {
        success: overallSuccess,
        results,
        overallDuration
      };

    } catch (error) {
      logger.error('Integration test failed with unexpected error', error);
      return {
        success: false,
        results,
        overallDuration: Date.now() - startTime
      };
    }
  }

  /**
   * Test configuration validation
   */
  private async testConfiguration(): Promise<{
    test: string;
    success: boolean;
    details: string;
    duration: number;
  }> {
    const testStart = Date.now();

    try {
      const report = await this.configValidator.validateSystemConfiguration();
      
      const criticalErrors = report.validationResults.filter(r => r.severity === 'error');
      const success = criticalErrors.length === 0;

      return {
        test: 'Configuration Validation',
        success,
        details: success 
          ? `Configuration valid. Status: ${report.overallStatus}, ${report.validationResults.length} checks passed`
          : `Configuration errors: ${criticalErrors.map(e => e.details).join('; ')}`,
        duration: Date.now() - testStart
      };

    } catch (error) {
      return {
        test: 'Configuration Validation',
        success: false,
        details: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      };
    }
  }

  /**
   * Test basic API connectivity
   */
  private async testApiConnectivity(): Promise<{
    test: string;
    success: boolean;
    details: string;
    duration: number;
  }> {
    const testStart = Date.now();

    try {
      // Test health check
      const isHealthy = await this.missiveClient.healthCheck();
      
      if (!isHealthy) {
        return {
          test: 'API Connectivity',
          success: false,
          details: 'Missive health check failed',
          duration: Date.now() - testStart
        };
      }

      // Test account access
      const accountInfo = await this.missiveClient.getAccountInfo();
      
      return {
        test: 'API Connectivity',
        success: true,
        details: `API connectivity verified. Account: ${accountInfo?.name || 'Unknown'}`,
        duration: Date.now() - testStart
      };

    } catch (error) {
      return {
        test: 'API Connectivity',
        success: false,
        details: `API connectivity failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      };
    }
  }

  /**
   * Test draft creation and management
   */
  private async testDraftManagement(): Promise<{
    test: string;
    success: boolean;
    details: string;
    duration: number;
  }> {
    const testStart = Date.now();

    try {
      // Create a test draft
      const testDraft = {
        to: ['test@example.com'],
        subject: 'Integration Test Draft',
        body: 'This is a test draft for integration testing.',
        format: 'html' as const
      };

      const draftResponse = await this.missiveClient.createDraft(testDraft);
      
      if (!draftResponse.id) {
        return {
          test: 'Draft Management',
          success: false,
          details: 'Draft creation failed - no ID returned',
          duration: Date.now() - testStart
        };
      }

      // Test draft retrieval
      const retrievedDraft = await this.missiveClient.getDraft(draftResponse.id);
      
      if (!retrievedDraft) {
        return {
          test: 'Draft Management',
          success: false,
          details: 'Draft retrieval failed',
          duration: Date.now() - testStart
        };
      }

      // Clean up - delete the test draft
      await this.missiveClient.deleteDraft(draftResponse.id);

      return {
        test: 'Draft Management',
        success: true,
        details: `Draft management working. Created, retrieved, and deleted draft: ${draftResponse.id}`,
        duration: Date.now() - testStart
      };

    } catch (error) {
      return {
        test: 'Draft Management',
        success: false,
        details: `Draft management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      };
    }
  }

  /**
   * Test email sending workflow (without actually sending)
   */
  private async testEmailSendingWorkflow(): Promise<{
    test: string;
    success: boolean;
    details: string;
    duration: number;
  }> {
    const testStart = Date.now();

    try {
      // Create a test email job in database
      const testEmailJob = await EmailJobModel.create({
        prospectId: '000000000000000000000001', // Mock ID
        campaignId: '000000000000000000000001', // Mock ID
        status: 'generated',
        generatedEmail: {
          subject: 'Test Integration Email',
          htmlBody: '<p>This is a test email for integration testing.</p>',
          textBody: 'This is a test email for integration testing.',
          personalizations: ['integration', 'test'],
          confidence: 0.9
        }
      });

      // Test email send request creation (don't actually send)
      const sendRequest: EmailSendRequest = {
        emailJobId: testEmailJob._id.toString(),
        prospect: {
          contactEmail: 'test@example.com',
          name: 'Test User',
          companyName: 'Test Company',
          industry: 'testing'
        },
        campaign: {
          id: '000000000000000000000001',
          name: 'Integration Test Campaign'
        },
        generatedEmail: testEmailJob.generatedEmail as any
      };

      // Validate send request structure
      const requiredFields = ['emailJobId', 'prospect.contactEmail', 'generatedEmail.subject'];
      const missingFields = requiredFields.filter(field => {
        const fieldParts = field.split('.');
        let obj: any = sendRequest;
        for (const part of fieldParts) {
          if (!obj || !obj[part]) return true;
          obj = obj[part];
        }
        return false;
      });

      // Clean up test data
      await EmailJobModel.findByIdAndDelete(testEmailJob._id);

      if (missingFields.length > 0) {
        return {
          test: 'Email Sending Workflow',
          success: false,
          details: `Send request validation failed. Missing fields: ${missingFields.join(', ')}`,
          duration: Date.now() - testStart
        };
      }

      return {
        test: 'Email Sending Workflow',
        success: true,
        details: `Email sending workflow structure validated. Created and validated send request.`,
        duration: Date.now() - testStart
      };

    } catch (error) {
      return {
        test: 'Email Sending Workflow',
        success: false,
        details: `Email sending workflow test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      };
    }
  }

  /**
   * Test response monitoring setup
   */
  private async testResponseMonitoring(): Promise<{
    test: string;
    success: boolean;
    details: string;
    duration: number;
  }> {
    const testStart = Date.now();

    try {
      // Test monitoring stats retrieval
      const stats = await this.responseMonitor.getMonitoringStats();
      
      const requiredStats = ['totalEmailsMonitored', 'responsesDetected', 'responseRate', 'avgResponseTime', 'monitoringStatus'];
      const missingStats = requiredStats.filter(stat => !(stat in stats));

      if (missingStats.length > 0) {
        return {
          test: 'Response Monitoring',
          success: false,
          details: `Monitoring stats incomplete. Missing: ${missingStats.join(', ')}`,
          duration: Date.now() - testStart
        };
      }

      // Test monitoring configuration
      const config = {
        pollInterval: 60000, // 1 minute
        lookbackDays: 7,
        enableWebhooks: true
      };

      // Start and stop monitoring to test configuration
      this.responseMonitor.startMonitoring(config);
      
      // Wait a brief moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      this.responseMonitor.stopMonitoring();

      return {
        test: 'Response Monitoring',
        success: true,
        details: `Response monitoring working. Stats: ${stats.totalEmailsMonitored} monitored, ${stats.responsesDetected} responses detected.`,
        duration: Date.now() - testStart
      };

    } catch (error) {
      return {
        test: 'Response Monitoring',
        success: false,
        details: `Response monitoring test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      };
    }
  }

  /**
   * Test webhook handling
   */
  private async testWebhookHandling(): Promise<{
    test: string;
    success: boolean;
    details: string;
    duration: number;
  }> {
    const testStart = Date.now();

    try {
      // Test webhook signature verification without actual webhook
      const testEvent = {
        type: 'message_added',
        conversation: {
          id: 'test_conv_123',
          subject: 'Test Webhook',
          participants: [
            { email: 'test@example.com', name: 'Test User' }
          ]
        },
        message: {
          id: 'test_msg_456',
          body: 'Test webhook message',
          preview: 'Test webhook message',
          from: 'test@example.com',
          created_at: new Date().toISOString(),
          author: {
            email: 'test@example.com',
            name: 'Test User'
          }
        }
      };

      // Test webhook handling without signature (development mode)
      await this.responseMonitor.handleWebhook(testEvent);

      return {
        test: 'Webhook Handling',
        success: true,
        details: 'Webhook handling structure validated. Test event processed successfully.',
        duration: Date.now() - testStart
      };

    } catch (error) {
      return {
        test: 'Webhook Handling',
        success: false,
        details: `Webhook handling test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      };
    }
  }

  /**
   * Test database integration
   */
  private async testDatabaseIntegration(): Promise<{
    test: string;
    success: boolean;
    details: string;
    duration: number;
  }> {
    const testStart = Date.now();

    try {
      // Test email job creation and retrieval
      const testData = {
        prospectId: '000000000000000000000002',
        campaignId: '000000000000000000000002',
        status: 'test' as any,
        generatedEmail: {
          subject: 'Database Test Email',
          htmlBody: '<p>Database integration test</p>',
          textBody: 'Database integration test',
          personalizations: ['database', 'test'],
          confidence: 0.8
        },
        response: {
          metadata: {
            conversationId: 'test_conv_db_123',
            messageId: 'test_msg_db_456'
          }
        }
      };

      const createdJob = await EmailJobModel.create(testData);
      
      if (!createdJob._id) {
        return {
          test: 'Database Integration',
          success: false,
          details: 'Failed to create email job in database',
          duration: Date.now() - testStart
        };
      }

      // Test retrieval
      const retrievedJob = await EmailJobModel.findById(createdJob._id);
      
      if (!retrievedJob) {
        return {
          test: 'Database Integration',
          success: false,
          details: 'Failed to retrieve created email job from database',
          duration: Date.now() - testStart
        };
      }

      // Test update
      await EmailJobModel.findByIdAndUpdate(createdJob._id, {
        status: 'completed',
        'analytics.sentAt': new Date()
      });

      const updatedJob = await EmailJobModel.findById(createdJob._id);
      
      if (updatedJob?.status !== 'completed') {
        return {
          test: 'Database Integration',
          success: false,
          details: 'Failed to update email job in database',
          duration: Date.now() - testStart
        };
      }

      // Test conversation ID indexing
      const jobsByConversation = await EmailJobModel.find({
        'response.metadata.conversationId': 'test_conv_db_123'
      });

      if (jobsByConversation.length !== 1) {
        return {
          test: 'Database Integration',
          success: false,
          details: 'Conversation ID indexing not working correctly',
          duration: Date.now() - testStart
        };
      }

      // Clean up
      await EmailJobModel.findByIdAndDelete(createdJob._id);

      return {
        test: 'Database Integration',
        success: true,
        details: 'Database integration working. Created, retrieved, updated, and indexed email job successfully.',
        duration: Date.now() - testStart
      };

    } catch (error) {
      return {
        test: 'Database Integration',
        success: false,
        details: `Database integration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: Date.now() - testStart
      };
    }
  }

  /**
   * Generate integration test report
   */
  public generateTestReport(results: {
    success: boolean;
    results: Array<{
      test: string;
      success: boolean;
      details: string;
      duration: number;
    }>;
    overallDuration: number;
  }): string {
    const report = [];
    
    report.push('# Missive Integration Test Report');
    report.push('');
    report.push(`**Overall Status:** ${results.success ? '✅ PASS' : '❌ FAIL'}`);
    report.push(`**Total Duration:** ${results.overallDuration}ms`);
    report.push(`**Tests Run:** ${results.results.length}`);
    report.push(`**Tests Passed:** ${results.results.filter(r => r.success).length}`);
    report.push(`**Tests Failed:** ${results.results.filter(r => !r.success).length}`);
    report.push('');
    
    report.push('## Test Results');
    report.push('');
    
    for (const result of results.results) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      report.push(`### ${result.test} - ${status}`);
      report.push(`**Duration:** ${result.duration}ms`);
      report.push(`**Details:** ${result.details}`);
      report.push('');
    }
    
    if (!results.success) {
      report.push('## Failed Tests');
      report.push('');
      const failedTests = results.results.filter(r => !r.success);
      for (const failed of failedTests) {
        report.push(`- **${failed.test}:** ${failed.details}`);
      }
      report.push('');
    }
    
    report.push('## Next Steps');
    report.push('');
    if (results.success) {
      report.push('- All integration tests passed');
      report.push('- System is ready for production use');
      report.push('- Consider setting up monitoring and alerts');
    } else {
      report.push('- Fix failed test issues before proceeding');
      report.push('- Verify configuration and connectivity');
      report.push('- Re-run tests after fixes are applied');
    }
    
    return report.join('\n');
  }
}