import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { connectDatabase } from '@/models/database';
import { connectRedis } from '@/services/queue/redis';
import apiRoutes from '@/routes';
import fs from 'fs';
import { errorHandler, notFoundHandler, setupGlobalErrorHandlers, rateLimitHandler } from '@/utils/errorHandler';
import { WebSocketServer } from 'ws';

const app = express();

const wss = new WebSocketServer({ noServer: true });

import { appEmitter } from './events';

wss.on('connection', (ws) => {
  logger.info('Client connected to WebSocket');
  ws.on('close', () => {
    logger.info('Client disconnected from WebSocket');
  });
});

appEmitter.on('broadcast', (data) => {
  broadcast(data);
});

export const broadcast = (data: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(data));
    }
  });
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for dashboard)
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.tailwindcss.com",
        "https://unpkg.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'",
        "https://cdn.tailwindcss.com",
        "http://localhost:3000/node_modules/antd/dist/antd.css"
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  },
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Serve static files
app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Ensure uploads directory exists
const uploadsDir = 'uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Dashboard routes
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.get('/dashboard', (req, res) => {
  res.redirect('/');
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Personalized Email Generator API',
    version: '1.0.0',
    description: 'AI-powered personalized email generation with Missive integration',
    documentation: '/api/v1/docs'
  });
});

// API routes
app.use('/api/v1', apiRoutes);

// Error handling middleware (must be after routes)
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    // Setup global error handlers
    setupGlobalErrorHandlers();
    
    await connectDatabase();
    logger.info('Database connected successfully');
    
    await connectRedis();
    logger.info('Redis connected successfully');
    
    const server = app.listen(config.server.port, '0.0.0.0', () => {
      logger.info(`Server running on port ${config.server.port} in ${config.server.nodeEnv} mode`);
      logger.info('🚀 Personalized Email Generator API is ready!');
      logger.info(`📊 Dashboard available at: http://localhost:${config.server.port}`);
      logger.info(`📚 API Documentation: http://localhost:${config.server.port}/api/v1/docs`);
    });

    server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
    
    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...');
      
      server.close(async () => {
        try {
          // Close database connections
          const { disconnectDatabase } = await import('@/models/database');
          await disconnectDatabase();
          
          // Close Redis connections
          const { disconnectRedis } = await import('@/services/queue/redis');
          await disconnectRedis();
          
          // Close queue workers
          const { EmailQueue, BulkImportQueue } = await import('@/services/queue');
          await EmailQueue.getInstance().close();
          await BulkImportQueue.getInstance().close();
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
      
      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;