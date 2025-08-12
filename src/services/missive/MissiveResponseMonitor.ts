import { MissiveClient } from './MissiveClient';
import { EmailResponseAnalyzer } from '@/services/ai/EmailResponseAnalyzer';
import { EmailJobModel } from '@/models';
import { logger } from '@/utils/logger';

export interface MissiveWebhookEvent {
  type: string;
  conversation?: {
    id: string;
    subject: string;
    participants: Array<{
      email: string;
      name?: string;
    }>;
  };
  message?: {
    id: string;
    body: string;
    preview: string;
    from: string;
    created_at: string;
    author?: {
      email: string;
      name?: string;
    };
  };
}

export interface ResponseMonitorConfig {
  pollInterval: number; // milliseconds
  lookbackDays: number;
  enableWebhooks: boolean;
  webhookSecret?: string;
}

export class MissiveResponseMonitor {
  private missiveClient: MissiveClient;
  private responseAnalyzer: EmailResponseAnalyzer;
  private static instance: MissiveResponseMonitor;
  private isPolling: boolean = false;
  private pollInterval?: NodeJS.Timeout;

  private constructor() {
    this.missiveClient = MissiveClient.getInstance();
    this.responseAnalyzer = EmailResponseAnalyzer.getInstance();
  }

  public static getInstance(): MissiveResponseMonitor {
    if (!MissiveResponseMonitor.instance) {
      MissiveResponseMonitor.instance = new MissiveResponseMonitor();
    }
    return MissiveResponseMonitor.instance;
  }

  /**
   * Start monitoring for responses via polling
   */
  public startMonitoring(config: ResponseMonitorConfig): void {
    if (this.isPolling) {
      logger.warn('Response monitoring already started');
      return;
    }

    logger.info('Starting Missive response monitoring', { 
      pollInterval: config.pollInterval,
      lookbackDays: config.lookbackDays 
    });

    this.isPolling = true;
    this.pollInterval = setInterval(
      () => this.checkForNewResponses(config.lookbackDays),
      config.pollInterval
    );
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
    this.isPolling = false;
    logger.info('Stopped Missive response monitoring');
  }

