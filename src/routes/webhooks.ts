import { Router, Request, Response } from 'express';
import { MissiveResponseMonitor, MissiveWebhookEvent } from '@/services/missive/MissiveResponseMonitor';
import { logger } from '@/utils/logger';
import { config } from '@/config';

const router = Router();

/**
 * Middleware to verify webhook signature
 */
function verifyWebhookSignature(req: Request, res: Response, next: Function) {
  const signature = req.headers['x-missive-signature'] as string;
  const webhookSecret = config.missive.webhookSecret;

  if (!webhookSecret) {
    logger.warn('Missive webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!signature) {
    logger.warn('Missing webhook signature in request headers');
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  // Store for use in handlers
  req.webhookSignature = signature;
  req.webhookSecret = webhookSecret;
  next();
}

/**
 * Middleware to parse webhook payload as text for signature verification
 */
function parseWebhookPayload(req: Request, res: Response, next: Function) {
  let rawBody = '';

  req.on('data', (chunk) => {
    rawBody += chunk.toString();
  });

  req.on('end', () => {
    try {
      req.rawBody = rawBody;
      req.body = JSON.parse(rawBody);
      next();
    } catch (error) {
      logger.error('Failed to parse webhook payload', error);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  });
}

/**
 * Handle Missive webhooks for real-time response notifications
 */
router.post('/missive', 
  parseWebhookPayload,
  verifyWebhookSignature,
  async (req: Request, res: Response) => {
    try {
      const webhookEvent: MissiveWebhookEvent = req.body;
      const signature = req.webhookSignature;
      const secret = req.webhookSecret;

      logger.info('Received Missive webhook', {
        type: webhookEvent.type,
        conversationId: webhookEvent.conversation?.id,
        messageId: webhookEvent.message?.id
      });

      // Get the response monitor instance
      const responseMonitor = MissiveResponseMonitor.getInstance();

      // Process the webhook
      await responseMonitor.handleWebhook(webhookEvent, signature, secret);

      // Send success response
      res.status(200).json({ 
        success: true,
        processed: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to process Missive webhook', {
        error: errorMessage,
        webhookType: req.body?.type,
        conversationId: req.body?.conversation?.id
      });

      // Return error response
      res.status(500).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Webhook health check endpoint
 */
router.get('/missive/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'missive-webhook-handler',
    timestamp: new Date().toISOString(),
    webhookSecretConfigured: !!config.missive.webhookSecret
  });
});

/**
 * Test webhook endpoint (for development/testing)
 */
router.post('/missive/test', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Test endpoint not available in production' });
  }

  try {
    const testEvent: MissiveWebhookEvent = {
      type: 'message_added',
      conversation: {
        id: 'test_conversation_123',
        subject: 'Test Response',
        participants: [
          { email: 'test@example.com', name: 'Test User' }
        ]
      },
      message: {
        id: 'test_message_456',
        body: 'This is a test response message',
        preview: 'This is a test response message',
        from: 'test@example.com',
        created_at: new Date().toISOString(),
        author: {
          email: 'test@example.com',
          name: 'Test User'
        }
      }
    };

    const responseMonitor = MissiveResponseMonitor.getInstance();
    await responseMonitor.handleWebhook(testEvent);

    res.status(200).json({
      success: true,
      message: 'Test webhook processed successfully',
      testEvent,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Test webhook processing failed', error);
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Manual trigger for response monitoring (for testing/admin)
 */
router.post('/missive/monitor-responses', async (req: Request, res: Response) => {
  try {
    const { lookbackDays = 7, emailJobId } = req.body;

    const responseMonitor = MissiveResponseMonitor.getInstance();

    if (emailJobId) {
      // Check specific email job
      await responseMonitor.manualResponseCheck(emailJobId);
      
      res.status(200).json({
        success: true,
        message: `Manual response check completed for email job: ${emailJobId}`,
        timestamp: new Date().toISOString()
      });
    } else {
      // Trigger general response monitoring
      const stats = await responseMonitor.getMonitoringStats();
      
      res.status(200).json({
        success: true,
        message: 'Response monitoring stats retrieved',
        stats,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('Manual response monitoring failed', error);
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// Extend Express Request interface to include webhook properties
declare global {
  namespace Express {
    interface Request {
      webhookSignature?: string;
      webhookSecret?: string;
      rawBody?: string;
    }
  }
}

export default router;