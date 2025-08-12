import { ClaudeClient } from './ClaudeClient';
import { EmailResponseAnalyzer, ResponseInsight } from './EmailResponseAnalyzer';
import { logger } from '@/utils/logger';

export interface ConversationStyle {
  name: string;
  description: string;
  approach: 'curious' | 'observational' | 'helpful' | 'collaborative' | 'industry-peer';
  toneAdjustment: string;
}

export interface StyleRecommendation {
  style: ConversationStyle;
  reasoning: string;
  confidence: number;
}

export class ConversationStyleService {
  private claudeClient: ClaudeClient;
  private responseAnalyzer: EmailResponseAnalyzer;
  private static instance: ConversationStyleService;

  private conversationStyles: ConversationStyle[] = [
    {
      name: 'Curious Professional',
      description: 'Genuinely curious about their business approach and challenges',
      approach: 'curious',
      toneAdjustment: 'Ask thoughtful questions about their work and express genuine interest in their solutions'
    },
    {
      name: 'Industry Observer',
      description: 'Someone who notices interesting industry trends and shares insights',
      approach: 'observational',
      toneAdjustment: 'Share relevant observations about their industry or business approach'
    },
    {
      name: 'Helpful Peer',
      description: 'A professional who might have something useful to share',
      approach: 'helpful',
      toneAdjustment: 'Offer potential help or resources in a non-pushy way'
    },
    {
      name: 'Collaborative Colleague',
      description: 'Someone looking for potential professional collaboration',
      approach: 'collaborative',
      toneAdjustment: 'Express interest in how businesses like theirs operate and grow'
    },
    {
      name: 'Industry Peer',
      description: 'Fellow professional who understands their challenges',
      approach: 'industry-peer',
      toneAdjustment: 'Speak as someone who works with similar businesses and understands their world'
    }
  ];

  private constructor() {
    this.claudeClient = ClaudeClient.getInstance();
    this.responseAnalyzer = EmailResponseAnalyzer.getInstance();
  }

  public static getInstance(): ConversationStyleService {
    if (!ConversationStyleService.instance) {
      ConversationStyleService.instance = new ConversationStyleService();
    }
    return ConversationStyleService.instance;
  }

  public async recommendConversationStyle(
    prospectData: any,
    analysis: any,
    campaignData: any
  ): Promise<StyleRecommendation> {
    const industry = analysis.businessContext?.industry || 'business';
    const businessStage = analysis.businessContext?.growthStage || 'growing';
    const professionalLevel = prospectData.businessIntelligence?.professionalLevel || 'professional';
    
    // Get insights from previous response patterns for similar prospects
    const prospectType = this.determineProspectType(prospectData);
    const responseInsights = this.responseAnalyzer.getInsightsForProspectType(prospectType);
    
    let insightsPrompt = '';
    if (responseInsights.recommendedStyles.length > 0) {
      insightsPrompt = `
RESPONSE INSIGHTS FROM SIMILAR PROSPECTS:
- Most successful styles: ${responseInsights.recommendedStyles
        .slice(0, 3)
        .map(s => `${s.style} (${Math.round(s.successRate * 100)}% success rate)`)
        .join(', ')}
- Content that works: ${responseInsights.contentRecommendations.slice(0, 3).join(', ')}
- Common challenges to address: ${responseInsights.commonChallenges.slice(0, 3).join(', ')}

Consider these insights when making your recommendation.
`;
    }
    
    const prompt = `Based on this business profile, recommend the most natural conversation approach for professional outreach.

BUSINESS PROFILE:
- Company: ${prospectData.companyName || 'Professional business'}
- Industry: ${industry}
- Business Stage: ${businessStage}
- Professional Level: ${professionalLevel}
- Services: ${prospectData.scrapedData?.services?.slice(0, 3).join(', ') || 'professional services'}
${insightsPrompt}
STYLE OPTIONS:
1. Curious Professional - Ask thoughtful questions about their work
2. Industry Observer - Share relevant industry observations
3. Helpful Peer - Offer potential resources or insights
4. Collaborative Colleague - Express interest in professional collaboration
5. Industry Peer - Speak as someone who works with similar businesses

Consider:
- What approach would feel most natural and non-intrusive?
- What style matches their professional level and industry?
- What would make them most likely to respond positively?
- What has worked best for similar prospects based on response data?

Respond with just the number (1-5) of the recommended style.`;

    try {
      const response = await this.claudeClient.createMessage([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 5
      });

      const styleIndex = parseInt(response.trim()) - 1;
      const selectedStyle = this.conversationStyles[styleIndex] || this.conversationStyles[0];

      const confidence = responseInsights.recommendedStyles.length > 0 ? 0.9 : 0.8;
      let reasoning = `Best fit for ${industry} professional at ${businessStage} stage`;
      
      if (responseInsights.recommendedStyles.length > 0) {
        const matchingStyle = responseInsights.recommendedStyles.find(s => 
          s.style.toLowerCase().includes(selectedStyle.approach) || 
          selectedStyle.name.toLowerCase().includes(s.style.toLowerCase())
        );
        
        if (matchingStyle) {
          reasoning += ` - Similar prospects respond well to this style (${Math.round(matchingStyle.successRate * 100)}% success rate)`;
        }
      }

      return {
        style: selectedStyle,
        reasoning,
        confidence
      };
    } catch (error) {
      logger.error('Failed to recommend conversation style:', error);
      
      // Fallback logic based on industry and business context
      if (industry.includes('photography') || industry.includes('creative')) {
        return {
          style: this.conversationStyles[0], // Curious Professional
          reasoning: 'Creative professionals appreciate genuine curiosity about their work',
          confidence: 0.6
        };
      } else if (industry.includes('event') || industry.includes('festival')) {
        return {
          style: this.conversationStyles[4], // Industry Peer
          reasoning: 'Event organizers respond well to industry peers who understand their challenges',
          confidence: 0.6
        };
      } else {
        return {
          style: this.conversationStyles[2], // Helpful Peer
          reasoning: 'General business professionals appreciate helpful, non-pushy approaches',
          confidence: 0.5
        };
      }
    }
  }

