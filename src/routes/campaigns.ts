import express from 'express';
import { CampaignModel, EmailJobModel, ProspectModel } from '@/models';
import { ContentAnalyzer } from '@/services/ai';
import { WorkflowOrchestrator } from '@/services/workflow';
import { ScrapingService } from '@/services/scraper';
import { validateRequest, validateParams, validateQuery, schemas } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { CampaignStatus } from '@/types';

const router = express.Router();
const contentAnalyzer = new ContentAnalyzer();
let workflowOrchestrator: WorkflowOrchestrator | null = null;

function getWorkflowOrchestrator(): WorkflowOrchestrator {
  if (!workflowOrchestrator) {
    workflowOrchestrator = new WorkflowOrchestrator();
  }
  return workflowOrchestrator;
}

// Get all campaigns with pagination
router.get('/', validateQuery(schemas.pagination), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sort = req.query.sort as string || '-createdAt';
    const filter = req.query.filter as string;

    const skip = (page - 1) * limit;
    
    let query = {};
    if (filter) {
      query = {
        $or: [
          { name: { $regex: filter, $options: 'i' } },
          { targetAudience: { $regex: filter, $options: 'i' } }
        ]
      };
    }

    const [campaigns, total] = await Promise.all([
      CampaignModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      CampaignModel.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get campaigns', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get campaigns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get campaign by ID
router.get('/:id', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaign = await CampaignModel.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    return res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    logger.error(`Failed to get campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new campaign
router.post('/', validateRequest(schemas.campaign), async (req, res) => {
  try {
    const campaignData = req.body;
    
    const campaign = await CampaignModel.create({
      ...campaignData,
      status: CampaignStatus.DRAFT
    });

    // Extract USPs from marketing document
    try {
      const usps = await contentAnalyzer.extractCampaignUSPs(campaign._id.toString());
      campaign.usps = usps;
      await campaign.save();
    } catch (error) {
      logger.warn('Failed to extract USPs for campaign', {
        campaignId: campaign._id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    logger.info('Campaign created', {
      id: campaign._id,
      name: campaign.name,
      uspsCount: campaign.usps?.length || 0
    });

    return res.status(201).json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    logger.error('Failed to create campaign', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update campaign
router.patch('/:id', validateParams(schemas.objectId), validateRequest(schemas.campaignUpdate), async (req, res) => {
  try {
    const campaign = await CampaignModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Re-extract USPs if marketing document was updated
    if (req.body.marketingDocument) {
      try {
        const usps = await contentAnalyzer.extractCampaignUSPs(campaign._id.toString());
        campaign.usps = usps;
        await campaign.save();
      } catch (error) {
        logger.warn('Failed to re-extract USPs for updated campaign', {
          campaignId: campaign._id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Campaign updated', {
      id: campaign._id,
      name: campaign.name
    });

    return res.json({
      success: true,
      data: campaign,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    logger.error(`Failed to update campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete campaign
router.delete('/:id', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaign = await CampaignModel.findByIdAndDelete(req.params.id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Clean up related email jobs
    await EmailJobModel.deleteMany({ campaignId: req.params.id });

    logger.info('Campaign deleted', {
      id: campaign._id,
      name: campaign.name
    });

    return res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    logger.error(`Failed to delete campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start campaign processing
router.post('/:id/start', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const config = req.body.config || {};

    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    // Update campaign status to active
    await CampaignModel.findByIdAndUpdate(campaignId, {
      status: CampaignStatus.ACTIVE
    });

    // Start workflow processing
    getWorkflowOrchestrator().processCampaign(campaignId, config).catch(error => {
      logger.error(`Background campaign processing failed: ${campaignId}`, error);
    });

    logger.info('Campaign processing started', {
      campaignId,
      name: campaign.name
    });

    return res.json({
      success: true,
      message: 'Campaign processing started',
      data: { campaignId, status: 'processing_started' }
    });
  } catch (error) {
    logger.error(`Failed to start campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Pause campaign
router.post('/:id/pause', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    await getWorkflowOrchestrator().pauseCampaign(campaignId);

    return res.json({
      success: true,
      message: 'Campaign paused successfully',
      data: { campaignId, status: 'paused' }
    });
  } catch (error) {
    logger.error(`Failed to pause campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to pause campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resume campaign
router.post('/:id/resume', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    await getWorkflowOrchestrator().resumeCampaign(campaignId);

    return res.json({
      success: true,
      message: 'Campaign resumed successfully',
      data: { campaignId, status: 'active' }
    });
  } catch (error) {
    logger.error(`Failed to resume campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resume campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get campaign progress
router.get('/:id/progress', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const progress = await getWorkflowOrchestrator().getCampaignProgress(campaignId);

    return res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    logger.error(`Failed to get campaign progress: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get campaign progress',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get campaign statistics
router.get('/:id/stats', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const stats = await getWorkflowOrchestrator().getWorkflowStatus(campaignId);

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Failed to get campaign stats: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get campaign statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Retry failed jobs for campaign
router.post('/:id/retry', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const result = await getWorkflowOrchestrator().retryFailedJobs(campaignId);

    return res.json({
      success: true,
      message: 'Failed jobs retried successfully',
      data: result
    });
  } catch (error) {
    logger.error(`Failed to retry jobs for campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retry failed jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get campaign email jobs
router.get('/:id/jobs', validateParams(schemas.objectId), validateQuery(schemas.pagination), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      EmailJobModel.find({ campaignId })
        .populate('prospectId', 'website contactEmail companyName status')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailJobModel.countDocuments({ campaignId })
    ]);

    return res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Failed to get campaign jobs: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get campaign jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get prospects assigned to campaign
router.get('/:id/prospects', validateParams(schemas.objectId), validateQuery(schemas.pagination), async (req, res) => {
  try {
    const campaignId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sort = req.query.sort as string || '-createdAt';
    const skip = (page - 1) * limit;

    const [prospects, total] = await Promise.all([
      ProspectModel.find({ campaignIds: campaignId })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ProspectModel.countDocuments({ campaignIds: campaignId })
    ]);

    return res.json({
      success: true,
      data: {
        prospects,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error(`Failed to get prospects for campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get campaign prospects',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get campaign scraping statistics
router.get('/:id/scraping-stats', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;

    const stats = await ProspectModel.aggregate([
      { $match: { campaignIds: campaignId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result: Record<string, number> = {};
    stats.forEach(stat => {
      result[stat._id] = stat.count;
    });

    const scrapingStats = {
      pending: result['pending'] || 0,
      scraped: result['scraped'] || 0,
      failed: result['failed'] || 0,
      total: Object.values(result).reduce((sum, count) => sum + count, 0)
    };

    return res.json({
      success: true,
      data: scrapingStats
    });
  } catch (error) {
    logger.error(`Failed to get scraping stats for campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get scraping statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get campaign email statistics
router.get('/:id/email-stats', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;

    const stats = await EmailJobModel.aggregate([
      { $match: { campaignId: campaignId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result: Record<string, number> = {};
    stats.forEach(stat => {
      result[stat._id] = stat.count;
    });

    const emailStats = {
      queued: result['queued'] || 0,
      processing: result['processing'] || 0,
      completed: result['completed'] || 0,
      failed: result['failed'] || 0,
      total: Object.values(result).reduce((sum, count) => sum + count, 0)
    };

    return res.json({
      success: true,
      data: emailStats
    });
  } catch (error) {
    logger.error(`Failed to get email stats for campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get email statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk scrape campaign prospects
router.post('/:id/bulk-scrape', validateParams(schemas.objectId), async (req, res) => {
  try {
    const campaignId = req.params.id;

    // Find unscraped prospects in this campaign
    const unscrapedProspects = await ProspectModel.find({
      campaignIds: campaignId,
      status: { $in: ['pending', 'failed'] }
    }).select('_id');

    const prospectIds = unscrapedProspects.map(p => p._id.toString());

    if (prospectIds.length === 0) {
      return res.json({
        success: true,
        message: 'No unscraped prospects found in this campaign',
        data: { 
          prospectCount: 0,
          campaignId
        }
      });
    }

    // Start bulk scraping process
    const scrapingService = new ScrapingService();
    scrapingService.scrapeBatch(prospectIds, 5).catch(error => {
      logger.error('Background campaign bulk scraping failed', error);
    });

    logger.info('Campaign bulk scraping started', {
      campaignId,
      prospectCount: prospectIds.length
    });

    return res.json({
      success: true,
      message: 'Campaign bulk scraping started',
      data: { 
        prospectCount: prospectIds.length,
        campaignId,
        status: 'bulk_scraping_started'
      }
    });
  } catch (error) {
    logger.error(`Failed to start campaign bulk scraping: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start campaign bulk scraping',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;