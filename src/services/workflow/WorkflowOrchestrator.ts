import { EmailQueue, BulkImportQueue } from '@/services/queue';
import { ScrapingService } from '@/services/scraper';
import { ContentAnalyzer } from '@/services/ai';
import { EmailGenerator } from '@/services/email';
import { MissiveService } from '@/services/missive';
import { ProspectModel, CampaignModel, EmailJobModel, BulkImportJobModel } from '@/models';
import { ProspectStatus, JobStatus, BulkImportStatus } from '@/types';
import { logger } from '@/utils/logger';

export interface WorkflowConfig {
  autoScrape?: boolean;
  autoAnalyze?: boolean;
  autoGenerateEmails?: boolean;
  autoCreateDrafts?: boolean;
  batchSize?: number;
  delayBetweenBatches?: number;
}

export class WorkflowOrchestrator {
  private emailQueue?: EmailQueue;
  private bulkImportQueue?: BulkImportQueue;
  private scrapingService?: ScrapingService;
  private contentAnalyzer?: ContentAnalyzer;
  private emailGenerator?: EmailGenerator;
  private missiveService?: MissiveService;

  constructor() {
    // Lazy initialization to avoid blocking during import
  }

  private getEmailQueue(): EmailQueue {
    if (!this.emailQueue) {
      this.emailQueue = EmailQueue.getInstance();
    }
    return this.emailQueue;
  }

  private getBulkImportQueue(): BulkImportQueue {
    if (!this.bulkImportQueue) {
      this.bulkImportQueue = BulkImportQueue.getInstance();
    }
    return this.bulkImportQueue;
  }

  private getScrapingService(): ScrapingService {
    if (!this.scrapingService) {
      this.scrapingService = new ScrapingService();
    }
    return this.scrapingService;
  }

  private getContentAnalyzer(): ContentAnalyzer {
    if (!this.contentAnalyzer) {
      this.contentAnalyzer = new ContentAnalyzer();
    }
    return this.contentAnalyzer;
  }

  private getEmailGenerator(): EmailGenerator {
    if (!this.emailGenerator) {
      this.emailGenerator = new EmailGenerator();
    }
    return this.emailGenerator;
  }

  private getMissiveService(): MissiveService {
    if (!this.missiveService) {
      this.missiveService = new MissiveService();
    }
    return this.missiveService;
  }

