const { PsychologicalTriggerService } = require('./dist/services/ai/PsychologicalTriggerService.js');

async function testPhotographySpecificTriggers() {
  try {
    const triggerService = PsychologicalTriggerService.getInstance();
    
    // Test creating profile for photography
    console.log('Testing photography-specific trigger profile...');
    
    const mockProspect = {
      industry: 'photography',
      companyName: 'TestStudio Photography',
      businessIntelligence: {
        professionalLevel: 'professional',
        businessMaturity: 'established'
      }
    };
    
    // Test the profile creation method directly
    console.log('Industry check:', mockProspect.industry.includes('photography'));
    
    const mockAnalysis = {
      businessContext: { industry: 'photography', growthStage: 'scaling' },
      painPoints: ['clients not being "in awe" of their print quality']
    };
    
    const mockCampaign = {
      tone: 'professional'
    };
    
    const triggers = await triggerService.generateTriggersForProspect(mockProspect, mockAnalysis, mockCampaign);
    
    console.log(`Generated ${triggers.length} triggers for photography business:`);
    triggers.forEach((trigger, index) => {
      console.log(`${index + 1}. Type: ${trigger.type}, Intensity: ${trigger.intensity}`);
      console.log(`   Content: "${trigger.content}"`);
      console.log(`   Industry-specific: ${trigger.content.includes('photography') || trigger.content.includes('photographers') || trigger.content.includes('studio') || trigger.content.includes('print')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testPhotographySpecificTriggers();