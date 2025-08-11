const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Define schemas directly to avoid import issues
const generatedEmailSchema = new mongoose.Schema({
  subject: String,
  htmlBody: String,
  textBody: String,
  personalizations: [String],
  confidence: Number
}, { _id: false });

const EmailJobSchema = new mongoose.Schema({
  prospectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prospect' },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  status: String,
  generatedEmail: generatedEmailSchema,
  missiveDraftId: String,
  error: String,
  attempts: Number,
  analytics: {
    sentAt: Date,
    openedAt: Date,
    clickedAt: Date,
    repliedAt: Date,
    opened: Boolean,
    clicked: Boolean,
    replied: Boolean,
    openRate: Number,
    clickRate: Number,
    replyRate: Number,
    subjectLineStyle: String,
    psychologicalTriggers: [String],
    industry: String,
    businessStage: String,
    marketPosition: String
  }
}, { timestamps: true });

const ProspectSchema = new mongoose.Schema({
  website: String,
  contactEmail: String,
  contactName: String,
  companyName: String,
  industry: String,
  scrapedData: {
    title: String,
    description: String,
    services: [String],
    technologies: [String],
    recentNews: [String],
    contactInfo: {
      email: String,
      phone: String,
      address: String,
      socialMedia: Map
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  status: String,
  campaignIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }]
}, { timestamps: true });

async function auditRecentEmails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    const EmailJob = mongoose.model('EmailJob', EmailJobSchema);
    const Prospect = mongoose.model('Prospect', ProspectSchema);
    
    // Try different status values
    const emails = await EmailJob.find({ 
      $or: [
        { status: 'COMPLETED' },
        { status: 'completed' },
        { status: 'SENT' },
        { status: 'sent' }
      ],
      generatedEmail: { $exists: true } 
    })
    .populate('prospectId')
    .sort({ createdAt: -1 })
    .limit(10);

    console.log('=== RECENT EMAIL AUDIT ===');
    console.log('Found', emails.length, 'recent emails\n');
    
    if (emails.length === 0) {
      console.log('❌ No completed emails found. Checking all email jobs...');
      const allJobs = await EmailJob.find({}).populate('prospectId').sort({ createdAt: -1 }).limit(5);
      console.log('Total email jobs found:', allJobs.length);
      
      for (let job of allJobs) {
        console.log(`- Job ${job._id}: Status=${job.status}, Has Email=${!!job.generatedEmail}, Prospect=${job.prospectId?.companyName || 'N/A'}`);
      }
      
      await mongoose.disconnect();
      return;
    }
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const prospect = email.prospectId;
      console.log(`--- EMAIL ${i + 1} ---`);
      console.log('Prospect:', prospect.companyName);
      console.log('Industry:', prospect.industry);
      console.log('Website:', prospect.website);
      console.log('Subject:', email.generatedEmail.subject);
      console.log('Content Preview (first 300 chars):');
      console.log(email.generatedEmail.textBody.substring(0, 300) + '...');
      
      if (prospect.scrapedData) {
        console.log('Scraped Services:', prospect.scrapedData.services ? prospect.scrapedData.services.slice(0, 3) : 'None');
        console.log('Scraped Description:', prospect.scrapedData.description ? prospect.scrapedData.description.substring(0, 100) + '...' : 'None');
      } else {
        console.log('🚨 NO SCRAPED DATA FOUND for this prospect!');
      }
      
      if (email.analytics && email.analytics.psychologicalTriggers) {
        console.log('Psychological Triggers:', email.analytics.psychologicalTriggers);
      }
      console.log('');
    }
    
    // Check for identical content patterns
    console.log('=== CONTENT SIMILARITY ANALYSIS ===');
    const patterns = {};
    
    emails.forEach((email, index) => {
      const content = email.generatedEmail.textBody;
      const prospect = email.prospectId;
      // Extract first sentence as pattern
      const firstSentence = content.split('.')[0] + '.';
      if (!patterns[firstSentence]) {
        patterns[firstSentence] = [];
      }
      patterns[firstSentence].push(`${prospect.companyName} (Email ${index + 1})`);
    });
    
    Object.keys(patterns).forEach(pattern => {
      if (patterns[pattern].length > 1) {
        console.log('\n🚨 IDENTICAL OPENING SENTENCE FOUND:');
        console.log('Pattern:', pattern);
        console.log('Companies:', patterns[pattern].join(', '));
      }
    });
    
    // Check middle content similarity too
    console.log('\n=== MIDDLE CONTENT ANALYSIS ===');
    const middlePatterns = {};
    
    emails.forEach((email, index) => {
      const content = email.generatedEmail.textBody;
      const prospect = email.prospectId;
      const sentences = content.split('.');
      if (sentences.length > 2) {
        const middleSentence = sentences[Math.floor(sentences.length / 2)].trim() + '.';
        if (!middlePatterns[middleSentence]) {
          middlePatterns[middleSentence] = [];
        }
        middlePatterns[middleSentence].push(`${prospect.companyName} (Email ${index + 1})`);
      }
    });
    
    Object.keys(middlePatterns).forEach(pattern => {
      if (middlePatterns[pattern].length > 1) {
        console.log('\n🚨 IDENTICAL MIDDLE CONTENT FOUND:');
        console.log('Pattern:', pattern);
        console.log('Companies:', middlePatterns[pattern].join(', '));
      }
    });
    
    // Analyze personalization effectiveness
    console.log('\n=== PERSONALIZATION EFFECTIVENESS ANALYSIS ===');
    let personalizedCount = 0;
    let genericCount = 0;
    
    emails.forEach((email, index) => {
      const content = email.generatedEmail.textBody;
      const prospect = email.prospectId;
      
      // Check if content mentions prospect-specific details
      const hasCompanyName = content.toLowerCase().includes(prospect.companyName.toLowerCase());
      const hasIndustry = prospect.industry && content.toLowerCase().includes(prospect.industry.toLowerCase());
      const hasServices = prospect.scrapedData && prospect.scrapedData.services && 
        prospect.scrapedData.services.some(service => content.toLowerCase().includes(service.toLowerCase()));
      
      const personalizationScore = [hasCompanyName, hasIndustry, hasServices].filter(Boolean).length;
      
      if (personalizationScore > 0) {
        personalizedCount++;
        console.log(`✅ Email ${index + 1} (${prospect.companyName}): Personalization score ${personalizationScore}/3`);
        if (hasCompanyName) console.log('   - Mentions company name');
        if (hasIndustry) console.log('   - Mentions industry');
        if (hasServices) console.log('   - Mentions services');
      } else {
        genericCount++;
        console.log(`❌ Email ${index + 1} (${prospect.companyName}): NO PERSONALIZATION DETECTED`);
      }
    });
    
    console.log(`\n📊 PERSONALIZATION SUMMARY:`);
    console.log(`   Personalized emails: ${personalizedCount}/${emails.length}`);
    console.log(`   Generic emails: ${genericCount}/${emails.length}`);
    console.log(`   Personalization rate: ${Math.round((personalizedCount / emails.length) * 100)}%`);
    
    if (genericCount > personalizedCount) {
      console.log('\n🚨 CRITICAL ISSUE: More generic than personalized emails detected!');
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

auditRecentEmails();