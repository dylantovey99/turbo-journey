import express from 'express';
import multer from 'multer';
import path from 'path';
import { BulkImportJobModel } from '@/models';
import { WorkflowOrchestrator } from '@/services/workflow';
import { validateParams, validateQuery, schemas } from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = express.Router();
let workflowOrchestrator: WorkflowOrchestrator | null = null;

function getWorkflowOrchestrator(): WorkflowOrchestrator {
  if (!workflowOrchestrator) {
    workflowOrchestrator = new WorkflowOrchestrator();
  }
  return workflowOrchestrator;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Upload and process CSV file
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a CSV file'
      });
    }

    const { campaignId } = req.body;
    const filePath = req.file.path;

    logger.info('Starting bulk import', {
      filename: req.file.originalname,
      size: req.file.size,
      campaignId
    });

    // Start bulk import process
    const jobId = await getWorkflowOrchestrator().processBulkImport(filePath, campaignId);

    return res.json({
      success: true,
      message: 'Bulk import started successfully',
      data: {
        jobId,
        filename: req.file.originalname,
        status: 'processing'
      }
    });
  } catch (error) {
    logger.error('Failed to start bulk import', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start bulk import',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get bulk import job status
router.get('/jobs/:id', validateParams(schemas.objectId), async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await getWorkflowOrchestrator().getBulkImportStatus(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Bulk import job not found'
      });
    }

    return res.json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error(`Failed to get bulk import job: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bulk import job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all bulk import jobs with pagination
router.get('/jobs', validateQuery(schemas.pagination), async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sort = req.query.sort as string || '-createdAt';

    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      BulkImportJobModel.find()
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      BulkImportJobModel.countDocuments()
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
    logger.error('Failed to get bulk import jobs', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bulk import jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download CSV template
router.get('/template', (req, res) => {
  try {
    const csvTemplate = `website,contactEmail,contactName,companyName,industry
https://example.com,contact@example.com,John Doe,Example Company,Technology
https://another-example.com,info@another-example.com,Jane Smith,Another Company,Marketing`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=prospects-template.csv');
    return res.send(csvTemplate);
  } catch (error) {
    logger.error('Failed to generate CSV template', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate CSV template',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get bulk import statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await BulkImportJobModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalProspects: { $sum: '$totalProspects' },
          successfulProspects: { $sum: '$successfulProspects' },
          failedProspects: { $sum: '$failedProspects' }
        }
      }
    ]);

    const result: any = {
      totalJobs: 0,
      totalProspects: 0,
      successfulProspects: 0,
      failedProspects: 0,
      byStatus: {}
    };

    stats.forEach(stat => {
      result.totalJobs += stat.count;
      result.totalProspects += stat.totalProspects || 0;
      result.successfulProspects += stat.successfulProspects || 0;
      result.failedProspects += stat.failedProspects || 0;
      result.byStatus[stat._id] = {
        count: stat.count,
        totalProspects: stat.totalProspects || 0,
        successfulProspects: stat.successfulProspects || 0,
        failedProspects: stat.failedProspects || 0
      };
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to get bulk import statistics', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bulk import statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel bulk import job
router.post('/jobs/:id/cancel', validateParams(schemas.objectId), async (req, res) => {
  try {
    const jobId = req.params.id;
    
    const job = await BulkImportJobModel.findByIdAndUpdate(
      jobId,
      { status: 'failed' },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Bulk import job not found'
      });
    }

    logger.info('Bulk import job cancelled', { jobId });

    return res.json({
      success: true,
      message: 'Bulk import job cancelled successfully',
      data: job
    });
  } catch (error) {
    logger.error(`Failed to cancel bulk import job: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel bulk import job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get bulk import job errors
router.get('/jobs/:id/errors', validateParams(schemas.objectId), async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await BulkImportJobModel.findById(jobId).select('importErrors filename status');

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Bulk import job not found'
      });
    }

    return res.json({
      success: true,
      data: {
        jobId,
        filename: job.filename,
        status: job.status,
        errors: job.importErrors || [],
        errorCount: job.importErrors?.length || 0
      }
    });
  } catch (error) {
    logger.error(`Failed to get bulk import job errors: ${req.params.id}`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bulk import job errors',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;