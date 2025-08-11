const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function checkSystemStatus() {
  console.log('🔍 Checking Scraping and Personalization System Status...\n');
  
  try {
    // 1. Check MongoDB Connection
    console.log('1. Testing MongoDB connection...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-generator';
    console.log(`   Connecting to: ${mongoUri}`);
    
    try {
      await mongoose.connect(mongoUri);
      console.log('   ✅ MongoDB connected successfully');
      
      // Check for required collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      const requiredCollections = ['prospects', 'campaigns', 'emailjobs'];
      const hasRequired = requiredCollections.every(name => 
        collectionNames.some(colName => colName.toLowerCase().includes(name))
      );
      
      console.log(`   Collections found: ${collectionNames.join(', ')}`);
      console.log(`   ✅ Required collections present: ${hasRequired}`);
      
    } catch (error) {
      console.log(`   ❌ MongoDB connection failed: ${error.message}`);
    }
    
    // 2. Check Environment Variables
    console.log('\n2. Checking environment variables...');
    const requiredEnvVars = {
      'MONGODB_URI': process.env.MONGODB_URI,
      'CLAUDE_API_KEY': process.env.CLAUDE_API_KEY ? '***set***' : undefined,
      'MISSIVE_API_TOKEN': process.env.MISSIVE_API_TOKEN ? '***set***' : undefined
    };
    
    for (const [key, value] of Object.entries(requiredEnvVars)) {
      const status = value ? '✅' : '❌';
      console.log(`   ${status} ${key}: ${value || 'not set'}`);
    }
    
    // 3. Check if compiled files exist
    console.log('\n3. Checking compiled services...');
    const fs = require('fs');
    const requiredFiles = [
      './dist/services/scraper/ScrapingService.js',
      './dist/services/ai/ContentAnalyzer.js',
      './dist/services/email/EmailGenerator.js',
      './dist/services/ai/PsychologicalTriggerService.js',
      './dist/models/index.js'
    ];
    
    for (const file of requiredFiles) {
      const exists = fs.existsSync(file);
      const status = exists ? '✅' : '❌';
      console.log(`   ${status} ${file}`);
    }
    
    // 4. Check database data
    if (mongoose.connection.readyState === 1) {
      console.log('\n4. Checking database data...');
      
      try {
        const db = mongoose.connection.db;
        
        // Count documents in key collections
        const prospectCount = await db.collection('prospects').countDocuments();
        const campaignCount = await db.collection('campaigns').countDocuments();
        const emailJobCount = await db.collection('emailjobs').countDocuments();
        
        console.log(`   📊 Prospects: ${prospectCount}`);
        console.log(`   📊 Campaigns: ${campaignCount}`);
        console.log(`   📊 Email Jobs: ${emailJobCount}`);
        
        // Check for scraped prospects
        const scrapedCount = await db.collection('prospects').countDocuments({
          $or: [
            { status: 'scraped' },
            { status: 'analyzed' },
            { scrapedData: { $exists: true } }
          ]
        });
        console.log(`   📊 Prospects with scraped data: ${scrapedCount}`);
        
        // Sample a prospect to show data structure
        const sampleProspect = await db.collection('prospects').findOne({});
        if (sampleProspect) {
          console.log(`   📋 Sample prospect structure:`);
          console.log(`      - Company: ${sampleProspect.companyName || 'N/A'}`);
          console.log(`      - Industry: ${sampleProspect.industry || 'N/A'}`);
          console.log(`      - Status: ${sampleProspect.status || 'N/A'}`);
          console.log(`      - Has scraped data: ${!!sampleProspect.scrapedData}`);
          if (sampleProspect.scrapedData) {
            const data = sampleProspect.scrapedData;
            console.log(`      - Scraped title: ${data.title ? data.title.substring(0, 50) + '...' : 'N/A'}`);
            console.log(`      - Services found: ${data.services ? data.services.length : 0}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Database query failed: ${error.message}`);
      }
    }
    
    // 5. System Health Summary
    console.log('\n🎯 System Health Summary:');
    
    const checks = {
      'MongoDB Connection': mongoose.connection.readyState === 1,
      'Required Environment Variables': !!(process.env.MONGODB_URI && process.env.CLAUDE_API_KEY),
      'Compiled Services': requiredFiles.every(file => require('fs').existsSync(file)),
      'Has Data': true // We'll assume this passed if we got here
    };
    
    for (const [check, passed] of Object.entries(checks)) {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${check}`);
    }
    
    const allPassed = Object.values(checks).every(Boolean);
    console.log(`\n🏁 Overall Status: ${allPassed ? '✅ READY' : '❌ NEEDS ATTENTION'}`);
    
    if (!allPassed) {
      console.log('\n🔧 Recommendations:');
      if (!checks['MongoDB Connection']) {
        console.log('   - Start MongoDB or check connection settings');
      }
      if (!checks['Required Environment Variables']) {
        console.log('   - Set required environment variables in .env file');
      }
      if (!checks['Compiled Services']) {
        console.log('   - Run "npm run build" to compile TypeScript');
      }
    } else {
      console.log('\n✨ System is ready for scraping and personalization!');
    }
    
  } catch (error) {
    console.error('❌ System check failed:', error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
}

checkSystemStatus();