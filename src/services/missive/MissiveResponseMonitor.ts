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
        return;
      }

      // Get conversation from Missive using the draft ID
      const conversation = await this.missiveClient.getConversationByDraftId(
        emailJob.missiveDraftId
      );

      if (!conversation) {
        return;
      }

      // Check for recent messages that aren't from us
      const prospect = emailJob.prospectId as any;
      const prospectEmail = prospect.contactEmail || prospect.email;

      if (!prospectEmail) {
        return;
      }

      // Look for replies from the prospect
      const replies = await this.missiveClient.getConversationReplies(
        conversation.id,
        prospectEmail,
        emailJob.analytics?.sentAt || emailJob.createdAt
      );

      if (replies && replies.length > 0) {
        // Process the most recent reply
        const latestReply = replies[0];
        
        await this.responseAnalyzer.analyzeResponse(
          emailJob._id.toString(),
          latestReply.body || latestReply.preview,
          {
            timestamp: new Date(latestReply.created_at),
            fromEmail: latestReply.from,
            subject: conversation.subject
          }
        );

        logger.info(`Processed response for email job ${emailJob._id}`, {
          prospectEmail,
          responseLength: (latestReply.body || latestReply.preview).length
        });
      }

    } catch (error) {
      logger.error(`Failed to check email job ${emailJob._id} for response`, error);
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
      // Try to find by missive draft ID first (most reliable)
      // This would require storing the conversation ID when creating drafts
      
      // For now, try to match by prospect email and timeframe
      const participants = conversation.participants || [];
      const prospectEmails = participants
        .map((p: any) => p.email)
        .filter((email: string) => email && !this.isOurEmail(email));

      if (prospectEmails.length === 0) {
        return null;
      }

      // Look for recent email jobs to prospects with these emails
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 30); // Look back 30 days

      const emailJob = await EmailJobModel.findOne({
        status: 'completed',
        createdAt: { $gte: recentCutoff },
        'prospectId.contactEmail': { $in: prospectEmails }
      }).populate('prospectId');

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
    // In a full implementation, this would check against our domain(s)
    // For now, basic check for common patterns
    const lowerEmail = email.toLowerCase();
    return lowerEmail.includes('noreply') || 
           lowerEmail.includes('support') || 
           lowerEmail.includes('admin');
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    // In a full implementation, verify HMAC signature
    // For now, just check if signature exists
    return signature && signature.length > 0;
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