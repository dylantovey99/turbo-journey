const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function debugBrokenTriggers() {
  console.log('🔍 Debugging Broken Psychological Trigger Integration...\n');
  
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('email-generator');
    
    // Get recent emails to find the broken sentences
    console.log('1. 📧 Analyzing Broken Trigger Integration:');
    
    const recentEmails = await db.collection('emailjobs').find({
      status: 'completed',
      generatedEmail: { $exists: true }
    }).sort({ _id: -1 }).limit(5).toArray();
    
    if (recentEmails.length > 0) {
      recentEmails.forEach((job, index) => {
        const email = job.generatedEmail;
        const textBody = email.textBody || '';
        
        console.log(`\\n   📧 Email ${index + 1}:`);
        console.log(`   Subject: "${email.subject}"`);
        
        // Look for broken trigger integration patterns
        const brokenPatterns = [
          'Your vision clearly demonstrates I have some',
          'Most creative professionals I work with discover Your',
          'I\'d be happy to share our research on Your',
          'The quality of your creative work reflects I\'m impressed',
          'Your creative vision in creative clearly'
        ];
        
        let foundBrokenPattern = false;
        brokenPatterns.forEach(pattern => {
          if (textBody.includes(pattern)) {
            console.log(`   ❌ BROKEN: "${pattern}"`);
            foundBrokenPattern = true;
          }
        });
        
        if (!foundBrokenPattern) {
          console.log(`   ✅ No obvious broken patterns detected`);
        }
        
        // Check for incomplete sentences
        const sentences = textBody.split('.').filter(s => s.trim().length > 0);
        const incompleteSentences = sentences.filter(sentence => {
          const words = sentence.trim().split(' ');
          return words.length < 3 || 
                 sentence.includes('Your vision clearly demonstrates') ||
                 sentence.includes('Most creative professionals I work with discover');
        });
        
        if (incompleteSentences.length > 0) {
          console.log(`   ❌ Incomplete sentences found:`);
          incompleteSentences.forEach(sentence => {
            console.log(`      "${sentence.trim()}..."`);
          });
        }
      });
    }
    
    console.log('\\n2. 🎯 ROOT CAUSE ANALYSIS:');
    console.log('   The broken sentences appear to be psychological triggers');
    console.log('   being inserted mid-sentence instead of as complete thoughts.');
    console.log('');
    console.log('   Pattern: "Your vision clearly demonstrates [TRIGGER_CONTENT] [NEXT_TRIGGER]"');
    console.log('   This suggests the Claude prompt is concatenating triggers incorrectly.');
    
    console.log('\\n3. 🔧 IDENTIFIED ISSUE:');
    console.log('   The psychological triggers are being inserted as fragments');
    console.log('   instead of being woven naturally into complete sentences.');
    console.log('   ');
    console.log('   CURRENT PROMPT ISSUE:');
    console.log('   "Subtly incorporate 1-2 psychological trigger concepts"');
    console.log('   ');
    console.log('   The AI is literally inserting the trigger content mid-sentence');
    console.log('   instead of using the trigger concepts to inform the messaging.');
    
    console.log('\\n4. 💡 SOLUTION REQUIRED:');
    console.log('   Need to fix the ClaudeClient prompt to:');
    console.log('   1. Use triggers as CONCEPTS, not direct text insertion');
    console.log('   2. Generate coherent sentences inspired by trigger themes');
    console.log('   3. Prevent mid-sentence trigger injection');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await client.close();
  }
}

debugBrokenTriggers();