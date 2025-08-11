import { ClaudeClient } from '@/services/ai/ClaudeClient';
import { logger } from '@/utils/logger';

export interface SubjectLineVariant {
  id: string;
  text: string;
  style: 'curiosity' | 'benefit' | 'question' | 'personalized' | 'social-proof';
  industry: string;
  createdAt: Date;
}

export interface SubjectLineTestResult {
  variantId: string;
  opens: number;
  sends: number;
  openRate: number;
  responses: number;
  responseRate: number;
  lastUpdated: Date;
}

export class SubjectLineService {
  private claudeClient: ClaudeClient;
  private static instance: SubjectLineService;

  private constructor() {
    this.claudeClient = ClaudeClient.getInstance();
  }

  public static getInstance(): SubjectLineService {
    if (!SubjectLineService.instance) {
      SubjectLineService.instance = new SubjectLineService();
    }
    return SubjectLineService.instance;
  }

  public async generateSubjectLineVariants(
    prospectData: any,
    analysis: any,
    campaignData: any
  ): Promise<SubjectLineVariant[]> {
    const industry = analysis.businessContext?.industry || 'creative services';
    const companyName = prospectData.companyName || 'your business';
    const painPoint = analysis.painPoints?.[0] || 'workflow optimization';

    logger.info(`Generating subject line variants for ${industry} professional`, {
      companyName,
      painPoint: painPoint.substring(0, 50)
    });

    const variants: SubjectLineVariant[] = [];

    // Generate curiosity-based variant
    variants.push(await this.generateCuriosityVariant(industry, companyName, painPoint));
    
    // Generate benefit-focused variant
    variants.push(await this.generateBenefitVariant(industry, companyName, analysis));
    
    // Generate question-based variant
    variants.push(await this.generateQuestionVariant(industry, companyName));
    
    // Generate personalized variant
    variants.push(await this.generatePersonalizedVariant(prospectData, analysis));
    
    // Generate social proof variant
    variants.push(await this.generateSocialProofVariant(industry, analysis));

    logger.info(`Generated ${variants.length} subject line variants`, {
      styles: variants.map(v => v.style),
      industry
    });

    return variants;
  }

