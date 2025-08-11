import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class ClaudeClient {
  private client: Anthropic;
  private static instance: ClaudeClient;

  private constructor() {
    this.client = new Anthropic({
      apiKey: config.claude.apiKey,
    });
  }

  public static getInstance(): ClaudeClient {
    if (!ClaudeClient.instance) {
      ClaudeClient.instance = new ClaudeClient();
    }
    return ClaudeClient.instance;
  }

  public async createMessage(
    messages: Anthropic.Messages.MessageParam[],
    options: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    try {
      // Convert messages format for Claude
      const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      
      const response = await this.client.messages.create({
        model: options.model || config.claude.model,
        max_tokens: options.maxTokens || config.claude.maxTokens,
        temperature: options.temperature || config.claude.temperature,
        system: options.systemPrompt || undefined,
        messages: userMessages as Anthropic.Messages.MessageParam[],
      });

      const content = response.content[0];
      if (content.type !== 'text' || !content.text) {
        throw new Error('No text content in Claude response');
      }

      logger.debug('Claude API call successful', {
        model: response.model,
        usage: response.usage,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      });

      return content.text;
    } catch (error) {
      logger.error('Claude API call failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        model: options.model || config.claude.model,
      });
      throw error;
    }
  }

  public async analyzeProspectContent(
    prospectData: any,
    marketingDocument: string,
    responseInsights?: {
      recommendedStyles: Array<{ style: string; successRate: number; confidence: number }>;
      contentRecommendations: string[];
      commonChallenges: string[];
    }
  ): Promise<{
    relevantUSPs: string[];
    personalizationOpportunities: string[];
    recommendedTone: string;
    confidence: number;
    businessContext: {
      companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
      growthStage: 'early' | 'scaling' | 'mature' | 'declining';
      marketPosition: 'leader' | 'challenger' | 'follower' | 'niche';
      industry: string;
    };
    painPoints: string[];
    opportunitySignals: string[];
    recommendedProofPoints: string[];
  }> {
    const prompt = `
CONVERSION-FOCUSED PROSPECT ANALYSIS for personalized outreach optimization.

PROSPECT INTELLIGENCE:
- Business: ${prospectData.companyName || 'Professional Business'} (${prospectData.businessIntelligence?.teamSize || 'small'} team, ${prospectData.businessIntelligence?.businessMaturity || 'growing'} maturity)
- Website: ${prospectData.website}
- Industry: ${prospectData.detailedIndustryClassification || prospectData.industry || 'creative professional services'}
- Market Position: ${prospectData.competitivePosition?.marketPosition || 'follower'}
- Professional Level: ${prospectData.businessIntelligence?.professionalLevel || 'professional'}
- Growth Signals: ${prospectData.businessIntelligence?.growthSignals?.join(', ') || 'stable operations'}
- Seasonal Patterns: ${prospectData.businessIntelligence?.seasonalIndicators?.join(', ') || 'general seasonal patterns'}
- Credibility Markers: Awards(${prospectData.businessIntelligence?.hasAwards ? 'Yes' : 'No'}), Certifications(${prospectData.businessIntelligence?.hasCertifications ? 'Yes' : 'No'}), Client Logos(${prospectData.businessIntelligence?.hasClientLogos ? 'Yes' : 'No'})
- Revenue Indicators: Pricing Page(${prospectData.businessIntelligence?.hasPricing ? 'Yes' : 'No'}), Booking System(${prospectData.businessIntelligence?.hasBookingSystem ? 'Yes' : 'No'})
- Social Proof: ${prospectData.businessIntelligence?.testimonialsCount || 0} testimonials found

SERVICES & FOCUS:
${prospectData.scrapedData?.services?.slice(0, 5).join(', ') || 'Professional services'}

RECENT NEWS/UPDATES:
${prospectData.scrapedData?.recentNews?.slice(0, 3).join(', ') || 'No recent news found'}

COMPETITIVE POSITIONING:
- Competitive Advantages: ${prospectData.competitivePosition?.competitiveAdvantages?.join(', ') || 'professional dedication'}
- Differentiators: ${prospectData.competitivePosition?.differentiators?.join(', ') || 'dedicated service'}

MARKETING DOCUMENT CAPABILITIES:
${marketingDocument.substring(0, 1500)}...

${responseInsights ? `RESPONSE INSIGHTS FROM SIMILAR PROSPECTS:
- Successful Email Styles: ${responseInsights.recommendedStyles.map(s => `${s.style} (${Math.round(s.successRate * 100)}% success rate)`).join(', ') || 'No data yet'}
- Content Recommendations: ${responseInsights.contentRecommendations.join(', ') || 'Focus on genuine business conversation'}
- Common Challenges: ${responseInsights.commonChallenges.join(', ') || 'No specific challenges identified yet'}

Use these insights to inform your analysis and recommendations.
` : ''}

PROVIDE DETAILED CONVERSION-OPTIMIZED ANALYSIS in JSON format:
{
  "relevantUSPs": ["Identify the 2 most compelling value propositions from the marketing document that directly address the prospect's likely challenges and business stage."],
  "personalizationOpportunities": ["Suggest 2-3 high-impact personalization angles. These should be specific and actionable, based on the prospect's services, recent news, growth signals, or market position."],
  "recommendedTone": "professional|casual|friendly|formal (Choose a tone that aligns with the prospect's branding and professional level)",
  "confidence": 0.85,
  "businessContext": {
    "companySize": "${prospectData.businessIntelligence?.teamSize || 'small'}",
    "growthStage": "early|scaling|mature|declining (Infer this from their growth signals, business maturity, and recent news)",
    "marketPosition": "${prospectData.competitivePosition?.marketPosition || 'follower'}",
    "industry": "${prospectData.detailedIndustryClassification || prospectData.industry || 'creative services'}"
  },
  "painPoints": ["For photographers: Identify print-specific challenges like 'inconsistent print quality affecting client satisfaction', 'long turnaround times causing delivery delays', 'high print costs reducing profit margins'. For festivals/markets: Focus on operational challenges like 'managing vendor contracts for a growing festival', 'streamlining billing processes'."],
  "opportunitySignals": ["List 2-3 timing indicators for outreach. These could be based on growth signals (hiring, new services), seasonal patterns, or recent news."],
  "recommendedProofPoints": ["For photographers: Suggest print-specific proof points like 'gallery-quality print samples', 'color accuracy testimonials from wedding photographers', 'turnaround time case studies'. For festivals/markets: Focus on 'operational efficiency case studies', 'vendor management success stories'."]
}

FOCUS ON:
- Actionable insights that can be directly used in an email.
- Deeply understanding the prospect's business and context.
- Connecting the marketing document's strengths to the prospect's specific needs.
`;

    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const systemPrompt = 'You are an expert analyst specializing in professional printing services for photographers and operational solutions for event organizers. For photography businesses, you understand print quality challenges, client delivery expectations, color accuracy requirements, and profit margin pressures in the print fulfillment industry. For event organizers (festivals, markets), you focus on operational efficiency, vendor management, and community engagement solutions. Always respond with valid JSON format when requested.';

    let response = '';
    let jsonStr = '';
    
    try {
      response = await this.createMessage(messages, {
        systemPrompt,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      // Extract JSON from response (Claude might include extra text)
      jsonStr = response.trim();
      
      // Try to find JSON block if response includes markdown or extra text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // Look for JSON object boundaries
        const startIdx = jsonStr.indexOf('{');
        const lastIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
          jsonStr = jsonStr.substring(startIdx, lastIdx + 1);
        }
      }
      
      const analysis = JSON.parse(jsonStr);
      
      // Validate the response structure
      if (!analysis.relevantUSPs || !analysis.personalizationOpportunities || !analysis.recommendedTone) {
        throw new Error('Invalid analysis response structure');
      }

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze prospect content:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: response ? response.substring(0, 200) + '...' : 'No response',
        extractedJson: jsonStr ? jsonStr.substring(0, 200) + '...' : 'No JSON extracted'
      });
      
      // Return a fallback analysis instead of throwing
      const industry = prospectData.industry?.toLowerCase() || '';
      
      if (industry.includes('photography')) {
        return {
          relevantUSPs: ['High-quality professional print services with quality guarantee', 'Reliable print partner with excellent customer support'],
          personalizationOpportunities: ['Photography studios need reliable print partners who understand their quality standards'],
          recommendedTone: 'professional',
          confidence: 0.1,
          businessContext: {
            companySize: 'small',
            growthStage: 'early',
            marketPosition: 'follower',
            industry: prospectData.industry || 'photography'
          },
          painPoints: ['finding consistent print quality for clients', 'managing print turnaround times effectively'],
          opportunitySignals: ['potential for reliable print partnership'],
          recommendedProofPoints: ['professional print quality examples', 'testimonials from other photographers']
        };
      } else {
        return {
          relevantUSPs: ['Operational efficiency for event organizations'],
          personalizationOpportunities: ['Event organizers balance community impact with operational demands'],
          recommendedTone: 'professional',
          confidence: 0.1,
          businessContext: {
            companySize: 'small',
            growthStage: 'early',
            marketPosition: 'follower',
            industry: prospectData.industry || 'event organization'
          },
          painPoints: ['operational efficiency challenges'],
          opportunitySignals: ['potential for operational optimization'],
          recommendedProofPoints: ['event organization case studies']
        };
      }
    }
  }

  public async generatePersonalizedEmail(
    prospectData: any,
    campaignData: any,
    analysis: any,
    marketingDocument: string,
    psychologicalTriggers: any[] = [],
    generatedSubject?: string,
    conversationStyle?: any
  ): Promise<{
    subject: string;
    htmlBody: string;
    textBody: string;
    personalizations: string[];
  }> {
    const emailStyle = campaignData.emailStyle || 'statement';
    const isQuestionStyle = emailStyle === 'question';

    // Use the generated subject line or create a fallback
    const subject = generatedSubject || `${prospectData.companyName || 'Business'} collaboration opportunity`;

    const styleGuide = conversationStyle ? `
CONVERSATION STYLE: ${conversationStyle.name}
- Approach: ${conversationStyle.approach}
- ${conversationStyle.toneAdjustment}
- Description: ${conversationStyle.description}
` : '';

    const prompt = `Write a natural, conversational business email to ${prospectData.companyName || 'this professional'}.

THEIR BUSINESS:
- Company: ${prospectData.companyName || 'this business'}
- Contact: ${prospectData.contactName || 'there'} 
- Focus: ${prospectData.scrapedData?.title || 'Professional service provider'}
- Services: ${prospectData.scrapedData?.services?.slice(0, 3).join(', ') || 'professional services'}
- Industry: ${analysis.businessContext?.industry || 'professional services'}
- Stage: ${analysis.businessContext?.growthStage || 'growing business'}

ABOUT YOUR COMPANY:
${marketingDocument.substring(0, 600)}
${styleGuide}
CONVERSATION APPROACH:
Write this email like a genuine business professional reaching out naturally. Use the conversation style above to guide your approach. You've done some light research on their business and want to start a real conversation.

TONE AND STYLE:
- Sound like a real person having a business conversation
- Be natural and authentic in your approach
- Mention something specific about their business that genuinely caught your attention
- Focus on starting a conversation, not making a sale
- Use everyday business language with natural imperfections
- Be respectful and professional but not stiff

EMAIL STRUCTURE (natural flow):
1. Natural greeting that shows you've looked at their business
2. Brief, genuine reason for reaching out
3. Simple question or conversation starter
4. Easy, no-pressure closing

MAKE IT HUMAN:
- Use natural contractions (don't, can't, I've, etc.)
- Vary sentence length naturally
- Sound genuinely interested, not scripted
- Include subtle human touches like "I noticed" or "I was curious"
- Avoid perfect, marketing-polished language

SUBJECT LINE: Use "${subject}" exactly as provided.

Keep it around 100-150 words, naturally spaced, focused on genuine professional interest.

Return JSON with exactly this structure:
{
  "subject": "${subject}",
  "htmlBody": "<p>Natural greeting</p><p>Context paragraph</p><p>Question/conversation starter</p><p>Simple closing</p>",
  "textBody": "Natural greeting\\n\\nContext paragraph\\n\\nQuestion/conversation starter\\n\\nSimple closing\\n\\nBest regards,\\n[Name]",
  "personalizations": ["List what made this email personal to their specific business"]
}`;

    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const systemPrompt = 'You are a genuine business professional who writes natural, conversational emails. You understand different industries and can speak authentically about business challenges. You write emails that sound like real person-to-person communication, not marketing copy. You focus on starting genuine business conversations rather than making sales pitches. For photographers, you understand their creative process and quality standards. For event organizers, you appreciate their coordination challenges. Keep it human, keep it real. Always respond with valid JSON format when requested.';

    try {
      const response = await this.createMessage(messages, {
        systemPrompt,
        temperature: 0.6, // Balanced creativity with professional tone
      });

      let jsonStr = response.trim();
      
      // Try to find JSON block if response includes markdown or extra text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // Look for JSON object boundaries
        const startIdx = jsonStr.indexOf('{');
        const lastIdx = jsonStr.lastIndexOf('}');
        if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
          jsonStr = jsonStr.substring(startIdx, lastIdx + 1);
        }
      }

      // Remove any bad control characters that might cause JSON parsing errors
      jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

      const emailData = JSON.parse(jsonStr);

      // Validate the response structure
      if (!emailData.subject || !emailData.htmlBody || !emailData.textBody || !emailData.personalizations) {
        throw new Error('Invalid email response structure');
      }

      // Add natural human imperfections to make it more authentic
      if (conversationStyle) {
        const { ConversationStyleService } = await import('@/services/ai/ConversationStyleService');
        const styleService = ConversationStyleService.getInstance();
        
        emailData.textBody = styleService.addHumanImperfections(emailData.textBody);
        // Don't modify HTML body as much to preserve formatting
      }

      return emailData;
    } catch (error) {
      logger.error('Failed to generate personalized email:', error);
      throw error;
    }
  }

  public async extractMarketingUSPs(marketingDocument: string): Promise<string[]> {
    const prompt = `
Analyze the following marketing document and extract the key unique selling points (USPs) and value propositions.

MARKETING DOCUMENT:
${marketingDocument}

Please provide a JSON response with this structure:
{
  "usps": ["Array of 8-10 clear, specific unique selling points extracted from the document"]
}

Focus on:
1. Concrete benefits and outcomes
2. Differentiators from competitors
3. Specific capabilities or features
4. Proven results or achievements
5. Unique methodologies or approaches
`;

    const messages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const systemPrompt = 'You are a marketing strategist expert at identifying and articulating unique selling points from marketing materials. Extract clear, compelling USPs that can be used in sales outreach. Always respond with valid JSON format when requested.';

    try {
      const response = await this.createMessage(messages, {
        systemPrompt,
        temperature: 0.2, // Very low temperature for consistent extraction
      });

      const result = JSON.parse(response);
      return result.usps || [];
    } catch (error) {
      logger.error('Failed to extract marketing USPs:', error);
      throw error;
    }
  }
}