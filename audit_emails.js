const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Import models from the main index to avoid path resolution issues
const { ProspectModel, EmailJobModel } = require('./dist/models/index.js');

async function auditRecentEmails() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/missive');
    
    const emails = await EmailJobModel.find({ 
      status: 'COMPLETED',
      generatedEmail: { $exists: true } 
    })
    .populate('prospectId')
    .sort({ createdAt: -1 })
    .limit(10);

    console.log('=== RECENT EMAIL AUDIT ===');
    console.log('Found', emails.length, 'recent emails');
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const prospect = email.prospectId;
      console.log(`\n--- EMAIL ${i + 1} ---`);
      console.log('Prospect:', prospect.companyName);
      console.log('Industry:', prospect.industry);
      console.log('Subject:', email.generatedEmail.subject);
      console.log('Content Preview (first 300 chars):');
      console.log(email.generatedEmail.textBody.substring(0, 300) + '...');
      
      if (prospect.scrapedData) {
        console.log('Scraped Services:', prospect.scrapedData.services ? prospect.scrapedData.services.slice(0, 3) : 'None');
        console.log('Scraped Description:', prospect.scrapedData.description ? prospect.scrapedData.description.substring(0, 100) + '...' : 'None');
      }
    }
    
    // Check for identical content patterns
    console.log('\n=== CONTENT SIMILARITY ANALYSIS ===');
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