  /**
   * Handle webhook from Missive
   */
  public async handleWebhook(
    event: MissiveWebhookEvent,
    signature?: string,
    secret?: string
  ): Promise<void> {
    try {
      // Verify webhook signature if provided
      if (signature && secret) {
        const isValid = this.verifyWebhookSignature(
          JSON.stringify(event),
          signature,
          secret
        );
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      logger.info('Processing Missive webhook', { 
        type: event.type,
        conversationId: event.conversation?.id 
      });

      // Only process message events that look like replies
      if (event.type === 'message_added' && event.message && event.conversation) {
        await this.processIncomingMessage(event.conversation, event.message);
      }

    } catch (error) {
      logger.error('Failed to handle Missive webhook', error);
      throw error;
    }
  }

  /**
   * Check for new responses by polling Missive conversations
   */
  private async checkForNewResponses(lookbackDays: number): Promise<void> {
    try {
      logger.debug('Checking for new responses');

      // Get recent email jobs that we sent but haven't analyzed responses for
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

      const emailJobs = await EmailJobModel.find({
        status: 'completed',
        'analytics.sentAt': { $gte: cutoffDate },
        'response.analyzedAt': { $exists: false }, // Haven't analyzed response yet
        missiveDraftId: { $exists: true, $ne: null }
      }).populate('prospectId');

      if (emailJobs.length === 0) {
        logger.debug('No email jobs to check for responses');
        return;
      }

      logger.info(`Checking ${emailJobs.length} email jobs for responses`);

      // Check each email job for responses
      for (const emailJob of emailJobs) {
        try {
          await this.checkEmailJobForResponse(emailJob);
          
          // Add small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          logger.warn(`Failed to check response for email job ${emailJob._id}`, error);
        }
      }

    } catch (error) {
      logger.error('Failed to check for new responses', error);
    }
  }

  /**
   * Check specific email job for response
   */
  private async checkEmailJobForResponse(emailJob: any): Promise<void> {
    try {
      if (!emailJob.missiveDraftId) {
        logger.debug(`Email job ${emailJob._id} has no Missive draft ID - skipping response check`);
        return;
      }

      // Check if email was actually sent
      if (!emailJob.analytics?.sentAt) {
        logger.debug(`Email job ${emailJob._id} was not sent yet - skipping response check`);
        return;
      }

      // Get conversation from Missive using the draft ID
      let conversation = null;
      try {
        conversation = await this.missiveClient.getConversationByDraftId(
          emailJob.missiveDraftId
        );
      } catch (conversationError) {
        logger.warn(`Failed to get conversation for draft ${emailJob.missiveDraftId}`, {
          emailJobId: emailJob._id,
          error: conversationError instanceof Error ? conversationError.message : 'Unknown error'
        });

        // If conversation lookup fails, try alternative correlation methods
        const prospect = emailJob.prospectId as any;
        const prospectEmail = prospect.contactEmail || prospect.email;

        if (prospectEmail) {
          try {
            // Try to find conversations by participant email
            const conversations = await this.missiveClient.findConversationsByParticipant(
              prospectEmail,
              10 // Limit to recent conversations
            );

            if (conversations.length > 0) {
              // Find the most recent conversation that could match our email
              conversation = conversations.find(conv => {
                const convDate = new Date(conv.created_at || conv.updated_at);
                const sentDate = emailJob.analytics.sentAt;
                const timeDiff = Math.abs(convDate.getTime() - sentDate.getTime());
                const oneDayMs = 24 * 60 * 60 * 1000;

                // Conversation should be within 1 day of when we sent the email
                return timeDiff <= oneDayMs;
              }) || conversations[0]; // Fallback to most recent

              if (conversation) {
                // Store the conversation ID for future reference
                await EmailJobModel.findByIdAndUpdate(emailJob._id, {
                  'response.metadata.conversationId': conversation.id
                });

                logger.info(`Found conversation via participant correlation`, {
                  emailJobId: emailJob._id,
                  conversationId: conversation.id,
                  prospectEmail
                });
              }
            }
          } catch (correlationError) {
            logger.error(`Failed to correlate conversation for email job ${emailJob._id}`, {
              prospectEmail,
              error: correlationError instanceof Error ? correlationError.message : 'Unknown error'
            });
          }
        }

        if (!conversation) {
          logger.debug(`No conversation found for email job ${emailJob._id} - email may not have been sent or replied to yet`);
          return;
        }
      }

      if (!conversation) {
        logger.debug(`No conversation available for email job ${emailJob._id}`);
        return;
      }

      // Check for recent messages that aren't from us
      const prospect = emailJob.prospectId as any;
      const prospectEmail = prospect.contactEmail || prospect.email;

      if (!prospectEmail) {
        logger.warn(`Email job ${emailJob._id} has no prospect email - cannot check for responses`);
        return;
      }

      // Look for replies from the prospect
      let replies = [];
      try {
        replies = await this.missiveClient.getConversationReplies(
          conversation.id,
          prospectEmail,
          emailJob.analytics.sentAt
        );
      } catch (repliesError) {
        logger.error(`Failed to get conversation replies for ${conversation.id}`, {
          emailJobId: emailJob._id,
          prospectEmail,
          error: repliesError instanceof Error ? repliesError.message : 'Unknown error'
        });
        return;
      }

      if (replies && replies.length > 0) {
        // Process the most recent reply
        const latestReply = replies[0];
        
        try {
          await this.responseAnalyzer.analyzeResponse(
            emailJob._id.toString(),
            latestReply.body || latestReply.preview,
            {
              timestamp: new Date(latestReply.created_at),
              fromEmail: latestReply.from,
              subject: conversation.subject,
              conversationId: conversation.id,
              messageId: latestReply.id,
              webhookSource: 'polling'
            }
          );

          logger.info(`Processed response for email job ${emailJob._id}`, {
            prospectEmail,
            conversationId: conversation.id,
            responseLength: (latestReply.body || latestReply.preview).length,
            responseDate: latestReply.created_at
          });
        } catch (analysisError) {
          logger.error(`Failed to analyze response for email job ${emailJob._id}`, {
            conversationId: conversation.id,
            messageId: latestReply.id,
            error: analysisError instanceof Error ? analysisError.message : 'Unknown error'
          });
        }
      } else {
        logger.debug(`No replies found for email job ${emailJob._id}`, {
          conversationId: conversation.id,
          prospectEmail,
          sentAt: emailJob.analytics.sentAt.toISOString()
        });
      }

    } catch (error) {
      logger.error(`Failed to check email job ${emailJob._id} for response`, {
        emailJobId: emailJob._id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Mark the email job as having a response check error, but don't fail completely
      try {
        await EmailJobModel.findByIdAndUpdate(emailJob._id, {
          'response.lastCheckError': error instanceof Error ? error.message : 'Unknown error',
          'response.lastCheckedAt': new Date()
        });
      } catch (updateError) {
        logger.error(`Failed to update email job error status for ${emailJob._id}`, updateError);
      }
    }
  }

  /**
   * Process incoming message from webhook
   */
  private async processIncomingMessage(conversation: any, message: any): Promise<void> {
    try {
      // Find the email job associated with this conversation
      const emailJob = await this.findEmailJobByConversation(conversation, message);
      
      if (!emailJob) {
        logger.debug('No email job found for conversation', { 
          conversationId: conversation.id,
          subject: conversation.subject
        });
        return;
      }

      // Check if this message is from the prospect (not from us)
      const prospect = emailJob.prospectId as any;
      const isFromProspect = this.isMessageFromProspect(message, prospect);

      if (!isFromProspect) {
        logger.debug('Message is not from prospect, ignoring', {
          from: message.from,
          prospectEmail: prospect.contactEmail
        });
        return;
      }

      // Analyze the response
      await this.responseAnalyzer.analyzeResponse(
        emailJob._id.toString(),
        message.body || message.preview,
        {
          timestamp: new Date(message.created_at),
          fromEmail: message.from,
          subject: conversation.subject
        }
      );

      logger.info('Processed webhook response', {
        emailJobId: emailJob._id,
        conversationId: conversation.id,
        from: message.from
      });

    } catch (error) {
      logger.error('Failed to process incoming message', error);
    }
  }

  /**
   * Find email job by conversation data
   */
  private async findEmailJobByConversation(conversation: any, message: any): Promise<any> {
    try {
      // Strategy 1: Try to find by stored conversation/draft correlation
      if (conversation.id) {
        const emailJob = await EmailJobModel.findOne({
          'response.metadata.conversationId': conversation.id
        }).populate('prospectId');
        
        if (emailJob) {
          logger.debug(`Found email job by conversation ID: ${conversation.id}`);
          return emailJob;
        }
      }

      // Strategy 2: Try to match by prospect email and conversation subject
      const participants = conversation.participants || [];
      const prospectEmails = participants
        .map((p: any) => p.email?.address || p.email)
        .filter((email: string) => email && !this.isOurEmail(email));

      if (prospectEmails.length === 0) {
        logger.debug('No prospect emails found in conversation participants');
        return null;
      }

      // Look for recent email jobs to prospects with these emails
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 30); // Look back 30 days

      // Find prospects with matching emails
      const { ProspectModel } = await import('@/models');
      const prospects = await ProspectModel.find({
        contactEmail: { $in: prospectEmails }
      });

      if (prospects.length === 0) {
        logger.debug(`No prospects found with emails: ${prospectEmails.join(', ')}`);
        return null;
      }

      const prospectIds = prospects.map(p => p._id);

      // Find the most recent email job for these prospects
      const emailJob = await EmailJobModel.findOne({
        status: 'completed',
        prospectId: { $in: prospectIds },
        createdAt: { $gte: recentCutoff },
        'response.analyzedAt': { $exists: false } // Not already analyzed
      })
      .populate('prospectId')
      .sort({ createdAt: -1 }); // Most recent first

      if (emailJob) {
        logger.debug(`Found email job by prospect correlation: ${emailJob._id}`);
        
        // Store conversation ID for future correlation
        await EmailJobModel.findByIdAndUpdate(emailJob._id, {
          'response.metadata.conversationId': conversation.id
        });
      }

      return emailJob;

    } catch (error) {
      logger.error('Failed to find email job by conversation', error);
      return null;
    }
  }

  /**
   * Check if message is from the prospect
   */
  private isMessageFromProspect(message: any, prospect: any): boolean {
    const messageFrom = message.from?.toLowerCase() || message.author?.email?.toLowerCase();
    const prospectEmail = (prospect.contactEmail || prospect.email)?.toLowerCase();
    
    return messageFrom === prospectEmail;
  }

  /**
   * Check if email is from our organization
   */
  private isOurEmail(email: string): boolean {
    if (!email) return false;
    
    const lowerEmail = email.toLowerCase();
    
    // Get our organization's domains from config or environment
    const ourDomains = this.getOrganizationDomains();
    
    // Check if the email domain matches any of our domains
    for (const domain of ourDomains) {
      if (lowerEmail.endsWith(`@${domain.toLowerCase()}`)) {
        return true;
      }
    }
    
    // Common organizational email patterns
    const organizationalPatterns = [
      'noreply',
      'no-reply', 
      'support',
      'admin',
      'hello',
      'info',
      'contact',
      'team'
    ];
    
    return organizationalPatterns.some(pattern => 
      lowerEmail.includes(`${pattern}@`) || lowerEmail.includes(`@${pattern}`)
    );
  }
  
  /**
   * Get organization domains from configuration
   */
  private getOrganizationDomains(): string[] {
    try {
      // Try to get from config first
      const { config } = require('@/config');
      if (config.organization?.domains) {
        return config.organization.domains;
      }
      
      // Fallback to environment variable
      const domainsEnv = process.env.ORGANIZATION_DOMAINS;
      if (domainsEnv) {
        return domainsEnv.split(',').map(d => d.trim());
      }
      
      // Default fallback - should be configured in production
      return ['example.com'];
      
    } catch (error) {
      logger.warn('Failed to get organization domains, using default', error);
      return ['example.com'];
    }
  }

  /**
   * Verify webhook signature using HMAC SHA-256
   */
  private verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      logger.warn('Webhook signature or secret missing');
      return false;
    }

    try {
      const crypto = require('crypto');
      
      // Compute HMAC SHA-256 signature
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
      
      const expectedSignature = `sha256=${computedSignature}`;
      
      // Use timing-attack-resistant comparison
      const signaturesMatch = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
      
      if (!signaturesMatch) {
        logger.warn('Webhook signature verification failed', {
          expected: expectedSignature,
          received: signature
        });
      }
      
      return signaturesMatch;
      
    } catch (error) {
      logger.error('Failed to verify webhook signature', error);
      return false;
    }
  }

