import { MissiveClient } from './MissiveClient';
import { ConversionTracker } from '@/services/ai/ConversionTracker';
import { EmailJobModel } from '@/models';
import { logger } from '@/utils/logger';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  conversationId?: string;
  sentAt?: Date;
  error?: string;
}

export interface EmailSendRequest {
  emailJobId: string;
  prospect: {
    contactEmail: string;
    name?: string;
    companyName?: string;
    industry?: string;
  };
  campaign: {
    id: string;
    name: string;
  };
  generatedEmail: {
    subject: string;
    htmlBody: string;
    textBody: string;
    personalizations: string[];
    psychologicalTriggers?: string[];
  };
  sendOptions?: {
    scheduleFor?: Date;
    trackOpens?: boolean;
    trackClicks?: boolean;
  };
}

export class MissiveEmailSender {
  private missiveClient: MissiveClient;
  private conversionTracker: ConversionTracker;
  private static instance: MissiveEmailSender;

  private constructor() {
    this.missiveClient = MissiveClient.getInstance();
    this.conversionTracker = ConversionTracker.getInstance();
  }

  public static getInstance(): MissiveEmailSender {
    if (!MissiveEmailSender.instance) {
      MissiveEmailSender.instance = new MissiveEmailSender();
    }
    return MissiveEmailSender.instance;
  }

