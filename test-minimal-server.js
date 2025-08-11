const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');

console.log('Starting minimal server test...');

async function testConnections() {
  try {
    // Test MongoDB connection
    console.log('Testing MongoDB connection...');
    await mongoose.connect('mongodb://localhost:27017/email-generator');
    console.log('MongoDB: Connected successfully');
    
    // Test Redis connection
    console.log('Testing Redis connection...');
    const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
    await redisClient.connect();
    console.log('Redis: Connected successfully');
    
    // Test Express server
    console.log('Testing Express server...');
    const app = express();
    
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });
    
    const server = app.listen(3001, () => {
      console.log('Express server running on port 3001');
      console.log('Test successful - shutting down...');
      
      // Clean shutdown
      server.close(async () => {
        await mongoose.disconnect();
        await redisClient.disconnect();
        console.log('All connections closed successfully');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

testConnections();