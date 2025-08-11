import { ClaudeClient } from './ClaudeClient';
import { EmailJobModel } from '@/models';
import { logger } from '@/utils/logger';

export interface ResponseInsight {
  prospectType: string;
  emailStyle: string;
  responseType: ResponseType;
  responseQuality: number; // 0-1 score
  keyTriggers: string[];
  improvementSuggestions: string[];
  timestamp: Date;
}

export enum ResponseType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative', 
  NEUTRAL = 'neutral',
  MEETING_REQUEST = 'meeting_request',
  OBJECTION = 'objection',
  REFERRAL = 'referral',
  OUT_OF_OFFICE = 'out_of_office',
  UNSUBSCRIBE = 'unsubscribe'
}

export interface ResponseAnalysis {
  type: ResponseType;
  sentiment: number; // -1 to 1
  quality: number; // 0 to 1
  engagement: number; // 0 to 1
  keywords: string[];
  intent: string;
  followUpSuggestion?: string;
}

export interface LearningModel {
  prospectType: string;
  successfulStyles: Array<{
    style: string;
    successRate: number;
    avgResponseQuality: number;
    sampleSize: number;
  }>;
  effectiveContent: Array<{
    element: string;
    impact: number;
    examples: string[];
  }>;
  commonObjections: Array<{
    objection: string;
    frequency: number;
    effectiveResponses: string[];
  }>;
  lastUpdated: Date;
}

export class EmailResponseAnalyzer {
  private claudeClient: ClaudeClient;
  private static instance: EmailResponseAnalyzer;
  private learningModels: Map<string, LearningModel> = new Map();

  private constructor() {
    this.claudeClient = ClaudeClient.getInstance();
    this.loadLearningModels();
  }

  public static getInstance(): EmailResponseAnalyzer {
    if (!EmailResponseAnalyzer.instance) {
      EmailResponseAnalyzer.instance = new EmailResponseAnalyzer();
    }
    return EmailResponseAnalyzer.instance;
  }

