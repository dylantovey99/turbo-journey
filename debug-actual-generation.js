const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function debugActualGeneration() {
  console.log('🔍 Debugging Actual Email Generation Issues...\n');
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-generator';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('email-generator');
    
    // Get the most recent completed email jobs to see if fix worked
    console.log('1. 📧 Recent Email Analysis:');
    const recentJobs = await db.collection('emailjobs').find({
      status: 'completed',
      generatedEmail: { $exists: true }
    }).sort({ _id: -1 }).limit(5).toArray();
    
    if (recentJobs.length > 0) {
      console.log(`   Found ${recentJobs.length} recent completed emails\n`);
      
      recentJobs.forEach((job, index) => {
        const email = job.generatedEmail;
        const createdAt = new Date(job._id.getTimestamp());
        
        console.log(`   📧 Email ${index + 1} (${createdAt.toISOString().split('T')[0]}):`);
        console.log(`      Subject: "${email.subject}"`);
        
        // Check paragraph spacing in text body
        const textBody = email.textBody || '';
        const lines = textBody.split('\\n');
        const emptyLines = lines.filter(line => line.trim() === '');
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        
        console.log(`      Paragraph spacing: ${emptyLines.length} empty lines, ${nonEmptyLines.length} content lines`);
        
        // Check for run-on paragraphs
        const longParagraphs = nonEmptyLines.filter(line => line.length > 250);
        if (longParagraphs.length > 0) {
          console.log(`      ⚠️ Long paragraphs: ${longParagraphs.length}`);
        } else {
          console.log(`      ✅ Paragraph lengths: OK`);
        }
        
        // Show first few lines to check actual formatting
        console.log(`      Preview:`);
        lines.slice(0, 8).forEach((line, i) => {
          console.log(`         ${i + 1}. "${line}"`);
        });
        console.log('');
      });
      
      // Check for subject diversity in recent emails
      const recentSubjects = recentJobs.map(job => job.generatedEmail.subject);
      const uniqueRecentSubjects = [...new Set(recentSubjects)];
      
      console.log(`   📊 Recent Subject Diversity: ${uniqueRecentSubjects.length}/${recentSubjects.length} unique`);
      
      if (uniqueRecentSubjects.length < recentSubjects.length) {
        console.log('   ❌ Still generating duplicate subjects');
        const duplicates = recentSubjects.filter((subject, index) => 
          recentSubjects.indexOf(subject) !== index
        );
        console.log(`   Duplicates: ${[...new Set(duplicates)].join(', ')}`);
      } else {
        console.log('   ✅ No duplicate subjects in recent emails');
      }
      
    } else {
      console.log('   ❌ No recent completed emails found');
    }
    
    // Check if there are any queued/processing jobs to see current workflow
    console.log('\\n2. 🔄 Current Job Status:');
    const jobStats = await db.collection('emailjobs').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    jobStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count} jobs`);
    });
    
    // Check if we can find evidence of SubjectLineService being called
    console.log('\\n3. 🔍 Looking for SubjectLineService Usage Evidence:');
    
    // Look for any logs or data that might indicate the service is being used
    const recentJobsWithDetails = await db.collection('emailjobs').find({
      status: 'completed',
      generatedEmail: { $exists: true }
    }).sort({ _id: -1 }).limit(3).toArray();
    
    if (recentJobsWithDetails.length > 0) {
      recentJobsWithDetails.forEach((job, index) => {
        console.log(`\\n   📧 Job ${index + 1} Detail Analysis:`);
        console.log(`      Job ID: ${job._id}`);
        console.log(`      Status: ${job.status}`);
        console.log(`      Attempts: ${job.attempts || 1}`);
        
        if (job.error) {
          console.log(`      ⚠️ Error: ${job.error}`);
        }
        
        if (job.generatedEmail) {
          const email = job.generatedEmail;
          console.log(`      Subject: "${email.subject}"`);
          console.log(`      Confidence: ${email.confidence}`);
          console.log(`      Personalizations: ${email.personalizations ? email.personalizations.length : 'N/A'}`);
          
          // Check if subject looks like it came from SubjectLineService
          const isGenericSubject = email.subject.includes('collaboration opportunity') || 
                                  email.subject.includes('Business collaboration');
          console.log(`      Generic subject pattern: ${isGenericSubject ? '❌ YES (not using SubjectLineService)' : '✅ NO (likely using SubjectLineService)'}`);
        }
      });
    }
    
    console.log('\\n4. 🐛 Diagnosis:');
    
    // Analyze the patterns
    const hasRecentEmails = recentJobs.length > 0;
    const hasSubjectVariety = recentJobs.length > 0 && 
      [...new Set(recentJobs.map(j => j.generatedEmail.subject))].length === recentJobs.length;
    
    const hasProperSpacing = recentJobs.length > 0 && 
      recentJobs.every(job => {
        const lines = (job.generatedEmail.textBody || '').split('\\n');
        return lines.filter(line => line.trim() === '').length >= 3;
      });
    
    console.log(`   📧 Recent emails exist: ${hasRecentEmails ? '✅' : '❌'}`);
    console.log(`   🎯 Subject variety working: ${hasSubjectVariety ? '✅' : '❌'}`);
    console.log(`   📝 Paragraph spacing working: ${hasProperSpacing ? '✅' : '❌'}`);
    
    console.log('\\n💡 Possible Issues:');
    
    if (!hasSubjectVariety) {
      console.log('   🔧 Subject Line Fix Issues:');
      console.log('      - EmailGenerator might not be calling SubjectLineService');
      console.log('      - ClaudeClient might be overriding generated subjects');
      console.log('      - SubjectLineService might be returning same variants');
      console.log('      - Build/deployment issue - old code still running');
    }
    
    if (!hasProperSpacing) {
      console.log('   🔧 Paragraph Spacing Issues:');
      console.log('      - ClaudeClient prompt not enforcing double line breaks');
      console.log('      - AI model not following spacing instructions');
      console.log('      - Template formatting not being preserved');
      console.log('      - Post-processing stripping spacing');
    }
    
    if (hasRecentEmails && recentJobs[0].generatedEmail.subject.includes('collaboration opportunity')) {
      console.log('   ❌ CRITICAL: Still using hardcoded subject - SubjectLineService not integrated properly');
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await client.close();
  }
}

debugActualGeneration();