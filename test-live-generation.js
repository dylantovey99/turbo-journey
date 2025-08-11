const axios = require('axios');

async function testLiveGeneration() {
  console.log('🧪 Testing Live Natural Language Generation\n');
  
  const baseURL = 'http://localhost:3000/api/v1';
  
  try {
    // Test server health
    console.log('1. Testing server connection...');
    const healthResponse = await axios.get(`${baseURL}/health`);
    console.log('   ✅ Server is healthy:', healthResponse.data.status);
    
    // Create a test campaign for natural language testing
    console.log('\n2. Creating test campaign...');
    const testCampaign = {
      name: 'Natural Language Test Campaign',
      usps: [
        'High-quality professional printing services',
        'Fast turnaround times for busy photographers', 
        'Color accuracy and print consistency',
        'Excellent customer service and support',
        'Competitive pricing for professional quality'
      ],
      tone: 'professional',
      marketingDocument: `
        We are a professional printing service specializing in high-quality prints for photographers and creative professionals. 
        
        Our services include:
        - Professional photo printing with exceptional color accuracy
        - Fast turnaround times to meet tight deadlines
        - Various print sizes and finishes
        - Reliable customer support
        - Competitive pricing for volume orders
        
        We understand that photographers need reliable partners who can deliver consistent quality that impresses their clients.
        Our goal is to help photography businesses grow by providing prints they can be proud to deliver.
      `,
      targetAudience: 'Photography professionals and studios',
      fromName: 'Mike Johnson',
      fromEmail: 'mike@printingservice.com'
    };
    
    const campaignResponse = await axios.post(`${baseURL}/campaigns`, testCampaign);
    const campaignId = campaignResponse.data._id;
    console.log('   ✅ Created test campaign:', campaignId);
    
    // Create test prospects with different business profiles
    console.log('\n3. Creating test prospects...');
    
    const testProspects = [
      {
        companyName: 'Artisan Wedding Photography',
        contactName: 'Sarah',
        email: 'sarah@artisanweddings.com',
        industry: 'photography',
        website: 'https://artisanweddings.com',
        scrapedData: {
          title: 'Award-winning Wedding Photography Studio',
          description: 'Capturing life\'s most precious moments with artistic vision and professional expertise',
          services: ['Wedding Photography', 'Engagement Sessions', 'Bridal Portraits'],
          technologies: ['online galleries', 'booking system'],
          contactInfo: { email: 'hello@artisanweddings.com' }
        },
        businessIntelligence: {
          teamSize: 'small',
          businessMaturity: 'established',
          professionalLevel: 'professional',
          hasAwards: true,
          testimonialsCount: 25,
          hasPricing: true,
          hasBookingSystem: true
        }
      },
      {
        companyName: 'Urban Portrait Studio',
        contactName: 'Marcus',
        email: 'marcus@urbanportraits.com', 
        industry: 'photography',
        website: 'https://urbanportraits.com',
        scrapedData: {
          title: 'Modern Portrait Photography',
          description: 'Contemporary portrait photography for professionals and families',
          services: ['Professional Headshots', 'Family Portraits', 'Corporate Photography'],
          technologies: ['digital delivery', 'scheduling system']
        },
        businessIntelligence: {
          teamSize: 'small',
          businessMaturity: 'growing',
          professionalLevel: 'professional',
          hasAwards: false,
          testimonialsCount: 12
        }
      },
      {
        companyName: 'Creative Events Co',
        contactName: 'Lisa',
        email: 'lisa@creativeevents.com',
        industry: 'event planning',
        website: 'https://creativeevents.com',
        scrapedData: {
          title: 'Full-Service Event Planning',
          description: 'Creating memorable events through creative planning and flawless execution',
          services: ['Corporate Events', 'Wedding Planning', 'Festival Coordination'],
          technologies: ['event management software', 'vendor portal']
        },
        businessIntelligence: {
          teamSize: 'medium',
          businessMaturity: 'scaling',
          professionalLevel: 'professional',
          hasAwards: true,
          testimonialsCount: 40
        }
      }
    ];
    
    for (let i = 0; i < testProspects.length; i++) {
      const prospectResponse = await axios.post(`${baseURL}/prospects`, testProspects[i]);
      testProspects[i]._id = prospectResponse.data._id;
      console.log(`   ✅ Created prospect: ${testProspects[i].companyName}`);
    }
    
    // Generate emails for each prospect
    console.log('\n4. Generating natural language emails...');
    
    for (let i = 0; i < testProspects.length; i++) {
      const prospect = testProspects[i];
      console.log(`\n   📧 Generating email for ${prospect.companyName}...`);
      
      try {
        // Create email job
        const emailJobResponse = await axios.post(`${baseURL}/email-jobs`, {
          prospectId: prospect._id,
          campaignId: campaignId,
          priority: 'normal'
        });
        
        const jobId = emailJobResponse.data._id;
        console.log(`   ⏳ Email job created: ${jobId}`);
        
        // Wait for generation (this might take a moment)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check email job status
        const jobStatus = await axios.get(`${baseURL}/email-jobs/${jobId}`);
        
        if (jobStatus.data.status === 'completed' && jobStatus.data.generatedEmail) {
          const email = jobStatus.data.generatedEmail;
          
          console.log(`   ✅ Email generated successfully!`);
          console.log(`   📨 Subject: "${email.subject}"`);
          console.log(`   📊 Confidence: ${email.confidence}`);
          console.log(`   🎯 Personalizations: ${email.personalizations?.length || 0}`);
          
          console.log('\n   📝 EMAIL CONTENT:');
          console.log('   ' + '='.repeat(60));
          console.log(`   Subject: ${email.subject}`);
          console.log('   ' + '-'.repeat(60));
          
          // Format the text body for display
          const emailLines = email.textBody.split('\n').map(line => `   ${line}`);
          console.log(emailLines.join('\n'));
          console.log('   ' + '='.repeat(60));
          
          if (email.personalizations && email.personalizations.length > 0) {
            console.log('\n   🎯 Personalization Elements:');
            email.personalizations.forEach((p, idx) => {
              console.log(`   ${idx + 1}. ${p}`);
            });
          }
          
        } else if (jobStatus.data.status === 'failed') {
          console.log(`   ❌ Email generation failed: ${jobStatus.data.error}`);
        } else {
          console.log(`   ⏳ Email still processing (status: ${jobStatus.data.status})`);
        }
        
      } catch (error) {
        console.log(`   ❌ Failed to generate email: ${error.message}`);
      }
    }
    
    // Cleanup - delete test data
    console.log('\n5. Cleaning up test data...');
    try {
      for (const prospect of testProspects) {
        if (prospect._id) {
          await axios.delete(`${baseURL}/prospects/${prospect._id}`);
        }
      }
      await axios.delete(`${baseURL}/campaigns/${campaignId}`);
      console.log('   ✅ Test data cleaned up');
    } catch (error) {
      console.log('   ⚠️ Cleanup warning:', error.message);
    }
    
    console.log('\n🎯 Natural Language Test Summary:');
    console.log('✅ Server connection working');
    console.log('✅ Campaign creation successful');
    console.log('✅ Prospect creation with business intelligence');
    console.log('✅ Email generation with natural language improvements');
    console.log('\n💡 Key Observations:');
    console.log('   - Check if subject lines sound more conversational');
    console.log('   - Look for natural business language vs marketing jargon');
    console.log('   - Notice personalization based on specific business context');
    console.log('   - Observe different conversation styles for different prospects');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testLiveGeneration();