  private async generateCuriosityVariant(
    industry: string,
    companyName: string,
    painPoint: string
  ): Promise<SubjectLineVariant> {
    const prompt = `Generate a natural, conversational subject line that would make a business professional curious enough to open an email. 

Context:
- Company: ${companyName}
- Industry: ${industry}
- Main challenge: ${painPoint}

Requirements:
- Sound like a genuine business question or observation
- Be conversational, not salesy
- Create natural curiosity without being clickbait
- Use everyday business language
- 4-8 words maximum
- No marketing jargon or buzzwords

Examples of natural curiosity:
- "Quick question about [specific business aspect]"
- "Noticed something about [industry] recently"  
- "Curious about your approach"
- "[CompanyName] workflow question"

Generate just the subject line, no quotes.`;

    const subjectText = await this.claudeClient.createMessage([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.8,
      maxTokens: 15
    });

    return {
      id: `curiosity-${Date.now()}`,
      text: subjectText.trim().replace(/['"]/g, ''),
      style: 'curiosity',
      industry,
      createdAt: new Date()
    };
  }

  private async generateBenefitVariant(
    industry: string,
    companyName: string,
    analysis: any
  ): Promise<SubjectLineVariant> {
    const growthStage = analysis.businessContext?.growthStage || 'scaling';
    const services = analysis.personalizationOpportunities?.join(', ') || 'business operations';
    
    const prompt = `Generate a natural subject line that hints at a business benefit without sounding salesy.

Context:
- Company: ${companyName}
- Industry: ${industry} 
- Business stage: ${growthStage}
- Focus areas: ${services}

Requirements:
- Sound like a genuine business insight or opportunity
- Avoid obvious sales language like "boost", "increase", "maximize"
- Use natural business conversation tone
- Be subtle about the benefit
- 4-8 words maximum
- Should feel like colleague-to-colleague communication

Examples of natural benefit hints:
- "Interesting approach for [industry]"
- "[CompanyName] time-saving idea"
- "Quick thought on your setup"  
- "Something that might help"
- "Worth discussing with you"

Generate just the subject line, no quotes.`;

    const subjectText = await this.claudeClient.createMessage([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.8,
      maxTokens: 15
    });

    return {
      id: `benefit-${Date.now()}`,
      text: subjectText.trim().replace(/['"]/g, ''),
      style: 'benefit',
      industry,
      createdAt: new Date()
    };
  }

  private async generateQuestionVariant(
    industry: string,
    companyName: string
  ): Promise<SubjectLineVariant> {
    const prompt = `Generate a natural, genuine business question that would feel appropriate coming from a professional contact.

Context:
- Company: ${companyName}
- Industry: ${industry}

Requirements:
- Sound like a real question a business professional would ask
- Be genuinely curious, not leading or pushy
- Use natural, conversational language
- 4-8 words maximum
- Avoid obvious sales questions
- Should feel like networking/professional interest

Examples of natural business questions:
- "Quick question about [specific area]"
- "How do you handle [process]?"
- "Curious about your approach"
- "[CompanyName] workflow question"
- "What's your take on [industry topic]?"

Generate just the subject line with question mark, no quotes.`;

    const subjectText = await this.claudeClient.createMessage([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.8,
      maxTokens: 15
    });

    return {
      id: `question-${Date.now()}`,
      text: subjectText.trim().replace(/['"]/g, ''),
      style: 'question',
      industry,
      createdAt: new Date()
    };
  }

  private async generatePersonalizedVariant(
    prospectData: any,
    analysis: any
  ): Promise<SubjectLineVariant> {
    const industry = analysis.businessContext?.industry || 'creative services';
    const companyName = prospectData.companyName || 'your business';
    const services = prospectData.scrapedData?.services?.[0] || 'services';
    const businessContext = analysis.businessContext?.growthStage || 'growing business';
    
    const prompt = `Generate a natural, personalized subject line that shows you've done some basic research about their business.

Context:
- Company: ${companyName}
- Industry: ${industry}
- Main service: ${services}
- Business stage: ${businessContext}

Requirements:
- Include company name naturally
- Reference their specific business/service area
- Sound like genuine professional interest
- Avoid marketing language and quotes
- 4-8 words maximum
- Should feel researched but not invasive

Examples of natural personalization:
- "${companyName} workflow question"
- "Quick ${industry} question"
- "Thought about ${companyName}"
- "${services} discussion"
- "Regarding ${companyName} operations"

Generate just the subject line, no quotes.`;

    const subjectText = await this.claudeClient.createMessage([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.7,
      maxTokens: 15
    });

    return {
      id: `personalized-${Date.now()}`,
      text: subjectText.trim().replace(/['"]/g, ''),
      style: 'personalized',
      industry,
      createdAt: new Date()
    };
  }

  private async generateSocialProofVariant(
    industry: string,
    analysis: any
  ): Promise<SubjectLineVariant> {
    const businessContext = analysis.businessContext?.growthStage || 'growing';
    
    const prompt = `Generate a natural subject line that subtly references what others in the industry are doing, without sounding like a sales pitch.

Context:
- Industry: ${industry}
- Business context: ${businessContext}

Requirements:
- Mention others in the industry naturally
- Sound like sharing industry insights
- Be conversational, not promotional
- Avoid obvious social proof language
- 4-8 words maximum
- Should feel like professional networking

Examples of natural social proof:
- "What other [industry] pros are doing"
- "Industry trend worth mentioning"
- "Interesting [industry] development"
- "Something colleagues are discussing"
- "Worth sharing with you"

Generate just the subject line, no quotes.`;

    const subjectText = await this.claudeClient.createMessage([
      { role: 'user', content: prompt }
    ], {
      temperature: 0.8,
      maxTokens: 15
    });

    return {
      id: `social-proof-${Date.now()}`,
      text: subjectText.trim().replace(/['"]/g, ''),
      style: 'social-proof',
      industry,
      createdAt: new Date()
    };
  }





  public async selectOptimalSubjectLine(
    variants: SubjectLineVariant[],
    testResults: SubjectLineTestResult[]
  ): Promise<SubjectLineVariant> {
    // If we have test results, use them to select the best performer
    if (testResults.length > 0) {
      const bestResult = testResults.reduce((best, current) => {
        // Prioritize response rate over open rate for conversion optimization
        const bestScore = (best.responseRate * 2) + best.openRate;
        const currentScore = (current.responseRate * 2) + current.openRate;
        return currentScore > bestScore ? current : best;
      });

      const bestVariant = variants.find(v => v.id === bestResult.variantId);
      if (bestVariant) {
        logger.info('Selected best performing subject line variant', {
          variantId: bestVariant.id,
          style: bestVariant.style,
          openRate: bestResult.openRate,
          responseRate: bestResult.responseRate
        });
        return bestVariant;
      }
    }

    // Fallback to style-based selection with industry weighting
    const preferredStyles = this.getPreferredStylesByIndustry(variants[0]?.industry || 'creative services');
    
    for (const style of preferredStyles) {
      const variant = variants.find(v => v.style === style);
      if (variant) {
        logger.info('Selected subject line variant by style preference', {
          style,
          industry: variant.industry
        });
        return variant;
      }
    }

    // Final fallback
    return variants[0];
  }

  private getPreferredStylesByIndustry(industry: string): Array<'curiosity' | 'benefit' | 'question' | 'personalized' | 'social-proof'> {
    // Randomize style selection for better variety
    const allStyles: Array<'curiosity' | 'benefit' | 'question' | 'personalized' | 'social-proof'> = 
      ['personalized', 'curiosity', 'benefit', 'question', 'social-proof'];
    
    // Shuffle the array for randomness
    const shuffled = [...allStyles].sort(() => Math.random() - 0.5);
    
    if (industry.includes('photography')) {
      return shuffled;
    }

    if (industry.includes('festival') || industry.includes('event')) {
      return ['social-proof', 'curiosity', 'personalized', 'benefit', 'question'];
    }

    if (industry.includes('market')) {
      return ['benefit', 'personalized', 'social-proof', 'curiosity', 'question'];
    }

    // Default order for creative services
    return ['curiosity', 'personalized', 'benefit', 'social-proof', 'question'];
  }

  public validateSubjectLine(subjectLine: string): {
    isValid: boolean;
    score: number;
    warnings: string[];
    suggestions: string[];
  } {
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check length (optimal 6-8 words, 30-50 characters)
    const wordCount = subjectLine.split(' ').length;
    const charCount = subjectLine.length;

    if (wordCount > 10) {
      warnings.push('Subject line too long (over 10 words)');
      score -= 20;
    } else if (wordCount < 3) {
      warnings.push('Subject line too short (under 3 words)');
      score -= 15;
    }

    if (charCount > 60) {
      warnings.push('Subject line may be truncated on mobile (over 60 characters)');
      score -= 10;
    }

    // Check for spam triggers
    const spamTriggers = ['free', 'amazing', 'incredible', 'guaranteed', 'urgent', '!!!', 'act now', 'limited time'];
    const lowerSubject = subjectLine.toLowerCase();
    
    for (const trigger of spamTriggers) {
      if (lowerSubject.includes(trigger)) {
        warnings.push(`Contains potential spam trigger: "${trigger}"`);
        score -= 25;
      }
    }

    // Check for excessive capitalization
    const capsRatio = (subjectLine.match(/[A-Z]/g) || []).length / subjectLine.length;
    if (capsRatio > 0.3) {
      warnings.push('Too many capital letters (may appear spammy)');
      score -= 15;
    }

    // Provide suggestions
    if (wordCount > 8) {
      suggestions.push('Consider shortening to 6-8 words for better mobile display');
    }

    if (!subjectLine.includes(subjectLine.charAt(0).toUpperCase())) {
      suggestions.push('Consider capitalizing the first letter');
    }

    if (lowerSubject.includes('re:') || lowerSubject.includes('fwd:')) {
      warnings.push('Appears to be a reply/forward - may confuse recipients');
      score -= 10;
    }

    return {
      isValid: score >= 60,
      score: Math.max(0, score),
      warnings,
      suggestions
    };
  }
}