const axios = require('axios');

async function testAPIGeneration() {
  console.log('🧪 Testing Natural Language Generation via API\n');
  
  const baseURL = 'http://localhost:3000/api/v1';
  
  try {
    // Test system status
    console.log('1. Checking system status...');
    const statusResponse = await axios.get(`${baseURL}/status`);
    console.log('   ✅ System online with enhanced services:', 
      statusResponse.data.data.phase1.services.join(', '));
    
    // Check existing campaigns
    console.log('\n2. Checking existing campaigns...');
    const campaignResponse = await axios.get(`${baseURL}/campaigns`);
    console.log(`   📊 Found ${campaignResponse.data.data?.length || 0} existing campaigns`);
    
    let campaignId = null;
    if (campaignResponse.data.data && campaignResponse.data.data.length > 0) {
      campaignId = campaignResponse.data.data[0]._id;
      console.log(`   ✅ Using existing campaign: ${campaignResponse.data.data[0].name}`);
    } else {
      // Create a test campaign
      console.log('   📝 Creating test campaign...');
      const newCampaign = {
        name: 'Natural Language Test Campaign',
        usps: [
          'Professional print services for photographers',
          'Fast turnaround times for busy studios', 
          'Excellent color accuracy and consistency',
          'Reliable customer support when you need it',
          'Competitive pricing without compromising quality'
        ],
        tone: 'professional',
        marketingDocument: `
          We provide professional printing services specifically designed for photographers who need reliable, high-quality prints for their clients.
          
          Our focus areas:
          - Professional photo printing with exceptional color accuracy
          - Fast turnaround times to meet your client deadlines
          - Various print sizes and premium finishes
          - Consistent quality you can depend on
          - Customer support that understands photography
          
          We work with photography studios who need a reliable printing partner to help grow their business through quality client deliverables.
        `,
        targetAudience: 'Photography professionals and creative studios',
        fromName: 'Mike Johnson',
        fromEmail: 'mike@printservice.com'
      };
      
      const createResponse = await axios.post(`${baseURL}/campaigns`, newCampaign);
      campaignId = createResponse.data.data._id;
      console.log('   ✅ Created campaign:', campaignId);
    }
    
    // Check existing prospects
    console.log('\n3. Checking existing prospects...');
    const prospectResponse = await axios.get(`${baseURL}/prospects?limit=5`);
    console.log(`   📊 Found ${prospectResponse.data.data?.length || 0} existing prospects`);
    
    if (prospectResponse.data.data && prospectResponse.data.data.length > 0) {
      console.log('\n4. Testing natural language generation with existing prospect...');
      
      // Use the first prospect with good data
      const prospect = prospectResponse.data.data.find(p => 
        p.companyName && p.scrapedData && Object.keys(p.scrapedData).length > 0
      ) || prospectResponse.data.data[0];
      
      console.log(`   🎯 Selected prospect: ${prospect.companyName || 'Unknown Company'}`);
      console.log(`   📍 Industry: ${prospect.industry || 'Not specified'}`);
      console.log(`   🔗 Website: ${prospect.website || 'Not provided'}`);
      
      if (prospect.scrapedData) {
        console.log(`   📝 Services: ${prospect.scrapedData.services?.slice(0, 3).join(', ') || 'None'}`);
        console.log(`   📄 Title: ${prospect.scrapedData.title || 'None'}`);
      }
      
      // Start campaign for this prospect
      try {
        console.log('\n   🚀 Starting email generation...');
        const startResponse = await axios.post(`${baseURL}/campaigns/${campaignId}/start`, {
          prospects: [prospect._id],
          options: {
            batchSize: 1,
            delayBetweenEmails: 0
          }
        });
        
        console.log('   ⏳ Campaign started, waiting for email generation...');
        
        // Wait a few seconds for generation
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check campaign progress
        const progressResponse = await axios.get(`${baseURL}/campaigns/${campaignId}/progress`);
        console.log(`   📊 Campaign progress: ${JSON.stringify(progressResponse.data.data, null, 2)}`);
        
        // Get generated jobs
        const jobsResponse = await axios.get(`${baseURL}/campaigns/${campaignId}/jobs`);
        const jobs = jobsResponse.data.data || [];
        
        console.log(`   📧 Found ${jobs.length} email jobs`);
        
        // Look for completed jobs
        const completedJobs = jobs.filter(job => job.status === 'completed' && job.generatedEmail);
        
        if (completedJobs.length > 0) {
          console.log(`\n   ✅ Found ${completedJobs.length} completed email(s):`);
          
          completedJobs.forEach((job, index) => {
            const email = job.generatedEmail;
            console.log(`\n   📧 EMAIL ${index + 1}:`);
            console.log('   ' + '='.repeat(70));
            console.log(`   Subject: "${email.subject}"`);
            console.log(`   Confidence: ${email.confidence || 'N/A'}`);
            console.log(`   Personalizations: ${email.personalizations?.length || 0}`);
            console.log('   ' + '-'.repeat(70));
            
            // Display email content
            if (email.textBody) {
              const emailLines = email.textBody.split('\n').map(line => `   ${line}`);
              console.log(emailLines.join('\n'));
            }
            console.log('   ' + '='.repeat(70));
            
            // Show personalization elements
            if (email.personalizations && email.personalizations.length > 0) {
              console.log('\n   🎯 Personalization Elements:');
              email.personalizations.forEach((p, idx) => {
                console.log(`   ${idx + 1}. ${p}`);
              });
            }
            
            console.log('\n   🔍 Natural Language Analysis:');
            const subject = email.subject.toLowerCase();
            const content = email.textBody.toLowerCase();
            
            // Check for natural conversation indicators
            const naturalIndicators = {
              'Conversational subject': !subject.includes('streamline') && !subject.includes('optimize'),
              'Uses contractions': content.includes("don't") || content.includes("can't") || content.includes("i've"),
              'Natural greeting': content.includes('hi ') || content.includes('hello '),
              'Question-based': content.includes('?'),
              'No marketing jargon': !content.includes('leverage') && !content.includes('synergy'),
              'Personal touch': content.includes('noticed') || content.includes('curious') || content.includes('came across'),
              'Professional tone': !content.includes('amazing') && !content.includes('incredible'),
              'Conversational closing': content.includes('would you') || content.includes('happy to')
            };
            
            console.log('   Indicators:');
            Object.entries(naturalIndicators).forEach(([indicator, present]) => {
              console.log(`   ${present ? '✅' : '❌'} ${indicator}`);
            });
            
            const naturalScore = Object.values(naturalIndicators).filter(Boolean).length;
            console.log(`   📊 Natural Language Score: ${naturalScore}/8`);
          });
        } else {
          console.log('   ⏳ No completed emails yet. Jobs status:');
          jobs.forEach(job => {
            console.log(`   - Job ${job._id}: ${job.status}`);
            if (job.error) {
              console.log(`     Error: ${job.error}`);
            }
          });
        }
        
      } catch (error) {
        console.log(`   ❌ Campaign start failed: ${error.response?.data?.message || error.message}`);
      }
      
    } else {
      console.log('   ⚠️ No prospects found. You might need to add some test prospects first.');
    }
    
    console.log('\n🎯 Natural Language Improvement Summary:');
    console.log('✅ Enhanced EmailGenerator with ConversationStyleService');
    console.log('✅ AI-driven subject line generation (no more templates)');
    console.log('✅ Conversational email prompts (removed rigid structure)');
    console.log('✅ Human imperfection processing for authenticity');
    console.log('✅ Multiple conversation styles based on prospect profile');
    console.log('\n💡 Key Changes Made:');
    console.log('   - SubjectLineService: AI prompts replace template arrays');
    console.log('   - ClaudeClient: Natural conversation prompts vs marketing copy');
    console.log('   - ConversationStyleService: 5 styles for variety');
    console.log('   - EmailGenerator: Integrated style selection');
    console.log('   - Human touches: Contractions, natural imperfections');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testAPIGeneration();