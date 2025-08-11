const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function checkSubjectLines() {
  console.log('📧 Analyzing Subject Line Variety...\n');
  
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/email-generator';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('email-generator');
    
    // Get all completed email jobs
    const emailJobs = await db.collection('emailjobs').find({
      status: 'completed',
      generatedEmail: { $exists: true }
    }).toArray();
    
    if (emailJobs.length > 0) {
      console.log(`📊 Found ${emailJobs.length} completed emails\n`);
      
      console.log('📧 SUBJECT LINES ANALYSIS:\n');
      
      const subjectLines = emailJobs.map(job => job.generatedEmail.subject);
      const uniqueSubjects = [...new Set(subjectLines)];
      
      console.log(`Total emails: ${emailJobs.length}`);
      console.log(`Unique subject lines: ${uniqueSubjects.length}`);
      console.log(`Variety ratio: ${Math.round((uniqueSubjects.length / emailJobs.length) * 100)}%\n`);
      
      console.log('📝 ALL SUBJECT LINES:');
      emailJobs.forEach((job, index) => {
        const subject = job.generatedEmail.subject;
        const isDuplicate = subjectLines.filter(s => s === subject).length > 1;
        console.log(`${index + 1}. "${subject}" ${isDuplicate ? '🔄 (DUPLICATE)' : '✅'}`);
      });
      
      if (uniqueSubjects.length < emailJobs.length) {
        console.log('\n⚠️ DUPLICATE SUBJECTS FOUND:');
        const duplicateSubjects = subjectLines.filter((subject, index) => 
          subjectLines.indexOf(subject) !== index
        );
        
        const duplicateGroups = {};
        subjectLines.forEach(subject => {
          duplicateGroups[subject] = (duplicateGroups[subject] || 0) + 1;
        });
        
        Object.entries(duplicateGroups)
          .filter(([subject, count]) => count > 1)
          .forEach(([subject, count]) => {
            console.log(`   "${subject}" - appears ${count} times`);
          });
      }
      
      // Check if SubjectLineService is being used
      console.log('\n🔍 CHECKING EMAIL GENERATION PROCESS:');
      
      // Look at the email generation code
      console.log('   Checking if SubjectLineService is integrated...');
      
      // Check if there's variety in email content vs subjects
      const emailContents = emailJobs.map(job => job.generatedEmail.textBody?.substring(0, 100));
      const uniqueContents = [...new Set(emailContents)].length;
      
      console.log(`   Email content variety: ${uniqueContents}/${emailJobs.length} unique`);
      
      if (uniqueContents > uniqueSubjects.length) {
        console.log('   📊 Content varies but subjects are similar - SubjectLineService likely not being used');
      }
      
    } else {
      console.log('❌ No completed email jobs found');
    }
    
    // Test SubjectLineService directly
    console.log('\n🧪 TESTING SUBJECTLINESERVICE DIRECTLY:');
    
    try {
      const testCode = `
        const { SubjectLineService } = require('./dist/services/email/SubjectLineService.js');
        
        const subjectService = SubjectLineService.getInstance();
        
        const mockProspect = {
          companyName: 'Artisan Photography',
          scrapedData: {
            services: ['Wedding Photography', 'Portraits']
          }
        };
        
        const mockAnalysis = {
          businessContext: { 
            industry: 'photography',
            growthStage: 'scaling'
          }
        };
        
        const mockCampaign = {
          tone: 'professional'
        };
        
        // Generate multiple variants
        console.log('   Generated subject line variants:');
        
        for (let i = 0; i < 5; i++) {
          const variants = await subjectService.generateSubjectLineVariants(
            mockProspect, 
            mockAnalysis, 
            mockCampaign
          );
          
          console.log(\`   Test \${i + 1}:\`);
          variants.forEach(variant => {
            console.log(\`      [\${variant.style}] "\${variant.text}"\`);
          });
          console.log('');
        }
      `;
      
      await eval(`(async () => { ${testCode} })()`);
      
    } catch (error) {
      console.log(`   ❌ SubjectLineService test failed: ${error.message}`);
    }
    
    console.log('\n🎯 SUBJECT LINE ISSUE DIAGNOSIS:');
    
    const issues = [];
    if (uniqueSubjects.length < 3) {
      issues.push('Very low subject line variety');
    }
    if (uniqueSubjects.length < emailJobs.length * 0.7) {
      issues.push('Too many duplicate subjects');
    }
    
    if (issues.length > 0) {
      console.log('❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      
      console.log('\n💡 Likely causes:');
      console.log('   - SubjectLineService not integrated into EmailGenerator');
      console.log('   - ClaudeClient using fixed subject line template');
      console.log('   - Subject generation happening in wrong location');
      
    } else {
      console.log('✅ Subject line variety looks good');
    }
    
  } catch (error) {
    console.error('❌ Subject line analysis failed:', error.message);
  } finally {
    await client.close();
  }
}

checkSubjectLines();