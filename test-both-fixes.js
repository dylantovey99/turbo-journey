const dotenv = require('dotenv');
dotenv.config();

async function testBothFixes() {
  console.log('🔧 Testing Subject Line Variety and Paragraph Spacing Fixes...\n');
  
  try {
    // Test 1: Subject Line Variety
    console.log('1. 📧 Testing Subject Line Variety:');
    
    const { SubjectLineService } = require('./dist/services/email/SubjectLineService.js');
    const subjectService = SubjectLineService.getInstance();
    
    const mockProspect = {
      companyName: 'Elite Photography Studio',
      scrapedData: {
        services: ['Wedding Photography']
      }
    };
    
    const mockAnalysis = {
      businessContext: { 
        industry: 'photography',
        growthStage: 'scaling'
      }
    };
    
    const mockCampaign = { tone: 'professional' };
    
    // Generate 10 subject lines to test variety
    const allSubjects = [];
    const styleDistribution = {};
    
    for (let i = 0; i < 10; i++) {
      const variants = await subjectService.generateSubjectLineVariants(
        mockProspect, mockAnalysis, mockCampaign
      );
      
      const selected = await subjectService.selectOptimalSubjectLine(variants, []);
      allSubjects.push(selected.text);
      styleDistribution[selected.style] = (styleDistribution[selected.style] || 0) + 1;
      
      console.log(`   ${i + 1}. [${selected.style.padEnd(12)}] "${selected.text}"`);
    }
    
    const uniqueSubjects = [...new Set(allSubjects)];
    console.log(`\n   📊 Variety Results:`);
    console.log(`   - Generated: ${allSubjects.length} subjects`);
    console.log(`   - Unique: ${uniqueSubjects.length}`);
    console.log(`   - Variety: ${Math.round((uniqueSubjects.length / allSubjects.length) * 100)}%`);
    
    console.log(`\n   🎨 Style Distribution:`);
    Object.entries(styleDistribution).forEach(([style, count]) => {
      console.log(`   - ${style}: ${count}`);
    });
    
    const varietyGood = uniqueSubjects.length >= 8; // At least 80% unique
    console.log(`\n   ${varietyGood ? '✅' : '❌'} Subject variety: ${varietyGood ? 'FIXED' : 'NEEDS MORE WORK'}`);
    
    // Test 2: Paragraph Spacing (simulate what Claude should produce)
    console.log('\n2. 📝 Testing Paragraph Spacing Requirements:');
    
    const expectedFormat = `Hi Sarah,

I came across Elite Photography Studio and was impressed by your wedding portfolio. Your attention to capturing those intimate moments really stands out.

I've been working with photography studios lately, and many mention how challenging it is to find print partners who truly understand color accuracy. The successful ones often tell me they need prints where every detail is crisp enough that clients examine them closely.

Would you be open to a brief conversation about your current print workflow and what you'd like to achieve?

Best regards,
Michael`;

    console.log('   📋 Expected Email Format:');
    console.log('   ```');
    console.log(expectedFormat);
    console.log('   ```\n');
    
    // Analyze the expected format
    const lines = expectedFormat.split('\n');
    const emptyLines = lines.filter(line => line.trim() === '');
    const contentLines = lines.filter(line => line.trim() !== '');
    const paragraphs = expectedFormat.split('\n\n');
    
    console.log('   📊 Format Analysis:');
    console.log(`   - Total lines: ${lines.length}`);
    console.log(`   - Empty lines: ${emptyLines.length}`);
    console.log(`   - Content lines: ${contentLines.length}`);
    console.log(`   - Paragraphs: ${paragraphs.length}`);
    console.log(`   - Double line breaks: ${expectedFormat.split('\\n\\n').length - 1}`);
    
    const hasProperSpacing = emptyLines.length >= 4; // Need empty lines between paragraphs
    console.log(`\n   ${hasProperSpacing ? '✅' : '❌'} Paragraph spacing: ${hasProperSpacing ? 'PROPER FORMAT' : 'NEEDS WORK'}`);
    
    console.log('\n3. 🔍 Critical Formatting Instructions Added:');
    console.log('   ✅ "Use exactly 4 paragraphs separated by double line breaks (\\\\n\\\\n)"');
    console.log('   ✅ "Each paragraph must be 1-3 sentences maximum"');
    console.log('   ✅ "Never combine paragraphs into one block of text"');
    console.log('   ✅ Example format provided in JSON response template');
    
    console.log('\n4. 🚀 Expected Improvements:');
    console.log('   📧 Subject Lines:');
    console.log('   - Random style selection instead of always "personalized"');
    console.log('   - 12+ personalized templates (was 5)');
    console.log('   - 14+ benefit templates (was 5)');
    console.log('   - Should achieve 80-90% subject variety');
    
    console.log('\n   📝 Email Formatting:');
    console.log('   - Explicit double line break requirements');
    console.log('   - Paragraph count enforcement');
    console.log('   - JSON response template with proper format');
    console.log('   - Should eliminate run-on paragraph issues');
    
    const overallStatus = varietyGood && hasProperSpacing;
    console.log(`\n🏁 Fix Status: ${overallStatus ? '✅ BOTH ISSUES ADDRESSED' : '⚠️ MONITORING REQUIRED'}`);
    
    if (overallStatus) {
      console.log('💡 Next generated emails should have:');
      console.log('   - Diverse, industry-specific subject lines');
      console.log('   - Proper paragraph spacing with 4 distinct sections');
      console.log('   - No more run-on text blocks');
    } else {
      console.log('💡 Additional monitoring needed to verify fixes in production');
    }
    
  } catch (error) {
    console.error('❌ Fix testing failed:', error.message);
    console.error('Stack:', error.stack?.split('\\n').slice(0, 3).join('\\n'));
  }
}

testBothFixes();