const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function testRealPipeline() {
  console.log('🔍 REAL PIPELINE TEST - No Shortcuts...\n');
  
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('email-generator');
    
    // 1. Get REAL data from database
    console.log('1. 📊 Getting Real Data from Database:');
    
    const prospect = await db.collection('prospects').findOne({
      scrapedData: { $exists: true },
      industry: 'photography'
    });
    
    const campaign = await db.collection('campaigns').findOne({});
    
    if (!prospect || !campaign) {
      console.log('❌ Missing real data - cannot test properly');
      return;
    }
    
    console.log(`   📸 Prospect: ${prospect.companyName || prospect._id}`);
    console.log(`   📧 Campaign: ${campaign.name}`);
    console.log(`   📋 Scraped Data: ${!!prospect.scrapedData}`);
    
    // 2. Test PsychologicalTriggerService with real data
    console.log('\\n2. 🧠 Testing Psychological Triggers with Real Data:');
    
    try {
      // Simulate the trigger generation that happens in EmailGenerator
      const mockAnalysis = {
        businessContext: { industry: 'photography', growthStage: 'scaling' },
        painPoints: ['print quality consistency']
      };
      
      console.log('   📋 Mock Analysis Created');
      console.log('   ⚠️ Cannot test trigger service directly due to module resolution');
      console.log('   ✅ Would generate social-proof, authority, or liking triggers');
      
    } catch (error) {
      console.log(`   ❌ Trigger test failed: ${error.message}`);
    }
    
    // 3. Test actual email job creation and processing
    console.log('\\n3. 📧 Testing Email Job Creation:');
    
    // Create a real email job
    const emailJob = {
      prospectId: prospect._id,
      campaignId: campaign._id,
      status: 'queued',
      attempts: 0,
      createdAt: new Date()
    };
    
    const result = await db.collection('emailjobs').insertOne(emailJob);
    const jobId = result.insertedId.toString();
    
    console.log(`   ✅ Created real email job: ${jobId}`);
    
    // 4. Check if EmailGenerator can be called
    console.log('\\n4. 🔄 EmailGenerator Integration Test:');
    
    try {
      console.log('   ⚠️ Cannot directly test EmailGenerator due to module resolution');
      console.log('   📝 But can verify the job is properly structured for processing');
      
      // Verify the job structure
      const createdJob = await db.collection('emailjobs').findOne({ _id: result.insertedId });
      console.log(`   ✅ Job properly created with status: ${createdJob.status}`);
      
    } catch (error) {
      console.log(`   ❌ EmailGenerator test failed: ${error.message}`);
    }
    
    // 5. Check latest completed job to see current output quality
    console.log('\\n5. 🔍 Latest Email Quality Analysis:');
    
    const latestJob = await db.collection('emailjobs').findOne(
      { status: 'completed', generatedEmail: { $exists: true } },
      { sort: { _id: -1 } }
    );
    
    if (latestJob) {
      const email = latestJob.generatedEmail;
      console.log(`   📧 Latest Subject: "${email.subject}"`);
      
      // Check for broken trigger integration
      const textBody = email.textBody || '';
      const hasBrokenSentences = textBody.includes('Your vision clearly demonstrates I have some') ||
                                 textBody.includes('Most creative professionals I work with discover Your');
      
      console.log(`   ${hasBrokenSentences ? '❌' : '✅'} Broken sentences: ${hasBrokenSentences}`);
      
      // Check paragraph spacing
      const lines = textBody.split('\\n');
      const emptyLines = lines.filter(l => l.trim() === '').length;
      console.log(`   ${emptyLines >= 3 ? '✅' : '❌'} Paragraph spacing: ${emptyLines} empty lines`);
      
      // Check subject variety (is it generic?)
      const isGenericSubject = email.subject.includes('collaboration opportunity');
      console.log(`   ${isGenericSubject ? '❌' : '✅'} Subject originality: ${!isGenericSubject}`);
      
    } else {
      console.log('   ⚠️ No recent completed jobs to analyze');
    }
    
    // 6. Root Cause Analysis
    console.log('\\n6. 🎯 ROOT CAUSE ANALYSIS:');
    
    console.log('   📋 Issues Identified:');
    console.log('   1. Module resolution prevents proper testing');
    console.log('   2. Cannot verify SubjectLineService actually gets called');
    console.log('   3. Cannot verify psychological triggers work correctly');
    console.log('   4. Cannot test complete pipeline end-to-end');
    
    console.log('\\n   🔧 REQUIRED FIXES:');
    console.log('   1. Fix module path resolution (@/ aliases not working in compiled code)');
    console.log('   2. Create integration test that actually runs the EmailGenerator');
    console.log('   3. Add logging to EmailGenerator to verify each step');
    console.log('   4. Test with real MongoDB data, not mocks');
    
    // Clean up test job
    await db.collection('emailjobs').deleteOne({ _id: result.insertedId });
    console.log('\\n   🧹 Cleaned up test job');
    
    console.log('\\n🏁 REAL TEST CONCLUSION:');
    console.log('❌ Cannot properly verify fixes due to testing limitations');
    console.log('⚠️ Need to implement proper integration testing');
    console.log('📝 Changes look correct in code but unverified in practice');
    
  } catch (error) {
    console.error('❌ Real pipeline test failed:', error.message);
  } finally {
    await client.close();
  }
}

testRealPipeline();