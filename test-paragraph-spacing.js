const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testParagraphSpacing() {
  console.log('🧪 TESTING PARAGRAPH SPACING IMPROVEMENTS...\n');
  
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('email-generator');
    
    // Find a prospect with good data for testing
    const prospect = await db.collection('prospects').findOne({
      'scrapedData.services': { $exists: true, $ne: [] }
    });
    
    // Find the campaign
    const campaign = await db.collection('campaigns').findOne();
    
    if (prospect && campaign) {
      // Create a test email job for paragraph spacing
      try {
        const emailJob = await db.collection('emailjobs').insertOne({
          prospectId: prospect._id,
          campaignId: campaign._id,
          status: 'queued',
          attempts: 0,
          createdAt: new Date(),
          testNote: 'paragraph-spacing-test'
        });
        
        console.log('✅ Created test email job for paragraph spacing:', emailJob.insertedId);
        console.log('📧 Prospect:', prospect.companyName || 'Test prospect');
        console.log('📊 Services available:', prospect.scrapedData?.services?.slice(0, 2).join(', '));
        
        console.log('\n🎯 Test Job ID:', emailJob.insertedId);
        console.log('🚀 Start server with: PORT=3001 npm run dev');
        console.log('📧 Then generate email to test paragraph spacing');
        
      } catch (duplicateError) {
        // If duplicate, find the existing job
        const existingJob = await db.collection('emailjobs').findOne({
          prospectId: prospect._id,
          campaignId: campaign._id
        });
        
        if (existingJob) {
          console.log('✅ Using existing email job for paragraph spacing test:', existingJob._id);
          console.log('🎯 Test Job ID:', existingJob._id);
        }
      }
      
      console.log('\n📋 PARAGRAPH SPACING TEST CHECKLIST:');
      console.log('   1. ✅ Enhanced ClaudeClient prompt with explicit paragraph examples');
      console.log('   2. ✅ Added HTML paragraph validation and <p> tag wrapping');
      console.log('   3. ✅ Added text email paragraph detection and spacing');
      console.log('   4. ⏳ Generate test email to verify spacing works');
      
    } else {
      console.log('❌ Could not find test data (prospect or campaign)');
    }
    
  } catch (error) {
    console.error('❌ Test setup failed:', error.message);
  } finally {
    await client.close();
  }
}

testParagraphSpacing().catch(console.error);