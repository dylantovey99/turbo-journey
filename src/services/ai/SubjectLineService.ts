import { ClaudeClient } from './ClaudeClient';
import { logger } from '@/utils/logger';

export interface SubjectLineVariation {
  text: string;
  style: 'curiosity' | 'benefit' | 'question' | 'personalized' | 'social-proof';
  industry: string;
  openRate?: number;
  responseRate?: number;
  usageCount: number;
  lastUsed?: Date;
}

export interface SubjectLineAnalysis {
  spamScore: number;
  mobileOptimized: boolean;
  characterCount: number;
  wordCount: number;
  hasPersonalization: boolean;
  psychologicalTriggers: string[];
  industry: string;
  expectedPerformance: 'low' | 'medium' | 'high';
}

export class SubjectLineService {
  private static instance: SubjectLineService;
  private claudeClient: ClaudeClient;
  private performanceData: Map<string, SubjectLineVariation> = new Map();

  private constructor() {
    this.claudeClient = ClaudeClient.getInstance();
  }

  public static getInstance(): SubjectLineService {
    if (!SubjectLineService.instance) {
      SubjectLineService.instance = new SubjectLineService();
    }
    return SubjectLineService.instance;
  }

  /**
   * Generate optimized subject line variations for A/B testing
   */
  public async generateSubjectLineVariations(
    prospectData: any,
    analysis: any,
    campaignData: any,
    count: number = 5
  ): Promise<SubjectLineVariation[]> {
    const industry = analysis.businessContext?.industry || 'creative services';
    const companyName = prospectData.companyName || 'your business';
    const painPoint = analysis.painPoints?.[0] || 'workflow optimization';
    const growthStage = analysis.businessContext?.growthStage || 'scaling';

    const styles: SubjectLineVariation['style'][] = ['curiosity', 'benefit', 'question', 'personalized', 'social-proof'];
    const variations: SubjectLineVariation[] = [];

    for (const style of styles) {
      if (variations.length >= count) break;

      const template = this.getTemplateForStyle(style, industry, companyName, painPoint, growthStage);
      const subjectLine = await this.generateFromTemplate(template, style, prospectData, analysis);
      
      const variation: SubjectLineVariation = {
        text: subjectLine,
        style,
        industry,
        usageCount: 0
      };

      variations.push(variation);
    }

    return variations;
  }

  /**
   * Select the best performing subject line based on historical data and analysis
   */
  public async selectOptimalSubjectLine(variations: SubjectLineVariation[]): Promise<SubjectLineVariation> {
    // Analyze each variation for optimization factors
    const analyzedVariations = await Promise.all(
      variations.map(async (variation) => ({
        ...variation,
        analysis: await this.analyzeSubjectLine(variation.text, variation.industry)
      }))
    );

    // Score based on historical performance + predicted performance
    const scoredVariations = analyzedVariations.map(variation => ({
      ...variation,
      score: this.calculateSubjectLineScore(variation)
    }));

    // Sort by score and return the best
    scoredVariations.sort((a, b) => b.score - a.score);
    return scoredVariations[0];
  }

  /**
   * Analyze subject line for optimization factors
   */
  public async analyzeSubjectLine(subjectLine: string, industry: string): Promise<SubjectLineAnalysis> {
    const characterCount = subjectLine.length;
    const wordCount = subjectLine.split(/\s+/).length;
    
    // Spam score calculation (higher = more likely to be flagged)
    const spamTriggers = ['free', 'amazing', '!!!', '$$$', 'urgent', 'act now', 'limited time'];
    const spamScore = spamTriggers.reduce((score, trigger) => 
      subjectLine.toLowerCase().includes(trigger) ? score + 0.2 : score, 0
    );

    // Mobile optimization (ideal: 30-40 characters)
    const mobileOptimized = characterCount <= 40;

    // Check for personalization elements
    const hasPersonalization = /\b[A-Z][a-z]+\b/.test(subjectLine) && 
      (subjectLine.includes('your') || subjectLine.includes('Your'));

    // Detect psychological triggers
    const psychologicalTriggers = [];
    if (subjectLine.includes('?')) psychologicalTriggers.push('curiosity');
    if (/\b(save|increase|improve|boost)\b/i.test(subjectLine)) psychologicalTriggers.push('benefit');
    if (/\b(other|most|peers)\b/i.test(subjectLine)) psychologicalTriggers.push('social-proof');
    if (/\b(quick|fast|efficient)\b/i.test(subjectLine)) psychologicalTriggers.push('urgency');

    // Expected performance based on optimization factors
    let performanceScore = 0;
    if (mobileOptimized) performanceScore += 1;
    if (spamScore < 0.3) performanceScore += 1;
    if (hasPersonalization) performanceScore += 1;
    if (psychologicalTriggers.length > 0) performanceScore += 1;
    if (wordCount >= 4 && wordCount <= 8) performanceScore += 1;

    const expectedPerformance: SubjectLineAnalysis['expectedPerformance'] = 
      performanceScore >= 4 ? 'high' : performanceScore >= 2 ? 'medium' : 'low';

    return {
      spamScore,
      mobileOptimized,
      characterCount,
      wordCount,
      hasPersonalization,
      psychologicalTriggers,
      industry,
      expectedPerformance
    };
  }