  /**
   * Get response monitoring statistics
   */
  public async getMonitoringStats(): Promise<{
    totalEmailsMonitored: number;
    responsesDetected: number;
    responseRate: number;
    avgResponseTime: number;
    monitoringStatus: string;
  }> {
    try {
      const totalEmailsMonitored = await EmailJobModel.countDocuments({
        status: 'completed',
        'analytics.sentAt': { $exists: true }
      });

      const responsesDetected = await EmailJobModel.countDocuments({
        'response.analyzedAt': { $exists: true }
      });

      const responseRate = totalEmailsMonitored > 0 ? 
        responsesDetected / totalEmailsMonitored : 0;

      // Calculate average response time from email jobs with responses
      const emailsWithResponses = await EmailJobModel.find({
        'response.analyzedAt': { $exists: true },
        'analytics.sentAt': { $exists: true }
      }).select('analytics.sentAt response.metadata.timestamp');

      let avgResponseTime = 0;
      if (emailsWithResponses.length > 0) {
        const totalResponseTime = emailsWithResponses.reduce((sum, job) => {
          const sentAt = job.analytics?.sentAt;
          const respondedAt = job.response?.metadata?.timestamp;
          if (sentAt && respondedAt) {
            return sum + (respondedAt.getTime() - sentAt.getTime());
          }
          return sum;
        }, 0);
        
        avgResponseTime = Math.round(totalResponseTime / emailsWithResponses.length / (1000 * 60 * 60)); // Convert to hours
      }

      return {
        totalEmailsMonitored,
        responsesDetected,
        responseRate: Math.round(responseRate * 100) / 100,
        avgResponseTime,
        monitoringStatus: this.isPolling ? 'active' : 'inactive'
      };

    } catch (error) {
      logger.error('Failed to get monitoring stats', error);
      throw error;
    }
  }

  /**
   * Manual check for responses (for testing/admin use)
   */
  public async manualResponseCheck(emailJobId: string): Promise<boolean> {
    try {
      const emailJob = await EmailJobModel.findById(emailJobId).populate('prospectId');
      if (!emailJob) {
        throw new Error(`Email job not found: ${emailJobId}`);
      }

      await this.checkEmailJobForResponse(emailJob);
      return true;

    } catch (error) {
      logger.error(`Manual response check failed for job: ${emailJobId}`, error);
      throw error;
    }
  }
}