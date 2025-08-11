const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function debugPersonalizationFailure() {
  console.log('🔍 DEBUGGING EMAIL PERSONALIZATION FAILURE...\n');
  
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('email-generator');
    
    // 1. Get multiple recent emails to compare content
    console.log('1. 📧 Analyzing Email Content Similarity:');
    
    const recentEmails = await db.collection('emailjobs').find({
      status: 'completed',
      generatedEmail: { $exists: true }
    }).sort({ _id: -1 }).limit(5).toArray();
    
    if (recentEmails.length > 0) {
      console.log(`   Found ${recentEmails.length} recent emails\n`);
      
      const emailContents = [];
      const prospects = [];
      
      for (let i = 0; i < recentEmails.length; i++) {
        const job = recentEmails[i];
        const email = job.generatedEmail;
        
        // Get the prospect for each email
        const prospect = await db.collection('prospects').findOne({ _id: job.prospectId });
        
        console.log(`   📧 Email ${i + 1}:`);
        console.log(`      Prospect: ${prospect?.companyName || prospect?._id || 'Unknown'}`);
        console.log(`      Industry: ${prospect?.industry || 'Unknown'}`);
        console.log(`      Subject: "${email.subject}"`);
        
        // Analyze personalization elements
        const textBody = email.textBody || '';
        const hasCompanyName = prospect?.companyName && textBody.includes(prospect.companyName);
        const hasIndustrySpecific = textBody.toLowerCase().includes(prospect?.industry?.toLowerCase() || '');
        
        console.log(`      Company name used: ${hasCompanyName ? '✅' : '❌'}`);
        console.log(`      Industry-specific: ${hasIndustrySpecific ? '✅' : '❌'}`);
        
        // Check for scraped data usage
        if (prospect?.scrapedData?.services) {
          const usesServices = prospect.scrapedData.services.some(service => 
            textBody.toLowerCase().includes(service.toLowerCase())
          );
          console.log(`      Uses scraped services: ${usesServices ? '✅' : '❌'}`);
        } else {
          console.log(`      Scraped services: ❌ None available`);
        }
        
        // Store for similarity comparison
        emailContents.push({
          index: i + 1,
          content: textBody,
          prospect: prospect?.companyName || `Prospect ${i + 1}`,
          personalizations: email.personalizations || []
        });
        
        console.log(`      Personalizations: ${(email.personalizations || []).length}`);
        console.log('');
      }
      
      // 2. Compare content similarity
      console.log('2. 🔍 Content Similarity Analysis:');
      
      // Simple similarity check - count common phrases
      const commonPhrases = [
        'I came across',
        'I was impressed',
        'In conversations with',
        'Many photographers',
        'Would you be open to',
        'print partners who',
        'gallery-quality',
        'client experience'
      ];
      
      console.log('   Common phrase usage across emails:');
      commonPhrases.forEach(phrase => {
        const emailsWithPhrase = emailContents.filter(email => 
          email.content.toLowerCase().includes(phrase.toLowerCase())
        ).map(email => email.index);
        
        if (emailsWithPhrase.length > 1) {
          console.log(`   ❌ "${phrase}": appears in emails ${emailsWithPhrase.join(', ')}`);
        }
      });
      
      // 3. Check for truly unique content
      console.log('\n3. 📊 Personalization Uniqueness:');
      
      emailContents.forEach(email => {
        const uniqueElements = [];
        
        // Check for prospect name
        if (email.content.includes(email.prospect)) {
          uniqueElements.push('prospect name');
        }
        
        // Check for specific business insights
        const genericPhrases = ['photography studio', 'wedding photographer', 'your work', 'your business'];
        const specificPhrases = email.content.split(' ').filter(word => 
          word.length > 8 && !genericPhrases.some(phrase => phrase.includes(word.toLowerCase()))
        );
        
        console.log(`   Email ${email.index} (${email.prospect}):`);
        console.log(`      Unique elements: ${uniqueElements.length ? uniqueElements.join(', ') : 'None detected'}`);
        console.log(`      Personalizations recorded: ${email.personalizations.length}`);
        
        if (email.personalizations.length > 0) {
          console.log(`      Personalization types: ${email.personalizations.slice(0, 2).join(', ')}...`);
        }
      });
      
    } else {
      console.log('   ❌ No recent completed emails found');
    }
    
    // 4. Check prospect data availability
    console.log('\n4. 📋 Prospect Data Quality Analysis:');
    
    const prospectsWithData = await db.collection('prospects').find({
      scrapedData: { $exists: true }
    }).limit(5).toArray();
    
    console.log(`   Prospects with scraped data: ${prospectsWithData.length}`);
    
    prospectsWithData.forEach((prospect, index) => {
      console.log(`\n   Prospect ${index + 1}: ${prospect.companyName || prospect._id}`);
      console.log(`      Industry: ${prospect.industry || 'Not set'}`);
      console.log(`      Title: ${prospect.scrapedData?.title || 'None'}`);
      console.log(`      Services: ${prospect.scrapedData?.services?.length || 0} found`);
      console.log(`      Description: ${prospect.scrapedData?.description ? 'Yes' : 'No'}`);
      
      if (prospect.scrapedData?.services?.length > 0) {
        console.log(`      Service examples: ${prospect.scrapedData.services.slice(0, 2).join(', ')}`);
      }
    });
    
    // 5. Root cause analysis
    console.log('\n5. 🎯 ROOT CAUSE ANALYSIS:');
    
    console.log('   IDENTIFIED ISSUES:');
    console.log('   1. EmailGenerator may be using generic fallback analysis instead of ContentAnalyzer');
    console.log('   2. ClaudeClient prompt may be too template-focused, not prospect-specific enough');
    console.log('   3. Scraped data might not be flowing through to email content generation');
    console.log('   4. Personalization may be happening at surface level only (names) not deep insights');
    
    console.log('\n   CRITICAL FIX REQUIRED:');
    console.log('   📧 Each email should be uniquely crafted based on:');
    console.log('      - Specific company scraped data (services, description, recent news)');
    console.log('      - Industry-specific insights and pain points');  
    console.log('      - Business intelligence from website analysis');
    console.log('      - Genuine prospect-specific observations');
    console.log('');
    console.log('   ❌ CURRENT STATE: Generic industry templates');
    console.log('   ✅ REQUIRED STATE: Truly personalized prospect insights');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await client.close();
  }
}

debugPersonalizationFailure();