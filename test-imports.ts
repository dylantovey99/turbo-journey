console.log('Testing imports...');

console.log('1. Testing config import...');
import { config } from './src/config';
console.log('✅ Config imported successfully');

console.log('2. Testing logger import...');
import { logger } from './src/utils/logger';
console.log('✅ Logger imported successfully');

console.log('3. Testing database import...');
import { connectDatabase } from './src/models/database';
console.log('✅ Database import successful');

console.log('4. Testing redis import...');
import { connectRedis } from './src/services/queue/redis';
console.log('✅ Redis import successful');

console.log('5. Testing routes import...');
import apiRoutes from './src/routes';
console.log('✅ Routes imported successfully');

console.log('All imports completed successfully!');