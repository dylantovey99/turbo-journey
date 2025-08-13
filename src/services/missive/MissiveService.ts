import { MissiveClient, MissiveDraft } from './MissiveClient';
import { EmailJobModel, ProspectModel } from '@/models';
import { GeneratedEmail, ProspectStatus } from '@/types';
import { logger } from '@/utils/logger';

export class MissiveService {
  private client: MissiveClient;

  constructor() {
    this.client = new MissiveClient();
  }

  public async createDraftFromEmailJob(emailJobId: string): Promise<string> {
    try {
      logger.info(`Creating Missive draft for email job: ${emailJobId}`);

      const emailJob = await EmailJobModel.findById(emailJobId)
        .populate('prospectId')
        .populate('campaignId');

      if (!emailJob) {
        throw new Error(`Email job not found: ${emailJobId}`);
      }

      if (!emailJob.generatedEmail) {
        throw new Error(`No generated email found for job: ${emailJobId}`);
      }

      const prospect = emailJob.prospectId as any;
      const campaign = emailJob.campaignId as any;
      const generatedEmail = emailJob.generatedEmail;

      // Prepare the draft
      const draft: MissiveDraft = {
        to: [prospect.contactEmail],
        subject: generatedEmail.subject,
        body: generatedEmail.htmlBody,
        format: 'html'
      };

      // Create the draft in Missive
      const draftResponse = await this.client.createDraft(
        draft,
        campaign.missiveAccountId
      );

      // Update the email job with the Missive draft ID
      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        missiveDraftId: draftResponse.id
      });

      // Update prospect status
      await ProspectModel.findByIdAndUpdate(prospect._id, {
        status: ProspectStatus.DRAFT_CREATED
      });

      logger.info(`Successfully created Missive draft: ${draftResponse.id}`, {
        emailJobId,
        prospectEmail: prospect.contactEmail,
        subject: generatedEmail.subject.substring(0, 50)
      });

      return draftResponse.id;

    } catch (error) {
      logger.error(`Failed to create Missive draft for job: ${emailJobId}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async createDraftFromGeneratedEmail(
    generatedEmail: GeneratedEmail,
    recipientEmail: string,
    accountId?: string
  ): Promise<string> {
    try {
      const draft: MissiveDraft = {
        to: [recipientEmail],
        subject: generatedEmail.subject,
        body: generatedEmail.htmlBody,
        format: 'html'
      };

      const draftResponse = await this.client.createDraft(draft, accountId);

      logger.info(`Created Missive draft from generated email: ${draftResponse.id}`, {
        recipientEmail,
        subject: generatedEmail.subject.substring(0, 50)
      });

      return draftResponse.id;
    } catch (error) {
      logger.error('Failed to create Missive draft from generated email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        recipientEmail
      });
      throw error;
    }
  }

  public async batchCreateDraftsFromJobs(
    emailJobIds: string[],
    batchSize: number = 5
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    logger.info(`Creating Missive drafts for ${emailJobIds.length} email jobs`, {
      batchSize
    });

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < emailJobIds.length; i += batchSize) {
      const batch = emailJobIds.slice(i, i + batchSize);
      
      logger.info(`Processing Missive draft batch ${Math.floor(i / batchSize) + 1}`, {
        batch: batch.length,
        remaining: emailJobIds.length - i - batch.length
      });

      const promises = batch.map(async (jobId) => {
        try {
          await this.createDraftFromEmailJob(jobId);
          successful++;
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Job ${jobId}: ${errorMessage}`);
          logger.error(`Batch draft creation failed for job: ${jobId}`, error);
        }
      });

      await Promise.all(promises);

      // Add delay between batches to respect rate limits
      if (i + batchSize < emailJobIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`Completed batch Missive draft creation`, {
      total: emailJobIds.length,
      successful,
      failed
    });

    return { successful, failed, errors };
  }

  public async getDraftStatus(draftId: string): Promise<any> {
    try {
      return await this.client.getDraft(draftId);
    } catch (error) {
      logger.error(`Failed to get draft status: ${draftId}`, error);
      throw error;
    }
  }

  public async updateDraft(
    draftId: string,
    updates: {
      subject?: string;
      body?: string;
      to?: string[];
      cc?: string[];
      bcc?: string[];
    }
  ): Promise<void> {
    try {
      await this.client.updateDraft(draftId, updates);
      logger.info(`Updated Missive draft: ${draftId}`);
    } catch (error) {
      logger.error(`Failed to update draft: ${draftId}`, error);
      throw error;
    }
  }

  public async deleteDraft(draftId: string): Promise<void> {
    try {
      await this.client.deleteDraft(draftId);
      logger.info(`Deleted Missive draft: ${draftId}`);
    } catch (error) {
      logger.error(`Failed to delete draft: ${draftId}`, error);
      throw error;
    }
  }

  public async sendDraft(draftId: string): Promise<any> {
    try {
      const result = await this.client.sendDraft(draftId);
      logger.info(`Sent Missive draft: ${draftId}`);
      return result;
    } catch (error) {
      logger.error(`Failed to send draft: ${draftId}`, error);
      throw error;
    }
  }

  public async getJobsReadyForDraftCreation(limit: number = 50): Promise<string[]> {
    const jobs = await EmailJobModel
      .find({ 
        status: 'completed',
        generatedEmail: { $ne: null },
        missiveDraftId: { $eq: null }
      })
      .select('_id')
      .limit(limit)
      .lean();

    return jobs.map(job => job._id.toString());
  }

  public async getDraftCreationStats(campaignId?: string) {
    const matchCondition: any = {
      generatedEmail: { $ne: null }
    };
    
    if (campaignId) {
      matchCondition.campaignId = campaignId;
    }

    const stats = await EmailJobModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: {
            hasEmail: { $ne: ['$generatedEmail', null] },
            hasDraft: { $ne: ['$missiveDraftId', null] }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    let emailsGenerated = 0;
    let draftsCreated = 0;

    stats.forEach(stat => {
      if (stat._id.hasEmail) emailsGenerated += stat.count;
      if (stat._id.hasDraft) draftsCreated += stat.count;
    });

    return {
      emailsGenerated,
      draftsCreated,
      pending: emailsGenerated - draftsCreated
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      logger.error('Missive service health check failed', error);
      return false;
    }
  }

  public async retryFailedDraftCreations(campaignId?: string): Promise<number> {
    // Find email jobs that have generated emails but no Missive draft ID
    const matchCondition: any = {
      status: 'completed',
      generatedEmail: { $ne: null },
      missiveDraftId: { $eq: null }
    };

    if (campaignId) {
      matchCondition.campaignId = campaignId;
    }

    const failedJobs = await EmailJobModel.find(matchCondition).select('_id');
    
    if (failedJobs.length === 0) {
      return 0;
    }

    logger.info(`Retrying draft creation for ${failedJobs.length} jobs`, { campaignId });

    const jobIds = failedJobs.map(job => job._id.toString());
    const result = await this.batchCreateDraftsFromJobs(jobIds);

    logger.info(`Retry completed`, {
      attempted: failedJobs.length,
      successful: result.successful,
      failed: result.failed
    });

    return result.successful;
  }

  public getClient(): MissiveClient {
    return this.client;
  }
}