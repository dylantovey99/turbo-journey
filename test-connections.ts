import { config } from './src/config';
import { logger } from './src/utils/logger';
import { connectDatabase } from './src/models/database';
import { connectRedis } from './src/services/queue/redis';

async function testConnections() {
  try {
    console.log('Testing database connection...');
    await connectDatabase();
    console.log('✅ Database connected successfully');

    console.log('Testing Redis connection...');
    await connectRedis();
    console.log('✅ Redis connected successfully');

    console.log('All connections successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testConnections();