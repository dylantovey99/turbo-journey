#!/usr/bin/env node

/**
 * Database migration script
 * Run with: node scripts/migrate.js
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Import models to ensure they're registered
require('../dist/models/Prospect');
require('../dist/models/Campaign');
require('../dist/models/EmailJob');
require('../dist/models/BulkImportJob');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-generator';

async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

async function createIndexes() {
  console.log('📚 Creating database indexes...');
  
  try {
    const db = mongoose.connection.db;
    
    // Prospects indexes
    await db.collection('prospects').createIndex({ website: 1 }, { unique: true });
    await db.collection('prospects').createIndex({ contactEmail: 1 });
    await db.collection('prospects').createIndex({ status: 1 });
    await db.collection('prospects').createIndex({ createdAt: -1 });
    console.log('✅ Prospects indexes created');
    
    // Campaigns indexes
    await db.collection('campaigns').createIndex({ name: 1 });
    await db.collection('campaigns').createIndex({ status: 1 });
    await db.collection('campaigns').createIndex({ createdAt: -1 });
    console.log('✅ Campaigns indexes created');
    
    // Email jobs indexes
    await db.collection('emailjobs').createIndex({ prospectId: 1, campaignId: 1 }, { unique: true });
    await db.collection('emailjobs').createIndex({ status: 1 });
    await db.collection('emailjobs').createIndex({ createdAt: -1 });
    await db.collection('emailjobs').createIndex({ campaignId: 1, status: 1 });
    console.log('✅ Email jobs indexes created');
    
    // Bulk import jobs indexes
    await db.collection('bulkimportjobs').createIndex({ status: 1 });
    await db.collection('bulkimportjobs').createIndex({ createdAt: -1 });
    console.log('✅ Bulk import jobs indexes created');
    
  } catch (error) {
    console.error('❌ Failed to create indexes:', error);
    throw error;
  }
}

async function seedExampleData() {
  console.log('🌱 Seeding example data...');
  
  try {
    const db = mongoose.connection.db;
    
    // Check if we already have data
    const prospectCount = await db.collection('prospects').countDocuments();
    const campaignCount = await db.collection('campaigns').countDocuments();
    
    if (prospectCount > 0 || campaignCount > 0) {
      console.log('📊 Database already contains data, skipping seed');
      return;
    }
    
    // Insert example campaign
    const campaignResult = await db.collection('campaigns').insertOne({
      name: 'AI Software Outreach Campaign',
      marketingDocument: `We provide cutting-edge AI solutions that help businesses automate their workflows and increase productivity by up to 40%. Our proprietary machine learning algorithms are trained on industry-specific data to deliver personalized results. 

Key benefits:
- Reduce manual work by 60%
- Increase accuracy by 35% 
- 24/7 automated processing
- Easy integration with existing systems
- Dedicated support team

We've helped over 500 companies transform their operations with AI.`,
      usps: [
        'Increase productivity by up to 40%',
        'Reduce manual work by 60%',
        'Improve accuracy by 35%',
        '24/7 automated processing',
        'Easy integration with existing systems',
        'Dedicated support team',
        'Proven results with 500+ companies'
      ],
      targetAudience: 'Technology companies and startups looking to automate their workflows',
      tone: 'professional',
      missiveAccountId: 'example-account-id',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log('✅ Example campaign created');
    
    // Insert example prospects
    const prospects = [
      {
        website: 'https://example-startup.com',
        contactEmail: 'ceo@example-startup.com',
        contactName: 'John Smith',
        companyName: 'Example Startup Inc',
        industry: 'Technology',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        website: 'https://tech-solutions.com',
        contactEmail: 'info@tech-solutions.com',
        contactName: 'Sarah Johnson',
        companyName: 'Tech Solutions LLC',
        industry: 'Software Development',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        website: 'https://innovate-corp.com',
        contactEmail: 'contact@innovate-corp.com',
        contactName: 'Mike Wilson',
        companyName: 'Innovate Corp',
        industry: 'Consulting',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await db.collection('prospects').insertMany(prospects);
    console.log('✅ Example prospects created');
    
  } catch (error) {
    console.error('❌ Failed to seed example data:', error);
    throw error;
  }
}

async function checkCollections() {
  console.log('🔍 Checking collections...');
  
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const requiredCollections = ['prospects', 'campaigns', 'emailjobs', 'bulkimportjobs'];
    const existingCollections = collections.map(col => col.name);
    
    for (const collectionName of requiredCollections) {
      if (existingCollections.includes(collectionName)) {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`✅ Collection '${collectionName}' exists with ${count} documents`);
      } else {
        console.log(`⚠️  Collection '${collectionName}' does not exist`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to check collections:', error);
    throw error;
  }
}

async function runMigration() {
  console.log('🚀 Starting database migration...');
  console.log(`📍 MongoDB URI: ${MONGODB_URI}`);
  
  try {
    await connectDatabase();
    await createIndexes();
    await checkCollections();
    
    // Only seed data if explicitly requested
    if (process.argv.includes('--seed')) {
      await seedExampleData();
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Database connection closed');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  createIndexes,
  seedExampleData,
  checkCollections
};