  public generateNaturalVariations(baseContent: string, style: ConversationStyle): string[] {
    const variations = [];
    
    // Add subtle human-like variations based on conversation style
    switch (style.approach) {
      case 'curious':
        variations.push(
          'I was looking at your work and found myself curious about...',
          'Something about your approach caught my attention...',
          'I came across your business and had a question...'
        );
        break;
        
      case 'observational':
        variations.push(
          'I noticed something interesting about your industry...',
          'I\'ve been seeing a trend in the [industry] space...',
          'Something I observed about businesses like yours...'
        );
        break;
        
      case 'helpful':
        variations.push(
          'I thought you might find this relevant...',
          'Something came up that made me think of your business...',
          'I came across something that might be useful...'
        );
        break;
        
      case 'collaborative':
        variations.push(
          'I\'ve been working with similar businesses...',
          'Your approach to [service] looks really solid...',
          'I work with businesses in your space and...'
        );
        break;
        
      case 'industry-peer':
        variations.push(
          'As someone who works with [industry] professionals...',
          'I understand the challenges in your industry...',
          'Working with businesses like yours, I often hear...'
        );
        break;
    }
    
    return variations;
  }

  public addHumanImperfections(text: string): string {
    // Add subtle natural language patterns that humans use
    const humanPatterns = [
      // Occasional contractions
      { from: ' do not ', to: ' don\'t ' },
      { from: ' cannot ', to: ' can\'t ' },
      { from: ' would not ', to: ' wouldn\'t ' },
      
      // Natural transitions
      { from: 'Additionally, ', to: 'Also, ' },
      { from: 'Furthermore, ', to: 'Plus, ' },
      { from: 'Therefore, ', to: 'So, ' },
      
      // Softer language
      { from: ' must ', to: ' should probably ' },
      { from: ' will ', to: ' would ' },
      { from: ' need to ', to: ' might want to ' }
    ];

    let processedText = text;
    
    // Apply random subset of humanizations
    const applicablePatterns = humanPatterns.filter(() => Math.random() > 0.7);
    
    applicablePatterns.forEach(pattern => {
      processedText = processedText.replace(new RegExp(pattern.from, 'g'), pattern.to);
    });

    return processedText;
  }

  /**
   * Determine prospect type for response learning integration
   */
  private determineProspectType(prospectData: any): string {
    const industry = prospectData.industry?.toLowerCase() || '';
    const services = prospectData.scrapedData?.services || [];
    
    if (industry.includes('photography') || services.some((s: string) => s.toLowerCase().includes('photo'))) {
      if (services.some((s: string) => s.toLowerCase().includes('wedding'))) {
        return 'wedding_photographer';
      } else if (services.some((s: string) => s.toLowerCase().includes('portrait'))) {
        return 'portrait_photographer';
      } else {
        return 'photographer_general';
      }
    } else if (industry.includes('event') || industry.includes('festival')) {
      return 'event_organizer';
    } else {
      return 'creative_professional';
    }
  }

  public getRandomConversationStarter(industry: string): string {
    const starters = [
      'I came across your work and...',
      'I was looking at your business and...',
      'Something about your approach caught my eye...',
      'I noticed your work in the [industry] space...',
      'Your approach to [service] looks interesting...',
      'I\'ve been working with similar businesses and...',
      'I came across your [service] work...',
      'I was researching [industry] professionals and...'
    ];

    const randomStarter = starters[Math.floor(Math.random() * starters.length)];
    return randomStarter.replace('[industry]', industry);
  }

  public validateNaturalness(text: string): {
    score: number;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for overly formal language
    const formalPhrases = ['Furthermore', 'Additionally', 'Subsequently', 'Henceforth'];
    formalPhrases.forEach(phrase => {
      if (text.includes(phrase)) {
        issues.push(`Too formal: "${phrase}"`);
        suggestions.push(`Replace "${phrase}" with more casual alternatives`);
        score -= 10;
      }
    });

    // Check for marketing jargon
    const marketingJargon = ['leverage', 'synergy', 'paradigm', 'disruptive', 'revolutionary'];
    marketingJargon.forEach(jargon => {
      if (text.toLowerCase().includes(jargon.toLowerCase())) {
        issues.push(`Marketing jargon: "${jargon}"`);
        suggestions.push(`Replace "${jargon}" with plain English`);
        score -= 15;
      }
    });

    // Check for overly long sentences
    const sentences = text.split(/[.!?]+/);
    const longSentences = sentences.filter(s => s.split(' ').length > 25);
    if (longSentences.length > 0) {
      issues.push('Some sentences are too long');
      suggestions.push('Break long sentences into shorter, more conversational ones');
      score -= 5 * longSentences.length;
    }

    // Check for natural contractions
    if (!text.includes("'") && text.length > 100) {
      issues.push('No contractions used');
      suggestions.push('Add natural contractions (don\'t, can\'t, won\'t) for conversational tone');
      score -= 5;
    }

    return {
      score: Math.max(0, score),
      issues,
      suggestions
    };
  }
}