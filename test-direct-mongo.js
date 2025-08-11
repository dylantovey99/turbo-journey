const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function testMongoDirect() {
  console.log('🗄️ Testing direct MongoDB connection and data...\n');
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-generator';
  console.log(`Connecting to: ${uri}`);
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('email-generator');
    
    // 1. Check collections
    console.log('1. Available collections:');
    const collections = await db.listCollections().toArray();
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
    // 2. Check prospects
    console.log('\n2. Prospects data:');
    const prospectCount = await db.collection('prospects').countDocuments();
    console.log(`   Total prospects: ${prospectCount}`);
    
    if (prospectCount > 0) {
      const sampleProspect = await db.collection('prospects').findOne({});
      console.log('   Sample prospect:');
      console.log(`   - ID: ${sampleProspect._id}`);
      console.log(`   - Company: ${sampleProspect.companyName || 'N/A'}`);
      console.log(`   - Industry: ${sampleProspect.industry || 'N/A'}`);
      console.log(`   - Status: ${sampleProspect.status || 'N/A'}`);
      console.log(`   - Has scraped data: ${!!sampleProspect.scrapedData}`);
      
      if (sampleProspect.scrapedData) {
        console.log(`   - Scraped title: ${sampleProspect.scrapedData.title || 'N/A'}`);
        console.log(`   - Services found: ${sampleProspect.scrapedData.services ? sampleProspect.scrapedData.services.length : 0}`);
      }
      
      // Check scraped prospects
      const scrapedCount = await db.collection('prospects').countDocuments({
        $or: [
          { status: 'scraped' },
          { status: 'analyzed' },
          { scrapedData: { $exists: true } }
        ]
      });
      console.log(`   Prospects with scraped data: ${scrapedCount}`);
    }
    
    // 3. Check campaigns  
    console.log('\n3. Campaigns data:');
    const campaignCount = await db.collection('campaigns').countDocuments();
    console.log(`   Total campaigns: ${campaignCount}`);
    
    if (campaignCount > 0) {
      const sampleCampaign = await db.collection('campaigns').findOne({});
      console.log('   Sample campaign:');
      console.log(`   - ID: ${sampleCampaign._id}`);
      console.log(`   - Name: ${sampleCampaign.name || 'N/A'}`);
      console.log(`   - USPs: ${sampleCampaign.usps ? sampleCampaign.usps.length + ' defined' : 'None'}`);
      console.log(`   - Tone: ${sampleCampaign.tone || 'N/A'}`);
    }
    
    // 4. Check email jobs
    console.log('\n4. Email jobs data:');
    const emailJobCount = await db.collection('emailjobs').countDocuments();
    console.log(`   Total email jobs: ${emailJobCount}`);
    
    if (emailJobCount > 0) {
      const jobsByStatus = await db.collection('emailjobs').aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]).toArray();
      
      console.log('   Jobs by status:');
      jobsByStatus.forEach(stat => {
        console.log(`   - ${stat._id}: ${stat.count}`);
      });
    }
    
    // 5. Summary
    console.log('\n🎯 Data Summary:');
    console.log(`✅ Database accessible: Yes`);
    console.log(`✅ Prospects: ${prospectCount} found`);
    console.log(`✅ Campaigns: ${campaignCount} found`);
    console.log(`✅ Email jobs: ${emailJobCount} found`);
    
    const readyForPersonalization = prospectCount > 0 && campaignCount > 0;
    console.log(`${readyForPersonalization ? '✅' : '❌'} Ready for personalization: ${readyForPersonalization}`);
    
    if (readyForPersonalization) {
      console.log('\n💡 The system has sufficient data for scraping and personalization workflows.');
    } else {
      console.log('\n⚠️ Missing data for complete workflow testing.');
    }
    
  } catch (error) {
    console.error('❌ MongoDB test failed:', error.message);
  } finally {
    await client.close();
  }
}

testMongoDirect();