  /**
   * Record performance data for subject line optimization
   */
  public recordPerformance(
    subjectLine: string,
    openRate: number,
    responseRate: number,
    style: SubjectLineVariation['style'],
    industry: string
  ): void {
    const key = `${subjectLine}-${industry}`;
    const existing = this.performanceData.get(key);

    const variation: SubjectLineVariation = {
      text: subjectLine,
      style,
      industry,
      openRate,
      responseRate,
      usageCount: (existing?.usageCount || 0) + 1,
      lastUsed: new Date()
    };

    this.performanceData.set(key, variation);
    logger.info('Subject line performance recorded', { subjectLine, openRate, responseRate });
  }

  /**
   * Get performance insights for optimization
   */
  public getPerformanceInsights(industry?: string): {
    topPerformers: SubjectLineVariation[];
    stylePerformance: Record<string, { avgOpenRate: number; avgResponseRate: number; count: number }>;
    recommendations: string[];
  } {
    const variations = Array.from(this.performanceData.values())
      .filter(v => !industry || v.industry === industry)
      .filter(v => v.openRate !== undefined && v.responseRate !== undefined);

    // Top performers by response rate
    const topPerformers = variations
      .sort((a, b) => (b.responseRate || 0) - (a.responseRate || 0))
      .slice(0, 10);

    // Style performance analysis
    const styleStats = variations.reduce((acc, v) => {
      if (!acc[v.style]) {
        acc[v.style] = { totalOpen: 0, totalResponse: 0, count: 0 };
      }
      acc[v.style].totalOpen += v.openRate || 0;
      acc[v.style].totalResponse += v.responseRate || 0;
      acc[v.style].count += 1;
      return acc;
    }, {} as Record<string, { totalOpen: number; totalResponse: number; count: number }>);

    const stylePerformance = Object.entries(styleStats).reduce((acc, [style, stats]) => {
      acc[style] = {
        avgOpenRate: stats.totalOpen / stats.count,
        avgResponseRate: stats.totalResponse / stats.count,
        count: stats.count
      };
      return acc;
    }, {} as Record<string, { avgOpenRate: number; avgResponseRate: number; count: number }>);

    // Generate recommendations
    const recommendations = this.generateRecommendations(stylePerformance, variations);

    return {
      topPerformers,
      stylePerformance,
      recommendations
    };
  }

  private getTemplateForStyle(
    style: SubjectLineVariation['style'],
    industry: string,
    companyName: string,
    painPoint: string,
    growthStage: string
  ): string {
    const industryContext = this.getIndustryContext(industry);
    
    switch (style) {
      case 'curiosity':
        return `Your ${industryContext.processName} approach`;
      
      case 'benefit':
        return `${industryContext.benefitWord} your ${industryContext.processName}`;
      
      case 'question':
        return `${companyName} ${industryContext.processName} question`;
      
      case 'personalized':
        return `${companyName} ${industryContext.specificChallenge}`;
      
      case 'social-proof':
        return `${industryContext.peerReference} ${industryContext.successMetric}`;
      
      default:
        return `${companyName} optimization insight`;
    }
  }