  public async processCampaign(
    campaignId: string,
    config: WorkflowConfig = {}
  ): Promise<{
    prospectIds: string[];
    processed: number;
    errors: string[];
  }> {
    const defaultConfig: WorkflowConfig = {
      autoScrape: true,
      autoAnalyze: true,
      autoGenerateEmails: true,
      autoCreateDrafts: true,
      batchSize: 10,
      delayBetweenBatches: 5000,
    };

    const workflowConfig = { ...defaultConfig, ...config };

    logger.info(`Starting campaign processing: ${campaignId}`, { config: workflowConfig });

    try {
      const campaign = await CampaignModel.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Get prospects assigned to this campaign
      const prospects = await ProspectModel.find({
        campaignIds: campaignId,
        status: { $in: [ProspectStatus.PENDING, ProspectStatus.SCRAPED, ProspectStatus.ANALYZED] }
      });

      const prospectIds = prospects.map(p => p._id.toString());
      let processed = 0;
      const errors: string[] = [];

      logger.info(`Found ${prospectIds.length} prospects to process for campaign: ${campaignId}`);

      // Step 1: Scraping
      if (workflowConfig.autoScrape) {
        logger.info('Starting scraping phase');
        try {
          const scrapingResult = await this.getScrapingService().scrapeBatch(prospectIds, workflowConfig.batchSize);
          processed += scrapingResult.successful;
          
          // Log scraping results
          logger.info('Scraping phase completed', {
            successful: scrapingResult.successful,
            failed: scrapingResult.failed,
            retryableFailures: scrapingResult.errors.filter(e => e.retryable).length
          });
          
          // Add retryable errors to errors array for tracking
          scrapingResult.errors.forEach(error => {
            if (error.retryable) {
              errors.push(`Retryable scraping error for ${error.prospectId}: ${error.error}`);
            } else {
              errors.push(`Non-retryable scraping error for ${error.prospectId}: ${error.error}`);
            }
          });
          
          // Attempt to retry failed prospects if there are retryable failures
          if (scrapingResult.errors.filter(e => e.retryable).length > 0) {
            logger.info('Attempting to retry failed prospects');
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            
            const retryResult = await this.getScrapingService().retryFailedProspects(20);
            processed += retryResult.successful;
            
            logger.info('Retry attempt completed', {
              attempted: retryResult.attempted,
              successful: retryResult.successful,
              failed: retryResult.failed
            });
          }
        } catch (error) {
          const errorMsg = `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Step 2: Content Analysis
      if (workflowConfig.autoAnalyze) {
        logger.info('Starting analysis phase');
        try {
          const scrapedProspects = await ProspectModel.find({
            _id: { $in: prospectIds },
            campaignIds: campaignId,
            status: ProspectStatus.SCRAPED
          }).select('_id');

          const scrapedIds = scrapedProspects.map(p => p._id.toString());
          await this.getContentAnalyzer().analyzeBatch(scrapedIds, campaignId, workflowConfig.batchSize);
        } catch (error) {
          const errorMsg = `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Step 3: Email Generation
      if (workflowConfig.autoGenerateEmails) {
        logger.info('Starting email generation phase');
        try {
          // Create email jobs for analyzed prospects
          const analyzedProspects = await ProspectModel.find({
            _id: { $in: prospectIds },
            campaignIds: campaignId,
            status: ProspectStatus.ANALYZED
          });

          const emailJobs: { prospectId: string; campaignId: string; emailJobId: string }[] = [];

          for (const prospect of analyzedProspects) {
            const existingJob = await EmailJobModel.findOne({
              prospectId: prospect._id,
              campaignId
            });

            if (!existingJob) {
              const emailJob = await EmailJobModel.create({
                prospectId: prospect._id,
                campaignId,
                status: JobStatus.QUEUED
              });

              const jobData = {
                prospectId: prospect._id.toString(),
                campaignId,
                emailJobId: emailJob._id.toString()
              };

              emailJobs.push(jobData);

              // Try to add to queue
              try {
                await this.getEmailQueue().addEmailJob(jobData);
              } catch (queueError) {
                logger.warn(`Failed to add job to queue, will process synchronously: ${queueError}`);
              }
            }
          }

          // Synchronous fallback: Process jobs directly if Redis is unavailable
          logger.info('Checking if email jobs need synchronous processing');
          const queuedJobs = await EmailJobModel.find({
            campaignId,
            status: JobStatus.QUEUED
          });

          if (queuedJobs.length > 0) {
            logger.info(`Processing ${queuedJobs.length} email jobs synchronously as fallback`);
            
            for (const job of queuedJobs) {
              try {
                // Update job status to processing
                await EmailJobModel.findByIdAndUpdate(job._id, {
                  status: JobStatus.PROCESSING
                });

                // Process the job directly using EmailGenerator
                const result = await this.getEmailGenerator().generateEmail(job._id.toString());

                // If we get here without exception, the email was generated successfully
                await EmailJobModel.findByIdAndUpdate(job._id, {
                  status: JobStatus.COMPLETED,
                  completedAt: new Date()
                });
                logger.info(`Email job completed synchronously: ${job._id}`, {
                  subject: result.subject,
                  personalizationsCount: result.personalizations?.length || 0,
                  confidence: result.confidence
                });

                // Create Missive draft if autoCreateDrafts is enabled
                if (workflowConfig.autoCreateDrafts) {
                  try {
                    const draftId = await this.getMissiveService().createDraftFromEmailJob(job._id.toString());
                    logger.info(`Missive draft created synchronously: ${draftId} for job: ${job._id}`);
                  } catch (draftError) {
                    logger.error(`Failed to create Missive draft for job: ${job._id}`, draftError);
                    // Don't fail the entire job if draft creation fails
                  }
                }
              } catch (jobError) {
                // Update job status to failed
                await EmailJobModel.findByIdAndUpdate(job._id, {
                  status: JobStatus.FAILED,
                  error: jobError instanceof Error ? jobError.message : 'Unknown error',
                  failedAt: new Date()
                });
                logger.error(`Email job failed during synchronous processing: ${job._id}`, jobError);
              }

              // Add small delay between jobs to prevent overwhelming the system
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

        } catch (error) {
          const errorMsg = `Email generation setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Step 4: Draft Creation
      if (workflowConfig.autoCreateDrafts) {
        logger.info('Setting up draft creation monitoring');
        // Note: Draft creation will be handled automatically by the email queue worker
        // when emails are generated successfully
      }

      logger.info(`Campaign processing initiated: ${campaignId}`, {
        prospectIds: prospectIds.length,
        processed,
        errors: errors.length
      });

      return { prospectIds, processed, errors };

    } catch (error) {
      logger.error(`Failed to process campaign: ${campaignId}`, error);
      throw error;
    }
  }

  public async processBulkImport(
    filePath: string,
    campaignId?: string
  ): Promise<string> {
    try {
      logger.info('Starting bulk import process', { filePath, campaignId });

      // Create bulk import job
      const bulkImportJob = await BulkImportJobModel.create({
        filename: filePath.split('/').pop() || 'unknown',
        totalProspects: 0, // Will be updated by the worker
        status: BulkImportStatus.PENDING
      });

      // Add to queue
      await this.getBulkImportQueue().addBulkImportJob({
        bulkImportJobId: bulkImportJob._id.toString(),
        filePath,
        campaignId
      });

      logger.info(`Bulk import job created: ${bulkImportJob._id}`, { filePath });

      return bulkImportJob._id.toString();

    } catch (error) {
      logger.error('Failed to start bulk import process', error);
      throw error;
    }
  }

  public async getWorkflowStatus(campaignId?: string) {
    try {
      const scrapingStats = await this.getScrapingService().getScrapingStats();
      const analysisStats = await this.getContentAnalyzer().getAnalysisStats(campaignId);
      const generationStats = await this.getEmailGenerator().getGenerationStats(campaignId);
      const draftStats = await this.getMissiveService().getDraftCreationStats(campaignId);
      
      const queueStats = {
        email: await this.getEmailQueue().getQueueStats(),
        bulkImport: await this.getBulkImportQueue().getQueueStats()
      };

      // Calculate success rates and identify bottlenecks
      const totalProspects = scrapingStats.total;
      const successRate = totalProspects > 0 ? (scrapingStats.scraped / totalProspects) * 100 : 0;
      const failureRate = totalProspects > 0 ? (scrapingStats.failed / totalProspects) * 100 : 0;
      
      return {
        scraping: {
          ...scrapingStats,
          successRate: Math.round(successRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100
        },
        analysis: analysisStats,
        generation: generationStats,
        drafts: draftStats,
        queues: queueStats,
        healthcheck: {
          scrapingBottleneck: scrapingStats.failed > scrapingStats.scraped,
          analysisBottleneck: analysisStats.pending > analysisStats.scraped,
          retryableFailures: scrapingStats.retryableFailures > 0
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get workflow status', error);
      throw error;
    }
  }

  public async retryFailedJobs(campaignId?: string): Promise<{
    emailJobs: number;
    draftCreations: number;
    scrapingRetries: number;
  }> {
    try {
      logger.info('Retrying failed jobs', { campaignId });

      // Retry failed scraping attempts
      const scrapingRetryResult = await this.getScrapingService().retryFailedProspects(50);
      
      const emailJobsRetried = await this.getEmailGenerator().retryFailedJobs(campaignId);
      const draftCreationsRetried = await this.getMissiveService().retryFailedDraftCreations(campaignId);

      logger.info('Failed jobs retry completed', {
        emailJobs: emailJobsRetried,
        draftCreations: draftCreationsRetried,
        scrapingRetries: scrapingRetryResult.successful
      });

      return {
        emailJobs: emailJobsRetried,
        draftCreations: draftCreationsRetried,
        scrapingRetries: scrapingRetryResult.successful
      };

    } catch (error) {
      logger.error('Failed to retry failed jobs', error);
      throw error;
    }
  }

  public async pauseCampaign(campaignId: string): Promise<void> {
    try {
      await CampaignModel.findByIdAndUpdate(campaignId, {
        status: 'paused'
      });

      // Note: In a full implementation, you might want to pause queue processing
      // for this specific campaign

      logger.info(`Campaign paused: ${campaignId}`);
    } catch (error) {
      logger.error(`Failed to pause campaign: ${campaignId}`, error);
      throw error;
    }
  }

  public async resumeCampaign(campaignId: string): Promise<void> {
    try {
      await CampaignModel.findByIdAndUpdate(campaignId, {
        status: 'active'
      });

      logger.info(`Campaign resumed: ${campaignId}`);
    } catch (error) {
      logger.error(`Failed to resume campaign: ${campaignId}`, error);
      throw error;
    }
  }

  public async getBulkImportStatus(jobId: string) {
    try {
      return await BulkImportJobModel.findById(jobId);
    } catch (error) {
      logger.error(`Failed to get bulk import status: ${jobId}`, error);
      throw error;
    }
  }

  public async getCampaignProgress(campaignId: string) {
    try {
      const campaign = await CampaignModel.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Get email jobs for this campaign
      const emailJobs = await EmailJobModel.aggregate([
        { $match: { campaignId: campaign._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const jobStats: Record<string, number> = {};
      emailJobs.forEach(stat => {
        jobStats[stat._id] = stat.count;
      });

      const total = Object.values(jobStats).reduce((sum, count) => sum + count, 0);
      const completed = jobStats[JobStatus.COMPLETED] || 0;
      const failed = jobStats[JobStatus.FAILED] || 0;
      const processing = jobStats[JobStatus.PROCESSING] || 0;
      const queued = jobStats[JobStatus.QUEUED] || 0;

      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        campaign: {
          id: campaign._id,
          name: campaign.name,
          status: campaign.status
        },
        progress: {
          percentage: progress,
          total,
          completed,
          failed,
          processing,
          queued
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to get campaign progress: ${campaignId}`, error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    try {
      if (this.scrapingService) await this.scrapingService.close();
      if (this.emailQueue) await this.emailQueue.close();
      if (this.bulkImportQueue) await this.bulkImportQueue.close();
      logger.info('WorkflowOrchestrator cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup WorkflowOrchestrator', error);
      throw error;
    }
  }
}