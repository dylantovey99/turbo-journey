const { PsychologicalTriggerService } = require('./dist/services/ai/PsychologicalTriggerService.js');

async function testPsychologicalTriggers() {
  try {
    const triggerService = PsychologicalTriggerService.getInstance();
    
    // Test with a photography prospect
    const mockProspect = {
      industry: 'photography',
      companyName: 'TestStudio Photography',
      businessIntelligence: {
        professionalLevel: 'professional',
        businessMaturity: 'established'
      }
    };
    
    const mockCampaign = {
      tone: 'professional'
    };
    
    const mockAnalysis = {
      businessContext: {
        industry: 'photography',
        growthStage: 'scaling',
        marketPosition: 'follower'
      }
    };
    
    console.log('Testing psychological triggers generation...');
    const triggers = await triggerService.generateTriggersForProspect(mockProspect, mockCampaign, mockAnalysis);
    
    console.log(`✅ Generated ${triggers.length} triggers:`);
    triggers.forEach((trigger, index) => {
      console.log(`${index + 1}. Type: ${trigger.type}, Intensity: ${trigger.intensity}`);
      console.log(`   Content: ${trigger.content}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error testing psychological triggers:', error.message);
    console.error(error.stack);
  }
}

testPsychologicalTriggers();