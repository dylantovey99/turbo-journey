import express from 'express';
import { connectDatabase } from './models/database';
import { connectRedis } from './services/queue/redis';
import { logger } from './utils/logger';

async function testDevServer() {
  const app = express();
  
  try {
    console.log('Testing development server...');
    
    // Test database connection
    console.log('Connecting to database...');
    await connectDatabase();
    logger.info('Database connected successfully');
    
    // Test Redis connection  
    console.log('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected successfully');
    
    // Start basic server
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Development server test successful'
      });
    });
    
    const server = app.listen(3002, () => {
      console.log('Development test server running on port 3002');
      console.log('Visit: http://localhost:3002/health');
      
      // Auto-shutdown after 5 seconds
      setTimeout(() => {
        console.log('Test completed - shutting down...');
        server.close();
        process.exit(0);
      }, 5000);
    });
    
  } catch (error) {
    console.error('Development server test failed:', error);
    process.exit(1);
  }
}

testDevServer();