  private getIndustryContext(industry: string) {
    if (industry.includes('photography') || industry.includes('photographer')) {
      return {
        processName: 'workflow',
        benefitWord: 'Streamline',
        specificChallenge: 'client delivery',
        peerReference: 'Photographers',
        successMetric: 'saving 5+ hours weekly'
      };
    }

    if (industry.includes('festival') || industry.includes('event')) {
      return {
        processName: 'coordination',
        benefitWord: 'Simplify',
        specificChallenge: 'vendor management',
        peerReference: 'Festival organizers',
        successMetric: 'reducing planning stress'
      };
    }

    if (industry.includes('market')) {
      return {
        processName: 'operations',
        benefitWord: 'Optimize',
        specificChallenge: 'vendor onboarding',
        peerReference: 'Market coordinators',
        successMetric: 'improving efficiency'
      };
    }

    return {
      processName: 'operations',
      benefitWord: 'Improve',
      specificChallenge: 'workflow',
      peerReference: 'Professionals',
      successMetric: 'increasing efficiency'
    };
  }

  private async generateFromTemplate(
    template: string,
    style: SubjectLineVariation['style'],
    prospectData: any,
    analysis: any
  ): Promise<string> {
    const prompt = `
Generate a compelling ${style} subject line based on this template: "${template}"

Context:
- Company: ${prospectData.companyName || 'creative professional'}
- Industry: ${analysis.businessContext?.industry || 'creative services'}
- Pain Point: ${analysis.painPoints?.[0] || 'operational efficiency'}
- Growth Stage: ${analysis.businessContext?.growthStage || 'scaling'}

Requirements:
- 6-8 words maximum
- Mobile-optimized (under 40 characters)
- Avoid spam triggers
- Industry-appropriate tone
- Create curiosity without being clickbait

Return just the subject line text, no quotes.`;

    try {
      const response = await this.claudeClient.createMessage([
        { role: 'user', content: prompt }
      ], {
        temperature: 0.4,
        maxTokens: 30
      });

      return response.trim().replace(/['"]/g, '');
    } catch (error) {
      logger.error('Failed to generate subject line from template:', error);
      return template; // Fallback to template
    }
  }

  private calculateSubjectLineScore(variation: SubjectLineVariation & { analysis: SubjectLineAnalysis }): number {
    let score = 0;

    // Historical performance (if available)
    if (variation.responseRate !== undefined) {
      score += variation.responseRate * 100; // 0-100 points based on response rate
    }

    if (variation.openRate !== undefined) {
      score += variation.openRate * 50; // 0-50 points based on open rate
    }

    // Predicted performance factors
    switch (variation.analysis.expectedPerformance) {
      case 'high': score += 30; break;
      case 'medium': score += 20; break;
      case 'low': score += 10; break;
    }

    // Optimization factors
    if (variation.analysis.mobileOptimized) score += 10;
    if (variation.analysis.spamScore < 0.3) score += 15;
    if (variation.analysis.hasPersonalization) score += 10;
    score += variation.analysis.psychologicalTriggers.length * 5;

    // Freshness bonus (prefer less-used variations for testing)
    if (variation.usageCount < 5) score += 5;

    return score;
  }

  private generateRecommendations(
    stylePerformance: Record<string, { avgOpenRate: number; avgResponseRate: number; count: number }>,
    variations: SubjectLineVariation[]
  ): string[] {
    const recommendations: string[] = [];

    // Find best performing style
    const bestStyle = Object.entries(stylePerformance)
      .sort((a, b) => b[1].avgResponseRate - a[1].avgResponseRate)[0];

    if (bestStyle) {
      recommendations.push(`${bestStyle[0]} style shows highest response rate (${(bestStyle[1].avgResponseRate * 100).toFixed(1)}%)`);
    }

    // Check for underperformers
    const lowPerformers = Object.entries(stylePerformance)
      .filter(([, stats]) => stats.avgResponseRate < 0.02)
      .map(([style]) => style);

    if (lowPerformers.length > 0) {
      recommendations.push(`Consider reducing usage of: ${lowPerformers.join(', ')}`);
    }

    // Sample size recommendations
    const lowSampleStyles = Object.entries(stylePerformance)
      .filter(([, stats]) => stats.count < 10)
      .map(([style]) => style);

    if (lowSampleStyles.length > 0) {
      recommendations.push(`Need more data for: ${lowSampleStyles.join(', ')}`);
    }

    return recommendations;
  }
}