  /**
   * Analyze a prospect's response to understand quality and extract insights
   */
  public async analyzeResponse(
    emailJobId: string,
    responseText: string,
    responseMetadata: {
      timestamp: Date;
      fromEmail: string;
      subject: string;
    }
  ): Promise<ResponseAnalysis> {
    try {
      logger.info(`Analyzing response for email job: ${emailJobId}`);

      const emailJob = await EmailJobModel.findById(emailJobId)
        .populate('prospectId')
        .populate('campaignId');

      if (!emailJob || !emailJob.generatedEmail) {
        throw new Error(`Email job not found or no generated email: ${emailJobId}`);
      }

      const prospect = emailJob.prospectId as any;
      const originalEmail = emailJob.generatedEmail;

      const prompt = `Analyze this prospect's response to our business outreach email.

ORIGINAL EMAIL CONTEXT:
- Subject: "${originalEmail.subject}"
- Industry: ${prospect.industry || 'business'}
- Company: ${prospect.companyName || 'prospect'}
- Our email style: Professional business outreach

PROSPECT'S RESPONSE:
"${responseText}"

RESPONSE METADATA:
- Timestamp: ${responseMetadata.timestamp.toISOString()}
- Subject: ${responseMetadata.subject}

Analyze this response and provide detailed insights in JSON format:

{
  "type": "positive|negative|neutral|meeting_request|objection|referral|out_of_office|unsubscribe",
  "sentiment": 0.7,
  "quality": 0.8,
  "engagement": 0.9,
  "keywords": ["interested", "schedule", "meeting"],
  "intent": "Clear description of prospect's intent",
  "followUpSuggestion": "Specific next step recommendation"
}

ANALYSIS GUIDELINES:
- Sentiment: -1 (very negative) to 1 (very positive)
- Quality: 0 (poor/spam) to 1 (thoughtful, detailed response)  
- Engagement: 0 (disinterested) to 1 (highly engaged, wants to move forward)
- Keywords: Key words/phrases that indicate prospect's state of mind
- Intent: What the prospect actually wants or is thinking
- FollowUpSuggestion: Best next action based on this response

Focus on business professional context - this is B2B outreach to creative professionals.`;

      const response = await this.claudeClient.createMessage([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,
        maxTokens: 500,
        systemPrompt: 'You are an expert at analyzing business email responses to understand prospect intent and engagement quality. Always respond with valid JSON.'
      });

      let analysis: ResponseAnalysis;
      try {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = JSON.parse(response);
        }
      } catch (parseError) {
        logger.warn(`Failed to parse response analysis JSON, using fallback`, {
          emailJobId,
          response: response.substring(0, 200)
        });
        
        // Fallback analysis based on simple text analysis
        analysis = this.createFallbackAnalysis(responseText);
      }

      // Store the response analysis in the email job
      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        'response.analysis': analysis,
        'response.text': responseText,
        'response.metadata': responseMetadata,
        'response.analyzedAt': new Date()
      });

      logger.info(`Response analysis completed`, {
        emailJobId,
        type: analysis.type,
        sentiment: analysis.sentiment,
        quality: analysis.quality,
        engagement: analysis.engagement
      });

      // Extract insights for learning
      await this.extractAndStoreInsights(emailJobId, analysis, prospect, originalEmail);

      return analysis;

    } catch (error) {
      logger.error(`Failed to analyze response for job: ${emailJobId}`, error);
      throw error;
    }
  }

  /**
   * Extract learning insights from response analysis
   */
  private async extractAndStoreInsights(
    emailJobId: string,
    analysis: ResponseAnalysis,
    prospect: any,
    originalEmail: any
  ): Promise<void> {
    try {
      const prospectType = this.determineProspectType(prospect);
      const emailStyle = this.determineEmailStyle(originalEmail);

      const insight: ResponseInsight = {
        prospectType,
        emailStyle,
        responseType: analysis.type,
        responseQuality: analysis.quality,
        keyTriggers: analysis.keywords,
        improvementSuggestions: [],
        timestamp: new Date()
      };

      // Generate improvement suggestions based on response
      if (analysis.type === ResponseType.NEGATIVE || analysis.type === ResponseType.OBJECTION) {
        insight.improvementSuggestions = await this.generateImprovementSuggestions(
          analysis,
          prospectType,
          emailStyle
        );
      }

      // Update learning model
      await this.updateLearningModel(prospectType, insight);

      logger.info(`Insights extracted and stored`, {
        emailJobId,
        prospectType,
        emailStyle,
        responseType: analysis.type,
        quality: analysis.quality
      });

    } catch (error) {
      logger.error(`Failed to extract insights for job: ${emailJobId}`, error);
    }
  }

  /**
   * Update the learning model with new insights
   */
  private async updateLearningModel(prospectType: string, insight: ResponseInsight): Promise<void> {
    let model = this.learningModels.get(prospectType) || {
      prospectType,
      successfulStyles: [],
      effectiveContent: [],
      commonObjections: [],
      lastUpdated: new Date()
    };

    // Update successful styles
    const styleIndex = model.successfulStyles.findIndex(s => s.style === insight.emailStyle);
    if (styleIndex >= 0) {
      const style = model.successfulStyles[styleIndex];
      const newSampleSize = style.sampleSize + 1;
      const isSuccess = insight.responseQuality > 0.7;
      const newSuccessCount = isSuccess ? 
        Math.round(style.successRate * style.sampleSize) + 1 :
        Math.round(style.successRate * style.sampleSize);
      
      style.successRate = newSuccessCount / newSampleSize;
      style.avgResponseQuality = ((style.avgResponseQuality * style.sampleSize) + insight.responseQuality) / newSampleSize;
      style.sampleSize = newSampleSize;
    } else {
      model.successfulStyles.push({
        style: insight.emailStyle,
        successRate: insight.responseQuality > 0.7 ? 1 : 0,
        avgResponseQuality: insight.responseQuality,
        sampleSize: 1
      });
    }

    // Track common objections
    if (insight.responseType === ResponseType.OBJECTION) {
      // In a full implementation, we would extract the specific objection
      // For now, we'll track general objection patterns
    }

    model.lastUpdated = new Date();
    this.learningModels.set(prospectType, model);

    // Persist to database (in a full implementation)
    // await this.saveLearningModel(model);
  }

  /**
   * Get insights for improving email generation
   */
  public getInsightsForProspectType(prospectType: string): {
    recommendedStyles: Array<{ style: string; successRate: number; confidence: number }>;
    contentRecommendations: string[];
    commonChallenges: string[];
  } {
    const model = this.learningModels.get(prospectType);
    
    if (!model || model.successfulStyles.length === 0) {
      return {
        recommendedStyles: [],
        contentRecommendations: [
          'Focus on genuine business conversation',
          'Mention specific services or specializations',
          'Ask thoughtful questions about their work'
        ],
        commonChallenges: []
      };
    }

    // Sort styles by success rate
    const recommendedStyles = model.successfulStyles
      .filter(style => style.sampleSize >= 3) // Only include styles with enough data
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3)
      .map(style => ({
        style: style.style,
        successRate: style.successRate,
        confidence: Math.min(style.sampleSize / 10, 1) // Confidence based on sample size
      }));

    const contentRecommendations = model.effectiveContent
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5)
      .map(content => content.element);

    const commonChallenges = model.commonObjections
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3)
      .map(objection => objection.objection);

    return {
      recommendedStyles,
      contentRecommendations,
      commonChallenges
    };
  }

  /**
   * Process Missive webhook for response monitoring
   */
  public async processMissiveWebhook(webhookData: any): Promise<void> {
    try {
      // Extract relevant data from Missive webhook
      const { conversation, message } = webhookData;
      
      if (!message || !conversation) {
        return;
      }

      // Check if this is a response to one of our generated emails
      const emailJob = await this.findEmailJobByMissiveData(conversation, message);
      
      if (emailJob) {
        await this.analyzeResponse(
          emailJob._id.toString(),
          message.body || message.preview,
          {
            timestamp: new Date(message.created_at),
            fromEmail: message.from,
            subject: conversation.subject
          }
        );
      }

    } catch (error) {
      logger.error('Failed to process Missive webhook', error);
    }
  }

  /**
   * Helper methods
   */
  private determineProspectType(prospect: any): string {
    const industry = prospect.industry?.toLowerCase() || '';
    const services = prospect.scrapedData?.services || [];
    
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

  private determineEmailStyle(originalEmail: any): string {
    const subject = originalEmail.subject?.toLowerCase() || '';
    const body = originalEmail.textBody?.toLowerCase() || '';
    
    if (subject.includes('?') || body.includes('curious') || body.includes('question')) {
      return 'curiosity';
    } else if (body.includes('help') || body.includes('solution') || body.includes('improve')) {
      return 'helpful';
    } else if (body.includes('colleagues') || body.includes('other') || body.includes('peers')) {
      return 'social_proof';
    } else if (originalEmail.personalizations?.length > 5) {
      return 'personalized';
    } else {
      return 'professional';
    }
  }

  private createFallbackAnalysis(responseText: string): ResponseAnalysis {
    const lowerText = responseText.toLowerCase();
    
    // Simple keyword-based analysis for fallback
    if (lowerText.includes('meeting') || lowerText.includes('call') || lowerText.includes('schedule')) {
      return {
        type: ResponseType.MEETING_REQUEST,
        sentiment: 0.8,
        quality: 0.9,
        engagement: 0.9,
        keywords: ['meeting', 'schedule'],
        intent: 'Wants to schedule a meeting'
      };
    } else if (lowerText.includes('interested') || lowerText.includes('yes') || lowerText.includes('sounds good')) {
      return {
        type: ResponseType.POSITIVE,
        sentiment: 0.7,
        quality: 0.7,
        engagement: 0.8,
        keywords: ['interested'],
        intent: 'Shows interest'
      };
    } else if (lowerText.includes('not interested') || lowerText.includes('no thank') || lowerText.includes('unsubscribe')) {
      return {
        type: ResponseType.NEGATIVE,
        sentiment: -0.5,
        quality: 0.5,
        engagement: 0.1,
        keywords: ['not interested'],
        intent: 'Not interested'
      };
    } else {
      return {
        type: ResponseType.NEUTRAL,
        sentiment: 0,
        quality: 0.5,
        engagement: 0.5,
        keywords: [],
        intent: 'Neutral response'
      };
    }
  }

  private async generateImprovementSuggestions(
    analysis: ResponseAnalysis,
    prospectType: string,
    emailStyle: string
  ): Promise<string[]> {
    // Simple rule-based suggestions for now
    const suggestions: string[] = [];
    
    if (analysis.engagement < 0.3) {
      suggestions.push('Consider more engaging subject line');
      suggestions.push('Add more personalized content about their specific business');
    }
    
    if (analysis.sentiment < 0) {
      suggestions.push('Soften the approach - may be too sales-focused');
      suggestions.push('Focus more on genuine curiosity about their work');
    }
    
    return suggestions;
  }

  private async findEmailJobByMissiveData(conversation: any, message: any): Promise<any> {
    // In a full implementation, we would match based on:
    // - Conversation participants
    // - Original message threading
    // - Timestamp correlation
    // For now, return null as this requires actual Missive integration
    return null;
  }

  private async loadLearningModels(): Promise<void> {
    // In a full implementation, load from database
    // For now, initialize empty
  }

  private async saveLearningModel(model: LearningModel): Promise<void> {
    // In a full implementation, persist to database
    // For now, just keep in memory
  }
}