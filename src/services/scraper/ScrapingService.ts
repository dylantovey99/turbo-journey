import { WebScraper } from './WebScraper';
import { ProspectModel } from '@/models';
import { ProspectStatus } from '@/types';
import { logger } from '@/utils/logger';
import { config } from '@/config';

export class ScrapingService {
  private scraper: WebScraper;
  private isInitialized: boolean = false;

  constructor() {
    this.scraper = new WebScraper();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.scraper.initialize();
      this.isInitialized = true;
      logger.info('ScrapingService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ScrapingService:', error);
      throw error;
    }
  }

  public async scrapeProspect(prospectId: string, retryCount: number = 0): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const prospect = await ProspectModel.findById(prospectId);
      if (!prospect) {
        throw new Error(`Prospect not found: ${prospectId}`);
      }

      if (prospect.status === ProspectStatus.SCRAPED) {
        logger.info(`Prospect already scraped: ${prospectId}`);
        return;
      }

      logger.info(`Starting to scrape prospect: ${prospectId}`, {
        website: prospect.website,
        attempt: retryCount + 1
      });

      const scrapedData = await this.scraper.scrapeWebsite(prospect.website);

      await ProspectModel.findByIdAndUpdate(prospectId, {
        scrapedData,
        status: ProspectStatus.SCRAPED,
      });

      logger.info(`Successfully scraped prospect: ${prospectId}`, {
        website: prospect.website,
        title: scrapedData.title?.substring(0, 50),
        servicesCount: scrapedData.services?.length || 0
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error(`Failed to scrape prospect: ${prospectId}`, {
        error: errorMessage,
        attempt: retryCount + 1,
        errorType: (error as any).type || 'unknown'
      });

      // Check if this is a retryable error type
      const isRetryable = (error as any).retryable !== false;
      const maxRetries = (error as any).maxRetries || config.scraping.maxRetries;
      
      if (isRetryable && retryCount < maxRetries) {
        logger.info(`Retrying scrape for prospect: ${prospectId}`, {
          attempt: retryCount + 2,
          errorType: (error as any).type || 'unknown'
        });
        
        // Use error-specific delay or exponential backoff
        const baseDelay = (error as any).retryDelay || (Math.pow(2, retryCount + 1) * 1000);
        const jitteredDelay = baseDelay + Math.random() * 2000;
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        
        return this.scrapeProspect(prospectId, retryCount + 1);
      } else {
        // Mark as failed but preserve error details for potential recovery
        await ProspectModel.findByIdAndUpdate(prospectId, {
          status: ProspectStatus.FAILED,
          lastError: {
            message: errorMessage,
            type: (error as any).type || 'unknown',
            retryable: isRetryable,
            timestamp: new Date().toISOString(),
            retryCount: retryCount + 1
          }
        });
        
        throw error;
      }
    }
  }

  public async scrapeBatch(prospectIds: string[], batchSize: number = 5): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ prospectId: string; error: string; retryable: boolean }>
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info(`Starting batch scraping for ${prospectIds.length} prospects`, {
      batchSize
    });

    let successful = 0;
    let failed = 0;
    const errors: Array<{ prospectId: string; error: string; retryable: boolean }> = [];

    for (let i = 0; i < prospectIds.length; i += batchSize) {
      const batch = prospectIds.slice(i, i + batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}`, {
        batch: batch.length,
        remaining: prospectIds.length - i - batch.length
      });

      const promises = batch.map(async (prospectId) => {
        try {
          await this.scrapeProspect(prospectId);
          successful++;
          return { prospectId, success: true };
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const retryable = (error as any).retryable !== false;
          
          errors.push({
            prospectId,
            error: errorMessage,
            retryable
          });
          
          logger.error(`Batch scraping failed for prospect: ${prospectId}`, {
            error: errorMessage,
            errorType: (error as any).type || 'unknown',
            retryable
          });
          
          return { prospectId, success: false, error: errorMessage, retryable };
        }
      });

      await Promise.all(promises);

      // Add delay between batches to avoid overwhelming target websites
      if (i + batchSize < prospectIds.length) {
        await new Promise(resolve => 
          setTimeout(resolve, config.rateLimits.scrapingDelayMs * 2)
        );
      }
    }

    logger.info(`Completed batch scraping for ${prospectIds.length} prospects`, {
      successful,
      failed,
      errorCount: errors.length,
      retryableErrors: errors.filter(e => e.retryable).length
    });

    return { successful, failed, errors };
  }

  public async getPendingProspects(limit: number = 50): Promise<string[]> {
    const prospects = await ProspectModel
      .find({ status: ProspectStatus.PENDING })
      .select('_id')
      .limit(limit)
      .lean();

    return prospects.map(p => p._id.toString());
  }

  public async getRetryableFailedProspects(limit: number = 20): Promise<string[]> {
    const prospects = await ProspectModel
      .find({
        status: ProspectStatus.FAILED,
        'lastError.retryable': true,
        'lastError.retryCount': { $lt: config.scraping.maxRetries + 2 } // Allow extra retries for failed prospects
      })
      .select('_id')
      .limit(limit)
      .lean();

    return prospects.map(p => p._id.toString());
  }

  public async retryFailedProspects(limit: number = 20): Promise<{
    attempted: number;
    successful: number;
    failed: number;
  }> {
    const retryableProspects = await this.getRetryableFailedProspects(limit);
    
    if (retryableProspects.length === 0) {
      logger.info('No retryable failed prospects found');
      return { attempted: 0, successful: 0, failed: 0 };
    }

    logger.info(`Retrying ${retryableProspects.length} failed prospects`);
    
    // Reset status to PENDING for retry
    await ProspectModel.updateMany(
      { _id: { $in: retryableProspects } },
      { $set: { status: ProspectStatus.PENDING } }
    );

    const result = await this.scrapeBatch(retryableProspects, 3); // Smaller batch size for retries
    
    return {
      attempted: retryableProspects.length,
      successful: result.successful,
      failed: result.failed
    };
  }

  public async getScrapingStats() {
    const [statusStats, errorStats] = await Promise.all([
      ProspectModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      ProspectModel.aggregate([
        {
          $match: { status: ProspectStatus.FAILED }
        },
        {
          $group: {
            _id: '$lastError.type',
            count: { $sum: 1 },
            retryable: { $sum: { $cond: ['$lastError.retryable', 1, 0] } }
          }
        }
      ])
    ]);

    const result: Record<string, number> = {};
    statusStats.forEach(stat => {
      result[stat._id] = stat.count;
    });

    const errorBreakdown: Record<string, { count: number; retryable: number }> = {};
    errorStats.forEach(stat => {
      errorBreakdown[stat._id || 'unknown'] = {
        count: stat.count,
        retryable: stat.retryable
      };
    });

    return {
      pending: result[ProspectStatus.PENDING] || 0,
      scraped: result[ProspectStatus.SCRAPED] || 0,
      failed: result[ProspectStatus.FAILED] || 0,
      total: Object.values(result).reduce((sum, count) => sum + count, 0),
      errorBreakdown,
      retryableFailures: Object.values(errorBreakdown).reduce((sum, error) => sum + error.retryable, 0)
    };
  }

  public async close(): Promise<void> {
    if (this.scraper) {
      await this.scraper.close();
      this.isInitialized = false;
      logger.info('ScrapingService closed successfully');
    }
  }
}