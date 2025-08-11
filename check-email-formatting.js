const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function checkEmailFormatting() {
  console.log('📧 Checking Email Formatting and Spacing...\n');
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-generator';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('email-generator');
    
    // Get recent completed email jobs
    const emailJobs = await db.collection('emailjobs').find({
      status: 'completed',
      generatedEmail: { $exists: true }
    }).limit(3).toArray();
    
    if (emailJobs.length > 0) {
      console.log('📧 Analyzing Email Formatting:\n');
      
      emailJobs.forEach((job, index) => {
        console.log(`=== EMAIL ${index + 1} ===`);
        console.log(`Job ID: ${job._id}`);
        console.log(`Subject: "${job.generatedEmail.subject}"`);
        console.log('');
        
        // Analyze text body formatting
        const textBody = job.generatedEmail.textBody || '';
        console.log('📝 TEXT BODY:');
        console.log('```');
        console.log(textBody);
        console.log('```\n');
        
        // Analyze formatting issues
        const lines = textBody.split('\n');
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        const emptyLines = lines.filter(line => line.trim() === '');
        
        console.log('🔍 FORMATTING ANALYSIS:');
        console.log(`- Total lines: ${lines.length}`);
        console.log(`- Non-empty lines: ${nonEmptyLines.length}`);
        console.log(`- Empty lines (spacing): ${emptyLines.length}`);
        console.log(`- Has proper paragraphs: ${emptyLines.length >= 2 ? '✅' : '❌'}`);
        console.log(`- Average line length: ${Math.round(nonEmptyLines.reduce((sum, line) => sum + line.length, 0) / nonEmptyLines.length)} chars`);
        
        // Check for specific formatting patterns
        const hasGreeting = /^(Hi|Hello|Dear)/i.test(textBody.trim());
        const hasClosing = /(Best regards|Sincerely|Thanks|Cheers)/i.test(textBody);
        const hasSignature = /\n[A-Za-z\s]+\n[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(textBody);
        
        console.log(`- Has greeting: ${hasGreeting ? '✅' : '❌'}`);
        console.log(`- Has closing: ${hasClosing ? '✅' : '❌'}`);
        console.log(`- Has signature: ${hasSignature ? '✅' : '❌'}`);
        
        // Check for run-on paragraphs
        const longParagraphs = nonEmptyLines.filter(line => line.length > 200);
        if (longParagraphs.length > 0) {
          console.log(`- ⚠️ Long paragraphs detected: ${longParagraphs.length}`);
          longParagraphs.forEach((para, i) => {
            console.log(`  ${i + 1}. ${para.length} chars: "${para.substring(0, 80)}..."`);
          });
        } else {
          console.log('- ✅ No overly long paragraphs');
        }
        
        // Analyze HTML body if present
        if (job.generatedEmail.htmlBody) {
          const htmlBody = job.generatedEmail.htmlBody;
          console.log('\n🌐 HTML BODY ANALYSIS:');
          console.log(`- Length: ${htmlBody.length} chars`);
          console.log(`- Has HTML structure: ${htmlBody.includes('<html') ? '✅' : '❌'}`);
          console.log(`- Has paragraphs: ${htmlBody.includes('<p>') ? '✅' : '❌'}`);
          console.log(`- Has line breaks: ${htmlBody.includes('<br>') ? '✅' : '❌'}`);
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
      });
      
      // Overall formatting assessment
      console.log('🎯 OVERALL FORMATTING ASSESSMENT:\n');
      
      const formattingIssues = [];
      let wellFormattedEmails = 0;
      
      emailJobs.forEach((job, index) => {
        const textBody = job.generatedEmail.textBody || '';
        const lines = textBody.split('\n');
        const emptyLines = lines.filter(line => line.trim() === '').length;
        const hasGreeting = /^(Hi|Hello|Dear)/i.test(textBody.trim());
        const hasClosing = /(Best regards|Sincerely|Thanks|Cheers)/i.test(textBody);
        
        if (emptyLines < 2) {
          formattingIssues.push(`Email ${index + 1}: Insufficient paragraph spacing`);
        }
        if (!hasGreeting) {
          formattingIssues.push(`Email ${index + 1}: Missing greeting`);
        }
        if (!hasClosing) {
          formattingIssues.push(`Email ${index + 1}: Missing closing`);
        }
        
        if (emptyLines >= 2 && hasGreeting && hasClosing) {
          wellFormattedEmails++;
        }
      });
      
      console.log(`✅ Well-formatted emails: ${wellFormattedEmails}/${emailJobs.length}`);
      
      if (formattingIssues.length > 0) {
        console.log('\n⚠️ Formatting Issues Found:');
        formattingIssues.forEach(issue => {
          console.log(`   - ${issue}`);
        });
      }
      
      // Recommendations
      console.log('\n💡 FORMATTING RECOMMENDATIONS:');
      if (formattingIssues.some(i => i.includes('spacing'))) {
        console.log('   🔧 Add double line breaks between paragraphs');
      }
      if (formattingIssues.some(i => i.includes('greeting'))) {
        console.log('   🔧 Ensure all emails start with proper greeting');
      }
      if (formattingIssues.some(i => i.includes('closing'))) {
        console.log('   🔧 Add professional closing and signature');
      }
      
      const overallFormatting = wellFormattedEmails === emailJobs.length ? '✅ GOOD' : '⚠️ NEEDS IMPROVEMENT';
      console.log(`\n🏁 Email Formatting Status: ${overallFormatting}`);
      
    } else {
      console.log('❌ No completed email jobs found to analyze formatting');
    }
    
  } catch (error) {
    console.error('❌ Email formatting check failed:', error.message);
  } finally {
    await client.close();
  }
}

checkEmailFormatting();