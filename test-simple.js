console.log('Testing basic Node.js functionality...');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Memory usage:', process.memoryUsage());

try {
  const fs = require('fs');
  console.log('File system access: OK');
  
  const path = require('path');
  console.log('Path module: OK');
  
  // Test mongoose
  const mongoose = require('mongoose');
  console.log('Mongoose import: OK');
  
  // Test redis
  const redis = require('redis');
  console.log('Redis import: OK');
  
  console.log('All basic imports successful');
} catch (error) {
  console.error('Error during imports:', error.message);
  process.exit(1);
}