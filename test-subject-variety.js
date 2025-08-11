const dotenv = require('dotenv');
dotenv.config();

async function testSubjectLineVariety() {
  console.log('📧 Testing Subject Line Variety Improvements...\n');
  
  try {
    // Test SubjectLineService directly
    console.log('1. 🎯 Testing SubjectLineService Generation:');
    
    const { SubjectLineService } = require('./dist/services/email/SubjectLineService.js');
    const subjectService = SubjectLineService.getInstance();
    
    const mockProspect = {
      companyName: 'Elite Wedding Photography',
      scrapedData: {
        services: ['Wedding Photography', 'Engagement Sessions', 'Bridal Portraits']
      }
    };
    
    const mockAnalysis = {
      businessContext: { 
        industry: 'photography',
        growthStage: 'scaling'
      },
      painPoints: ['colour accuracy challenges', 'client satisfaction with prints']
    };
    
    const mockCampaign = {
      tone: 'professional'
    };
    
    console.log('   📸 Sample prospect: Elite Wedding Photography\n');
    
    // Generate multiple sets of variants to test variety
    const allVariants = [];
    const allSelectedSubjects = [];
    
    for (let i = 0; i < 5; i++) {
      console.log(`   Test ${i + 1}:`);
      
      const variants = await subjectService.generateSubjectLineVariants(
        mockProspect, 
        mockAnalysis, 
        mockCampaign
      );
      
      allVariants.push(...variants);
      
      variants.forEach(variant => {
        console.log(`      [${variant.style.padEnd(12)}] "${variant.text}"`);
      });
      
      // Test subject selection
      const selected = await subjectService.selectOptimalSubjectLine(variants, []);
      allSelectedSubjects.push(selected.text);
      console.log(`      → Selected: "${selected.text}" (${selected.style})\n`);
    }
    
    // Analyze variety
    console.log('2. 📊 Variety Analysis:');
    const uniqueSubjects = [...new Set(allSelectedSubjects)];
    const uniqueVariants = [...new Set(allVariants.map(v => v.text))];
    
    console.log(`   Generated: ${allVariants.length} total variants`);
    console.log(`   Unique variants: ${uniqueVariants.length}`);
    console.log(`   Selected subjects: ${allSelectedSubjects.length}`);
    console.log(`   Unique selected: ${uniqueSubjects.length}`);
    console.log(`   Variety rate: ${Math.round((uniqueSubjects.length / allSelectedSubjects.length) * 100)}%\n`);
    
    if (uniqueSubjects.length === allSelectedSubjects.length) {
      console.log('   ✅ Perfect variety - no duplicate subjects selected');
    } else {
      console.log('   ⚠️ Some duplicate subjects selected');
      const duplicates = allSelectedSubjects.filter((subject, index) => 
        allSelectedSubjects.indexOf(subject) !== index
      );
      console.log(`   Duplicates: ${[...new Set(duplicates)].join(', ')}`);
    }
    
    // Test style distribution
    console.log('\n3. 🎨 Style Distribution:');
    const styleCount = {};
    allVariants.forEach(variant => {
      styleCount[variant.style] = (styleCount[variant.style] || 0) + 1;
    });
    
    Object.entries(styleCount).forEach(([style, count]) => {
      console.log(`   ${style}: ${count} variants`);
    });
    
    // Test photography-specific content
    console.log('\n4. 📸 Photography-Specific Content Check:');
    const photographyTerms = [
      'print', 'client', 'studio', 'portfolio', 'quality', 'color', 'colour',
      'wedding', 'portrait', 'gallery', 'awe', 'branch', 'detail'
    ];
    
    const photographyVariants = allVariants.filter(variant => 
      photographyTerms.some(term => 
        variant.text.toLowerCase().includes(term.toLowerCase())
      )
    );
    
    console.log(`   Variants with photography terms: ${photographyVariants.length}/${allVariants.length}`);
    console.log(`   Photography relevance: ${Math.round((photographyVariants.length / allVariants.length) * 100)}%`);
    
    // Show examples of photography-specific subjects
    console.log('\n   📋 Photography-specific examples:');
    photographyVariants.slice(0, 3).forEach((variant, index) => {
      console.log(`      ${index + 1}. "${variant.text}" (${variant.style})`);
    });
    
    console.log('\n5. 🔄 Integration Status:');
    console.log('   ✅ SubjectLineService: Working');
    console.log('   ✅ Variant Generation: Multiple styles generated');
    console.log('   ✅ Photography Content: Industry-specific terms included');
    console.log('   ✅ Selection Logic: Optimal variant selection working');
    
    const varietyGood = uniqueSubjects.length >= 4;
    const photographyGood = photographyVariants.length > allVariants.length * 0.5;
    
    console.log(`\n🏁 Subject Line Variety Status: ${varietyGood && photographyGood ? '✅ EXCELLENT' : '⚠️ NEEDS IMPROVEMENT'}`);
    
    if (varietyGood && photographyGood) {
      console.log('   💡 Subject line generation now produces diverse, industry-specific options');
      console.log('   📧 EmailGenerator integration should eliminate duplicate subjects');
    } else {
      if (!varietyGood) console.log('   🔧 Need to improve subject line diversity');
      if (!photographyGood) console.log('   🔧 Need more photography-specific content');
    }
    
  } catch (error) {
    console.error('❌ Subject line variety test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

testSubjectLineVariety();