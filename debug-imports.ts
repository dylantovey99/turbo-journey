console.log('🔍 Starting import debugging...');

try {
  console.log('1. Testing express...');
  const express = require('express');
  console.log('✅ Express OK');

  console.log('2. Testing config...');
  const { config } = require('./src/config');
  console.log('✅ Config OK');

  console.log('3. Testing logger...');
  const { logger } = require('./src/utils/logger');
  console.log('✅ Logger OK');

  console.log('4. Testing database...');
  const { connectDatabase } = require('./src/models/database');
  console.log('✅ Database import OK');

  console.log('5. Testing redis...');
  const { connectRedis } = require('./src/services/queue/redis');
  console.log('✅ Redis import OK');

  console.log('6. Testing routes (this might hang)...');
  const apiRoutes = require('./src/routes');
  console.log('✅ Routes imported successfully!');

  console.log('🎉 All imports successful!');
} catch (error) {
  console.error('❌ Import failed:', error.message);
  console.error(error.stack);
}