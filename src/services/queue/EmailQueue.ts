import { Queue, Worker, Job } from 'bullmq';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { JobStatus } from '@/types';

export interface EmailJobData {
  prospectId: string;
  campaignId: string;
  emailJobId: string;
}

export class EmailQueue {
  private static instance: EmailQueue;
  private queue?: Queue<EmailJobData>;
  private worker?: Worker<EmailJobData>;
  private initialized = false;

  private constructor() {
    // Lazy initialization to avoid blocking during import
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Parse Redis URL for BullMQ connection options
    const redisUrl = new URL(config.redis.url);
    const connectionOpts = {
      host: redisUrl.hostname || 'localhost',
      port: parseInt(redisUrl.port) || 6379,
      password: redisUrl.password || undefined
    };
    
    this.queue = new Queue<EmailJobData>('email-generation', {
      connection: connectionOpts,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.worker = new Worker<EmailJobData>(
      'email-generation',
      this.processEmailJob.bind(this),
      {
        connection: connectionOpts,
        concurrency: 5,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );

    this.setupEventHandlers();
    this.initialized = true;
  }

  public static getInstance(): EmailQueue {
    if (!EmailQueue.instance) {
      EmailQueue.instance = new EmailQueue();
    }
    return EmailQueue.instance;
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;
    
    this.worker.on('completed', (job: Job<EmailJobData>) => {
      logger.info(`Email job completed: ${job.id}`, { data: job.data });
    });

    this.worker.on('failed', (job: Job<EmailJobData> | undefined, error: Error) => {
      logger.error(`Email job failed: ${job?.id}`, { 
        error: error.message,
        data: job?.data 
      });
    });

    this.worker.on('error', (error: Error) => {
      logger.error('Email worker error:', error);
    });

    if (this.queue) {
      this.queue.on('error', (error: Error) => {
        logger.error('Email queue error:', error);
      });
    }
  }

  public async addEmailJob(data: EmailJobData): Promise<Job<EmailJobData>> {
    await this.initialize();
    if (!this.queue) throw new Error('Queue not initialized');
    
    try {
      const job = await this.queue.add('generate-email', data, {
        jobId: data.emailJobId,
      });
      
      logger.info(`Email job added to queue: ${job.id}`, { data });
      return job;
    } catch (error) {
      logger.error('Failed to add email job to queue:', error);
      throw error;
    }
  }

  private async processEmailJob(job: Job<EmailJobData>): Promise<void> {
    const { prospectId, campaignId, emailJobId } = job.data;
    
    try {
      logger.info(`Processing email job: ${job.id}`, { data: job.data });

      // Import models dynamically to avoid blocking during import
      const { EmailJobModel } = await import('@/models/EmailJob');
      const { ProspectModel } = await import('@/models/Prospect');
      const { CampaignModel } = await import('@/models/Campaign');

      const emailJob = await EmailJobModel.findById(emailJobId);
      if (!emailJob) {
        throw new Error(`Email job not found: ${emailJobId}`);
      }

      const prospect = await ProspectModel.findById(prospectId);
      if (!prospect) {
        throw new Error(`Prospect not found: ${prospectId}`);
      }

      const campaign = await CampaignModel.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        status: JobStatus.PROCESSING,
        attempts: emailJob.attempts + 1,
      });

      // Import services dynamically to avoid circular imports
      const { EmailGenerator } = await import('@/services/email/EmailGenerator');
      const { MissiveService } = await import('@/services/missive/MissiveService');
      
      const emailGenerator = new EmailGenerator();
      const missiveService = new MissiveService();

      // Generate the email
      await emailGenerator.generateEmail(emailJobId);
      
      // Create draft in Missive
      const draftId = await missiveService.createDraftFromEmailJob(emailJobId);

      logger.info(`Email job processing completed: ${job.id}`, {
        emailJobId,
        draftId
      });

    } catch (error) {
      logger.error(`Email job processing failed: ${job.id}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        data: job.data 
      });

      // Import EmailJobModel again for error handling
      const { EmailJobModel } = await import('@/models/EmailJob');
      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  public async getQueueStats() {
    await this.initialize();
    if (!this.queue) throw new Error('Queue not initialized');
    
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}