import express from 'express';
import { ProspectModel } from '@/models';
import { ScrapingService } from '@/services/scraper';
import { validateRequest, validateParams, validateQuery, schemas } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { APIResponse } from '@/types';

const router = express.Router();
const scrapingService = new ScrapingService();

// Get all prospects with pagination and filtering
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
          { website: { $regex: filter, $options: 'i' } },
          { contactEmail: { $regex: filter, $options: 'i' } },
          { companyName: { $regex: filter, $options: 'i' } },
          { industry: { $regex: filter, $options: 'i' } }
        ]
      };
    }

    const [prospects, total] = await Promise.all([
      ProspectModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      ProspectModel.countDocuments(query)
    ]);

    const response: APIResponse = {
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
    };

    return res.json(response);
  } catch (error) {
    logger.error('Failed to get prospects', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get prospects',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get prospect by ID
router.get('/:id', validateParams(schemas.objectId), async (req, res) => {
  try {
    const prospect = await ProspectModel.findById(req.params.id);
    
    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }

    return res.json({
      success: true,
      data: prospect
    });
  } catch (error) {
    logger.error(`Failed to get prospect: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get prospect',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new prospect
router.post('/', (req, res, next) => {
  // Clean empty strings from optional fields before validation
  if (req.body.contactName === '') delete req.body.contactName;
  if (req.body.companyName === '') delete req.body.companyName;
  if (req.body.industry === '') delete req.body.industry;
  
  // Auto-add https:// if missing from website
  if (req.body.website && !req.body.website.match(/^https?:\/\//)) {
    req.body.website = 'https://' + req.body.website;
  }
  
  next();
}, validateRequest(schemas.prospect), async (req, res) => {
  try {
    const prospectData = req.body;
    
    // Check if prospect already exists
    const existingProspect = await ProspectModel.findOne({
      website: prospectData.website
    });

    if (existingProspect) {
      return res.status(409).json({
        success: false,
        error: 'Prospect already exists',
        message: `Prospect with website ${prospectData.website} already exists`
      });
    }

    const prospect = await ProspectModel.create(prospectData);

    logger.info('Prospect created', {
      id: prospect._id,
      website: prospect.website,
      email: prospect.contactEmail
    });

    return res.status(201).json({
      success: true,
      data: prospect,
      message: 'Prospect created successfully'
    });
  } catch (error) {
    logger.error('Failed to create prospect', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create prospect',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update prospect
router.patch('/:id', validateParams(schemas.objectId), async (req, res) => {
  try {
    const prospect = await ProspectModel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }

    logger.info('Prospect updated', {
      id: prospect._id,
      website: prospect.website
    });

    return res.json({
      success: true,
      data: prospect,
      message: 'Prospect updated successfully'
    });
  } catch (error) {
    logger.error(`Failed to update prospect: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update prospect',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete prospect
router.delete('/:id', validateParams(schemas.objectId), async (req, res) => {
  try {
    const prospect = await ProspectModel.findByIdAndDelete(req.params.id);

    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }

    logger.info('Prospect deleted', {
      id: prospect._id,
      website: prospect.website
    });

    return res.json({
      success: true,
      message: 'Prospect deleted successfully'
    });
  } catch (error) {
    logger.error(`Failed to delete prospect: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete prospect',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Scrape prospect website
router.post('/:id/scrape', validateParams(schemas.objectId), async (req, res) => {
  try {
    const prospectId = req.params.id;
    const prospect = await ProspectModel.findById(prospectId);

    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }

    // Start scraping process
    scrapingService.scrapeProspect(prospectId).catch(error => {
      logger.error(`Background scraping failed for prospect: ${prospectId}`, error);
    });

    return res.json({
      success: true,
      message: 'Scraping started for prospect',
      data: { prospectId, status: 'scraping_started' }
    });
  } catch (error) {
    logger.error(`Failed to start scraping for prospect: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start scraping',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get prospect statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await scrapingService.getScrapingStats();

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get prospect statistics', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch scrape prospects
router.post('/batch/scrape', async (req, res) => {
  try {
    const { prospectIds, batchSize = 5 } = req.body;

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prospect IDs'
      });
    }

    // Start batch scraping process
    scrapingService.scrapeBatch(prospectIds, batchSize).catch(error => {
      logger.error('Background batch scraping failed', error);
    });

    return res.json({
      success: true,
      message: 'Batch scraping started',
      data: { 
        prospectIds: prospectIds.length,
        batchSize,
        status: 'batch_scraping_started'
      }
    });
  } catch (error) {
    logger.error('Failed to start batch scraping', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start batch scraping',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk assign prospects to campaign
router.post('/bulk/assign-campaign', async (req, res) => {
  try {
    const { prospectIds, campaignId } = req.body;

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid prospect IDs array'
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required'
      });
    }

    // Update all prospects to include the campaign
    const result = await ProspectModel.updateMany(
      { _id: { $in: prospectIds } },
      { 
        $addToSet: { campaignIds: campaignId },
        assignedAt: new Date()
      }
    );

    logger.info('Bulk prospect assignment completed', {
      campaignId,
      prospectCount: prospectIds.length,
      modified: result.modifiedCount
    });

    return res.json({
      success: true,
      message: 'Prospects assigned to campaign successfully',
      data: {
        prospectCount: prospectIds.length,
        modified: result.modifiedCount,
        campaignId
      }
    });
  } catch (error) {
    logger.error('Failed to bulk assign prospects to campaign', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to bulk assign prospects to campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Bulk scrape all unscraped prospects
router.post('/bulk/scrape-all', async (req, res) => {
  try {
    const { campaignId } = req.body;

    // Build query to find unscraped prospects
    const query: any = {
      status: { $in: ['pending', 'failed'] }
    };

    // If campaignId is provided, filter by campaign
    if (campaignId) {
      query.campaignIds = campaignId;
    }

    const unscrapedProspects = await ProspectModel.find(query).select('_id');
    const prospectIds = unscrapedProspects.map(p => p._id.toString());

    if (prospectIds.length === 0) {
      return res.json({
        success: true,
        message: 'No unscraped prospects found',
        data: { 
          prospectCount: 0,
          campaignId: campaignId || 'all'
        }
      });
    }

    // Start bulk scraping process
    scrapingService.scrapeBatch(prospectIds, 5).catch(error => {
      logger.error('Background bulk scraping failed', error);
    });

    logger.info('Bulk scraping all unscraped prospects started', {
      campaignId: campaignId || 'all',
      prospectCount: prospectIds.length
    });

    return res.json({
      success: true,
      message: 'Bulk scraping started for all unscraped prospects',
      data: { 
        prospectCount: prospectIds.length,
        campaignId: campaignId || 'all',
        status: 'bulk_scraping_started'
      }
    });
  } catch (error) {
    logger.error('Failed to start bulk scraping for all unscraped prospects', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start bulk scraping',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Assign prospect to campaign
router.post('/:id/assign-campaign', validateParams(schemas.objectId), async (req, res) => {
  try {
    const prospectId = req.params.id;
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required'
      });
    }

    const prospect = await ProspectModel.findById(prospectId);
    if (!prospect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }

    // Check if prospect is already assigned to this campaign
    if (prospect.campaignIds && prospect.campaignIds.includes(campaignId)) {
      return res.status(400).json({
        success: false,
        error: 'Prospect is already assigned to this campaign'
      });
    }

    // Add campaign to prospect's campaign list
    const updatedProspect = await ProspectModel.findByIdAndUpdate(
      prospectId,
      { 
        $addToSet: { campaignIds: campaignId },
        assignedAt: new Date()
      },
      { new: true }
    );

    logger.info('Prospect assigned to campaign', {
      prospectId,
      campaignId,
      website: prospect.website
    });

    return res.json({
      success: true,
      message: 'Prospect assigned to campaign successfully',
      data: updatedProspect
    });
  } catch (error) {
    logger.error(`Failed to assign prospect to campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to assign prospect to campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Remove prospect from campaign
router.delete('/:id/campaign/:campaignId', validateParams(schemas.objectId), async (req, res) => {
  try {
    const prospectId = req.params.id;
    const { campaignId } = req.params;

    const updatedProspect = await ProspectModel.findByIdAndUpdate(
      prospectId,
      { $pull: { campaignIds: campaignId } },
      { new: true }
    );

    if (!updatedProspect) {
      return res.status(404).json({
        success: false,
        error: 'Prospect not found'
      });
    }

    logger.info('Prospect removed from campaign', {
      prospectId,
      campaignId,
      website: updatedProspect.website
    });

    return res.json({
      success: true,
      message: 'Prospect removed from campaign successfully',
      data: updatedProspect
    });
  } catch (error) {
    logger.error(`Failed to remove prospect from campaign: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove prospect from campaign',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;