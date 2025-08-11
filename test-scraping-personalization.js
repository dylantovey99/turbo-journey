const { ScrapingService } = require('./dist/services/scraper/ScrapingService.js');
const { ContentAnalyzer } = require('./dist/services/ai/ContentAnalyzer.js');
const { EmailGenerator } = require('./dist/services/email/EmailGenerator.js');
const mongoose = require('mongoose');
const { ProspectModel, CampaignModel, EmailJobModel } = require('./dist/models/index.js');

async function testScrapingAndPersonalization() {
  try {
    console.log('🚀 Testing scraping and personalization workflow...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/missive-dev');
    console.log('✅ Connected to MongoDB');
    
    // 1. Test if we have any prospects in the database
    const prospectCount = await ProspectModel.countDocuments();
    console.log(`📊 Found ${prospectCount} prospects in database`);
    
    if (prospectCount === 0) {
      console.log('❌ No prospects found. Creating test prospect...');
      
      // Create a test prospect
      const testProspect = await ProspectModel.create({
        website: 'https://www.example-photography.com',
        companyName: 'Test Photography Studio',
        industry: 'photography',
        contactEmail: 'test@example-photography.com',
        status: 'pending'
      });
      
      console.log(`✅ Created test prospect: ${testProspect._id}`);
    }
    
    // 2. Test getting a prospect and check its scraped data
    const sampleProspect = await ProspectModel.findOne().lean();
    console.log('📋 Sample prospect:', {
      id: sampleProspect._id,
      companyName: sampleProspect.companyName,
      website: sampleProspect.website,
      status: sampleProspect.status,
      hasScrapedData: !!sampleProspect.scrapedData,
      scrapedDataKeys: sampleProspect.scrapedData ? Object.keys(sampleProspect.scrapedData) : []
    });
    
    // 3. Check if there are any campaigns
    const campaignCount = await CampaignModel.countDocuments();
    console.log(`📊 Found ${campaignCount} campaigns in database`);
    
    if (campaignCount === 0) {
      console.log('❌ No campaigns found. Creating test campaign...');
      
      const testCampaign = await CampaignModel.create({
        name: 'Photography Print Service Campaign',
        usps: [
          'Prints so detailed clients can "count branches on trees"',
          'Next level customer service with 75-year guarantee',
          'Pay after you\'re satisfied with your prints'
        ],
        tone: 'professional',
        marketingDocument: 'Professional photography printing service with exceptional quality and customer service',
        fromName: 'Print Specialist',
        fromEmail: 'sales@printservice.com'
      });
      
      console.log(`✅ Created test campaign: ${testCampaign._id}`);
    }
    
    // 4. Test scraping service initialization
    console.log('🕷️ Testing ScrapingService...');
    const scrapingService = new ScrapingService();
    
    try {
      await scrapingService.initialize();
      console.log('✅ ScrapingService initialized successfully');
      
      // Get scraping stats
      const scrapingStats = await scrapingService.getScrapingStats();
      console.log('📊 Scraping stats:', scrapingStats);
      
    } catch (error) {
      console.log('❌ ScrapingService failed to initialize:', error.message);
    }
    
    // 5. Test content analyzer
    console.log('🧠 Testing ContentAnalyzer...');
    const analyzer = new ContentAnalyzer();
    
    // Find a prospect that has scraped data or is analyzed
    const analyzableProspect = await ProspectModel.findOne({
      $or: [
        { status: 'scraped' },
        { status: 'analyzed' },
        { scrapedData: { $exists: true } }
      ]
    });
    
    if (analyzableProspect) {
      const campaign = await CampaignModel.findOne();
      
      try {
        console.log(`🔍 Analyzing prospect: ${analyzableProspect._id}`);
        const analysis = await analyzer.analyzeProspect(
          analyzableProspect._id.toString(),
          campaign._id.toString()
        );
        
        console.log('✅ Analysis completed:', {
          confidence: analysis.confidence,
          relevantUSPs: analysis.relevantUSPs.length,
          personalizationOps: analysis.personalizationOpportunities.length,
          industry: analysis.businessContext.industry,
          painPoints: analysis.painPoints.length
        });
        
      } catch (error) {
        console.log('❌ Analysis failed:', error.message);
      }
    } else {
      console.log('⚠️ No analyzable prospects found (need scraped data)');
    }
    
    // 6. Test email generation
    console.log('📧 Testing EmailGenerator...');
    const emailGenerator = new EmailGenerator();
    
    // Find an email job or create one
    let emailJob = await EmailJobModel.findOne({ status: 'queued' });
    
    if (!emailJob) {
      const prospect = await ProspectModel.findOne();
      const campaign = await CampaignModel.findOne();
      
      if (prospect && campaign) {
        emailJob = await EmailJobModel.create({
          prospectId: prospect._id,
          campaignId: campaign._id,
          status: 'queued',
          attempts: 0
        });
        
        console.log(`✅ Created test email job: ${emailJob._id}`);
      }
    }
    
    if (emailJob) {
      try {
        console.log(`📧 Generating email for job: ${emailJob._id}`);
        const generatedEmail = await emailGenerator.generateEmail(emailJob._id.toString());
        
        console.log('✅ Email generated successfully:', {
          subject: generatedEmail.subject.substring(0, 80) + '...',
          confidence: generatedEmail.confidence,
          personalizationsCount: generatedEmail.personalizations.length,
          textBodyLength: generatedEmail.textBody.length
        });
        
        // Show first few lines of email
        const emailPreview = generatedEmail.textBody.split('\n').slice(0, 3).join('\n');
        console.log('📖 Email preview:', emailPreview);
        
      } catch (error) {
        console.log('❌ Email generation failed:', error.message);
      }
    }
    
    // 7. Get generation stats
    const generationStats = await emailGenerator.getGenerationStats();
    console.log('📊 Email generation stats:', generationStats);
    
    await scrapingService.close();
    await mongoose.connection.close();
    
    console.log('🎉 Testing completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testScrapingAndPersonalization();