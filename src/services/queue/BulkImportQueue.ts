import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from './redis';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { BulkImportStatus, ProspectStatus } from '@/types';
import fs from 'fs/promises';
import csv from 'csv-parser';
import { createReadStream } from 'fs';

export interface BulkImportJobData {
  bulkImportJobId: string;
  filePath: string;
  campaignId?: string;
}

export interface ProspectRow {
  website: string;
  contactEmail: string;
  contactName?: string;
  companyName?: string;
  industry?: string;
}

export class BulkImportQueue {
  private static instance: BulkImportQueue;
  private queue?: Queue<BulkImportJobData>;
  private worker?: Worker<BulkImportJobData>;
  private initialized = false;

  private constructor() {
    // Lazy initialization to avoid blocking during import
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const connectionOpts = {
      host: config.redis.url.includes('redis://') ? 
        config.redis.url.replace('redis://', '').split(':')[0] : 'localhost',
      port: config.redis.url.includes(':') ? 
        parseInt(config.redis.url.split(':').pop() || '6379') : 6379,
    };
    
    this.queue = new Queue<BulkImportJobData>('bulk-import', {
      connection: connectionOpts,
      defaultJobOptions: {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.worker = new Worker<BulkImportJobData>(
      'bulk-import',
      this.processBulkImport.bind(this),
      {
        connection: connectionOpts,
        concurrency: 2,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      }
    );

    this.setupEventHandlers();
    this.initialized = true;
  }

  public static getInstance(): BulkImportQueue {
    if (!BulkImportQueue.instance) {
      BulkImportQueue.instance = new BulkImportQueue();
    }
    return BulkImportQueue.instance;
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;
    
    this.worker.on('completed', (job: Job<BulkImportJobData>) => {
      logger.info(`Bulk import job completed: ${job.id}`, { data: job.data });
    });

    this.worker.on('failed', (job: Job<BulkImportJobData> | undefined, error: Error) => {
      logger.error(`Bulk import job failed: ${job?.id}`, { 
        error: error.message,
        data: job?.data 
      });
    });

    this.worker.on('error', (error: Error) => {
      logger.error('Bulk import worker error:', error);
    });

    if (this.queue) {
      this.queue.on('error', (error: Error) => {
        logger.error('Bulk import queue error:', error);
      });
    }
  }

  public async addBulkImportJob(data: BulkImportJobData): Promise<Job<BulkImportJobData>> {
    await this.initialize();
    if (!this.queue) throw new Error('Queue not initialized');
    
    try {
      const job = await this.queue.add('import-prospects', data, {
        jobId: data.bulkImportJobId,
      });
      
      logger.info(`Bulk import job added to queue: ${job.id}`, { data });
      return job;
    } catch (error) {
      logger.error('Failed to add bulk import job to queue:', error);
      throw error;
    }
  }

  private async processBulkImport(job: Job<BulkImportJobData>): Promise<void> {
    const { bulkImportJobId, filePath } = job.data;
    
    try {
      logger.info(`Processing bulk import job: ${job.id}`, { data: job.data });

      // Import models dynamically to avoid blocking during import
      const { BulkImportJobModel } = await import('@/models/BulkImportJob');

      const bulkImportJob = await BulkImportJobModel.findById(bulkImportJobId);
      if (!bulkImportJob) {
        throw new Error(`Bulk import job not found: ${bulkImportJobId}`);
      }

      await BulkImportJobModel.findByIdAndUpdate(bulkImportJobId, {
        status: BulkImportStatus.PROCESSING,
      });

      const prospects = await this.parseCSVFile(filePath);
      
      await BulkImportJobModel.findByIdAndUpdate(bulkImportJobId, {
        totalProspects: prospects.length,
      });

      let successCount = 0;
      let failCount = 0;
      const errors: any[] = [];

      for (let i = 0; i < prospects.length; i++) {
        try {
          await job.updateProgress((i / prospects.length) * 100);
          
          const prospectData = prospects[i];
          await this.createProspect(prospectData);
          successCount++;
          
        } catch (error) {
          failCount++;
          errors.push({
            row: i + 2, // +2 because CSV is 1-indexed and has header
            error: error instanceof Error ? error.message : 'Unknown error',
            data: prospects[i]
          });
          
          logger.warn(`Failed to create prospect at row ${i + 2}:`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            data: prospects[i]
          });
        }

        await BulkImportJobModel.findByIdAndUpdate(bulkImportJobId, {
          processedProspects: i + 1,
          successfulProspects: successCount,
          failedProspects: failCount,
          errors: errors.slice(-100) // Keep only last 100 errors
        });
      }

      await BulkImportJobModel.findByIdAndUpdate(bulkImportJobId, {
        status: BulkImportStatus.COMPLETED,
      });

      // Clean up the uploaded file
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        logger.warn('Failed to delete uploaded file:', unlinkError);
      }

      logger.info(`Bulk import job completed: ${job.id}`, {
        total: prospects.length,
        successful: successCount,
        failed: failCount
      });

    } catch (error) {
      logger.error(`Bulk import job processing failed: ${job.id}`, { 
        error: error instanceof Error ? error.message : 'Unknown error',
        data: job.data 
      });

      // Import model again for error handling
      const { BulkImportJobModel } = await import('@/models/BulkImportJob');
      await BulkImportJobModel.findByIdAndUpdate(bulkImportJobId, {
        status: BulkImportStatus.FAILED,
      });

      throw error;
    }
  }

  private async parseCSVFile(filePath: string): Promise<ProspectRow[]> {
    return new Promise((resolve, reject) => {
      const prospects: ProspectRow[] = [];
      
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          if (row.website && row.contactEmail) {
            prospects.push({
              website: row.website.trim().toLowerCase(),
              contactEmail: row.contactEmail.trim().toLowerCase(),
              contactName: row.contactName?.trim(),
              companyName: row.companyName?.trim(),
              industry: row.industry?.trim(),
            });
          }
        })
        .on('end', () => {
          resolve(prospects);
        })
        .on('error', reject);
    });
  }

  private async createProspect(prospectData: ProspectRow): Promise<void> {
    // Import model dynamically to avoid blocking during import
    const { ProspectModel } = await import('@/models/Prospect');
    
    const existingProspect = await ProspectModel.findOne({
      website: prospectData.website
    });

    if (existingProspect) {
      throw new Error(`Prospect with website ${prospectData.website} already exists`);
    }

    await ProspectModel.create({
      ...prospectData,
      status: ProspectStatus.PENDING
    });
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