  /**
   * Complete email sending workflow from generation to tracking
   */
  public async sendEmail(request: EmailSendRequest): Promise<EmailSendResult> {
    try {
      logger.info('Starting email send workflow', {
        emailJobId: request.emailJobId,
        prospect: request.prospect.contactEmail,
        campaign: request.campaign.name
      });

      // Step 1: Validate email job exists and is ready to send
      const emailJob = await EmailJobModel.findById(request.emailJobId);
      if (!emailJob) {
        throw new Error(`Email job not found: ${request.emailJobId}`);
      }

      if (emailJob.status !== 'completed' && emailJob.status !== 'queued') {
        throw new Error(`Email job not ready to send. Status: ${emailJob.status}`);
      }

      // Step 2: Create Missive draft
      const draftId = await this.createDraft(request);
      
      // Update email job with draft ID
      await EmailJobModel.findByIdAndUpdate(request.emailJobId, {
        missiveDraftId: draftId,
        status: 'draft_created'
      });

      // Step 3: Send the draft with tracking
      const sendResult = await this.missiveClient.sendDraftWithTracking(
        draftId, 
        request.emailJobId
      );

      // Step 4: Track the send event for analytics
      await this.trackSendEvent(request, sendResult);

      logger.info('Email send workflow completed successfully', {
        emailJobId: request.emailJobId,
        messageId: sendResult.messageId,
        conversationId: sendResult.conversationId
      });

      return {
        success: true,
        messageId: sendResult.messageId,
        conversationId: sendResult.conversationId,
        sentAt: sendResult.sentAt
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Email send workflow failed', {
        emailJobId: request.emailJobId,
        error: errorMessage,
        prospect: request.prospect.contactEmail
      });

      // Update email job status to failed
      await EmailJobModel.findByIdAndUpdate(request.emailJobId, {
        status: 'failed',
        error: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create Missive draft from email generation request
   */
  private async createDraft(request: EmailSendRequest): Promise<string> {
    try {
      const draft = {
        to: [request.prospect.contactEmail],
        subject: request.generatedEmail.subject,
        body: request.generatedEmail.htmlBody,
        format: 'html' as const
      };

      const draftResponse = await this.missiveClient.createDraft(draft);
      
      if (!draftResponse.id) {
        throw new Error('Missive draft creation failed - no draft ID returned');
      }

      logger.info('Missive draft created', {
        draftId: draftResponse.id,
        emailJobId: request.emailJobId,
        to: request.prospect.contactEmail
      });

      return draftResponse.id;

    } catch (error) {
      logger.error('Failed to create Missive draft', {
        emailJobId: request.emailJobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Track send event for conversion analytics
   */
  private async trackSendEvent(
    request: EmailSendRequest, 
    sendResult: { messageId: string; conversationId: string; sentAt: Date }
  ): Promise<void> {
    try {
      // Determine email style and characteristics for tracking
      const subjectLineStyle = this.determineSubjectLineStyle(request.generatedEmail.subject);
      
      await this.conversionTracker.trackEmailSent(
        sendResult.messageId,
        request.emailJobId, // Using emailJobId as prospectId reference
        request.campaign.id,
        {
          subjectLine: request.generatedEmail.subject,
          subjectLineStyle,
          emailLength: request.generatedEmail.textBody.length,
          psychologicalTriggers: request.generatedEmail.psychologicalTriggers || [],
          personalizationElements: request.generatedEmail.personalizations,
          industry: request.prospect.industry || 'unknown',
          businessStage: 'prospecting', // Could be enhanced with actual data
          professionalLevel: 'professional' // Could be enhanced with actual data
        }
      );

      logger.debug('Send event tracked for analytics', {
        messageId: sendResult.messageId,
        emailJobId: request.emailJobId
      });

    } catch (error) {
      // Don't fail the whole send process if tracking fails
      logger.error('Failed to track send event', {
        emailJobId: request.emailJobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Determine subject line style for analytics
   */
  private determineSubjectLineStyle(subject: string): 'curiosity' | 'benefit' | 'question' | 'personalized' | 'social-proof' {
    const lowerSubject = subject.toLowerCase();
    
    if (lowerSubject.includes('?')) {
      return 'question';
    } else if (lowerSubject.includes('curious') || lowerSubject.includes('wondering') || lowerSubject.includes('noticed')) {
      return 'curiosity';
    } else if (lowerSubject.includes('colleagues') || lowerSubject.includes('other') || lowerSubject.includes('peers')) {
      return 'social-proof';
    } else if (lowerSubject.includes('help') || lowerSubject.includes('improve') || lowerSubject.includes('solution')) {
      return 'benefit';
    } else {
      return 'personalized';
    }
  }

  /**
   * Batch send multiple emails with rate limiting
   */
  public async batchSendEmails(
    requests: EmailSendRequest[],
    batchSize: number = 5,
    delayBetweenBatches: number = 2000
  ): Promise<{
    successful: EmailSendResult[];
    failed: EmailSendResult[];
  }> {
    logger.info(`Starting batch email send`, {
      totalEmails: requests.length,
      batchSize,
      delayBetweenBatches
    });

    const successful: EmailSendResult[] = [];
    const failed: EmailSendResult[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      logger.info(`Processing email batch ${Math.floor(i / batchSize) + 1}`, {
        batchSize: batch.length,
        remaining: requests.length - i - batch.length
      });

      const promises = batch.map(async (request) => {
        try {
          const result = await this.sendEmail(request);
          if (result.success) {
            successful.push(result);
          } else {
            failed.push(result);
          }
          return result;
        } catch (error) {
          const failedResult: EmailSendResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          failed.push(failedResult);
          return failedResult;
        }
      });

      await Promise.all(promises);

      // Add delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    logger.info('Batch email send completed', {
      totalRequested: requests.length,
      successful: successful.length,
      failed: failed.length
    });

    return { successful, failed };
  }

  /**
   * Retry failed email sends
   */
  public async retryFailedSends(
    emailJobIds: string[],
    maxRetries: number = 3
  ): Promise<{
    successful: EmailSendResult[];
    stillFailed: EmailSendResult[];
  }> {
    const successful: EmailSendResult[] = [];
    const stillFailed: EmailSendResult[] = [];

    for (const emailJobId of emailJobIds) {
      try {
        const emailJob = await EmailJobModel.findById(emailJobId).populate('prospectId campaignId');
        
        if (!emailJob || !emailJob.generatedEmail) {
          stillFailed.push({
            success: false,
            error: `Email job not found or missing generated email: ${emailJobId}`
          });
          continue;
        }

        if (emailJob.attempts >= maxRetries) {
          stillFailed.push({
            success: false,
            error: `Max retries exceeded for email job: ${emailJobId}`
          });
          continue;
        }

        // Increment attempt counter
        await EmailJobModel.findByIdAndUpdate(emailJobId, {
          $inc: { attempts: 1 },
          status: 'retrying'
        });

        // Build retry request
        const retryRequest: EmailSendRequest = {
          emailJobId,
          prospect: emailJob.prospectId as any,
          campaign: emailJob.campaignId as any,
          generatedEmail: emailJob.generatedEmail as any
        };

        const result = await this.sendEmail(retryRequest);
        
        if (result.success) {
          successful.push(result);
        } else {
          stillFailed.push(result);
        }

      } catch (error) {
        stillFailed.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown retry error'
        });
      }
    }

    logger.info('Email retry completed', {
      attempted: emailJobIds.length,
      successful: successful.length,
      stillFailed: stillFailed.length
    });

    return { successful, stillFailed };
  }

  /**
   * Get send statistics
   */
  public async getSendStatistics(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<{
    totalSent: number;
    successRate: number;
    failureReasons: Array<{ reason: string; count: number }>;
    averageSendTime: number;
  }> {
    try {
      const query: any = {
        status: { $in: ['completed', 'failed'] }
      };

      if (timeRange) {
        query.createdAt = { $gte: timeRange.start, $lte: timeRange.end };
      }

      const emailJobs = await EmailJobModel.find(query);
      const totalSent = emailJobs.length;
      const successful = emailJobs.filter(job => job.status === 'completed').length;
      const failed = emailJobs.filter(job => job.status === 'failed');

      const successRate = totalSent > 0 ? successful / totalSent : 0;

      // Analyze failure reasons
      const failureReasons = failed.reduce((reasons: Record<string, number>, job) => {
        const reason = job.error || 'Unknown error';
        reasons[reason] = (reasons[reason] || 0) + 1;
        return reasons;
      }, {});

      const failureReasonsArray = Object.entries(failureReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      // Calculate average send time (from creation to completion)
      const completedJobs = emailJobs.filter(job => 
        job.status === 'completed' && 
        job.analytics?.sentAt
      );

      let averageSendTime = 0;
      if (completedJobs.length > 0) {
        const totalSendTime = completedJobs.reduce((total, job) => {
          const createdAt = job.createdAt as Date;
          const sentAt = job.analytics?.sentAt as Date;
          return total + (sentAt.getTime() - createdAt.getTime());
        }, 0);
        
        averageSendTime = Math.round(totalSendTime / completedJobs.length / 1000); // Convert to seconds
      }

      return {
        totalSent,
        successRate: Math.round(successRate * 100) / 100,
        failureReasons: failureReasonsArray,
        averageSendTime
      };

    } catch (error) {
      logger.error('Failed to get send statistics', error);
      throw error;
    }
  }
}