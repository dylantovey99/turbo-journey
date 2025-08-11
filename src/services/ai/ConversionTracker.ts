import { logger } from '@/utils/logger';

export interface ConversionMetrics {
  emailId: string;
  prospectId: string;
  campaignId: string;
  
  // Email performance
  sent: boolean;
  sentAt?: Date;
  opened: boolean;
  openedAt?: Date;
  clicked: boolean;
  clickedAt?: Date;
  replied: boolean;
  repliedAt?: Date;
  
  // Email characteristics
  subjectLine: string;
  subjectLineStyle: 'curiosity' | 'benefit' | 'question' | 'personalized' | 'social-proof';
  emailLength: number;
  psychologicalTriggers: string[];
  personalizationElements: string[];
  
  // Context data
  industry: string;
  businessStage: string;
  professionalLevel: string;
  sendTime: Date;
  dayOfWeek: number;
  hourOfDay: number;
}

export interface ConversionInsights {
  overallPerformance: {
    totalSent: number;
    openRate: number;
    clickRate: number;
    responseRate: number;
  };
  
  byIndustry: Record<string, {
    openRate: number;
    responseRate: number;
    count: number;
  }>;
  
  bySubjectLineStyle: Record<string, {
    openRate: number;
    responseRate: number;
    count: number;
  }>;
  
  byPsychologicalTrigger: Record<string, {
    effectivenessScore: number;
    responseRate: number;
    count: number;
  }>;
  
  byTiming: {
    bestDayOfWeek: number;
    bestHourOfDay: number;
    timingPerformance: Record<string, number>;
  };
  
  personalizationImpact: {
    highPersonalization: { responseRate: number; count: number };
    mediumPersonalization: { responseRate: number; count: number };
    lowPersonalization: { responseRate: number; count: number };
  };
  
  recommendations: string[];
}

export interface A_BTestResult {
  testId: string;
  testName: string;
  variant_A: {
    name: string;
    metrics: ConversionMetrics[];
    performance: {
      openRate: number;
      responseRate: number;
      count: number;
    };
  };
  variant_B: {
    name: string;
    metrics: ConversionMetrics[];
    performance: {
      openRate: number;
      responseRate: number;
      count: number;
    };
  };
  winner?: 'A' | 'B' | 'tie';
  confidence: number;
  statisticalSignificance: boolean;
  recommendations: string[];
}

export class ConversionTracker {
  private static instance: ConversionTracker;
  private conversionData: Map<string, ConversionMetrics> = new Map();
  private activeABTests: Map<string, A_BTestResult> = new Map();

  private constructor() {}

  public static getInstance(): ConversionTracker {
    if (!ConversionTracker.instance) {
      ConversionTracker.instance = new ConversionTracker();
    }
    return ConversionTracker.instance;
  }

  /**
   * Track email send event
   */
  public trackEmailSent(
    emailId: string,
    prospectId: string,
    campaignId: string,
    emailData: {
      subjectLine: string;
      subjectLineStyle: ConversionMetrics['subjectLineStyle'];
      emailLength: number;
      psychologicalTriggers: string[];
      personalizationElements: string[];
      industry: string;
      businessStage: string;
      professionalLevel: string;
    }
  ): void {
    const now = new Date();
    const metrics: ConversionMetrics = {
      emailId,
      prospectId,
      campaignId,
      sent: true,
      sentAt: now,
      opened: false,
      clicked: false,
      replied: false,
      ...emailData,
      sendTime: now,
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours()
    };

    this.conversionData.set(emailId, metrics);
    logger.info('Email send tracked', { emailId, prospectId, campaignId });
  }

  /**
   * Track email open event
   */
  public trackEmailOpened(emailId: string): void {
    const metrics = this.conversionData.get(emailId);
    if (metrics && !metrics.opened) {
      metrics.opened = true;
      metrics.openedAt = new Date();
      this.conversionData.set(emailId, metrics);
      logger.info('Email open tracked', { emailId });
    }
  }

  /**
   * Track email click event
   */
  public trackEmailClicked(emailId: string): void {
    const metrics = this.conversionData.get(emailId);
    if (metrics && !metrics.clicked) {
      metrics.clicked = true;
      metrics.clickedAt = new Date();
      this.conversionData.set(emailId, metrics);
      logger.info('Email click tracked', { emailId });
    }
  }

  /**
   * Track email reply event
   */
  public trackEmailReplied(emailId: string): void {
    const metrics = this.conversionData.get(emailId);
    if (metrics && !metrics.replied) {
      metrics.replied = true;
      metrics.repliedAt = new Date();
      this.conversionData.set(emailId, metrics);
      logger.info('Email reply tracked', { emailId });
    }
  }

  /**
   * Generate comprehensive conversion insights
   */
  public generateInsights(
    timeRange?: { start: Date; end: Date },
    filters?: {
      industry?: string;
      campaignId?: string;
      professionalLevel?: string;
    }
  ): ConversionInsights {
    let metrics = Array.from(this.conversionData.values());

    // Apply time range filter
    if (timeRange) {
      metrics = metrics.filter(m => 
        m.sentAt && m.sentAt >= timeRange.start && m.sentAt <= timeRange.end
      );
    }

    // Apply other filters
    if (filters?.industry) {
      metrics = metrics.filter(m => m.industry === filters.industry);
    }
    if (filters?.campaignId) {
      metrics = metrics.filter(m => m.campaignId === filters.campaignId);
    }
    if (filters?.professionalLevel) {
      metrics = metrics.filter(m => m.professionalLevel === filters.professionalLevel);
    }

    const insights: ConversionInsights = {
      overallPerformance: this.calculateOverallPerformance(metrics),
      byIndustry: this.calculatePerformanceByIndustry(metrics),
      bySubjectLineStyle: this.calculatePerformanceBySubjectLineStyle(metrics),
      byPsychologicalTrigger: this.calculatePerformanceByPsychologicalTrigger(metrics),
      byTiming: this.calculateTimingPerformance(metrics),
      personalizationImpact: this.calculatePersonalizationImpact(metrics),
      recommendations: this.generateRecommendations(metrics)
    };

    logger.info('Conversion insights generated', {
      metricsCount: metrics.length,
      overallResponseRate: insights.overallPerformance.responseRate
    });

    return insights;
  }

  /**
   * Start an A/B test
   */
  public startABTest(
    testName: string,
    variantA: { name: string; configuration: any },
    variantB: { name: string; configuration: any }
  ): string {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const abTest: A_BTestResult = {
      testId,
      testName,
      variant_A: {
        name: variantA.name,
        metrics: [],
        performance: { openRate: 0, responseRate: 0, count: 0 }
      },
      variant_B: {
        name: variantB.name,
        metrics: [],
        performance: { openRate: 0, responseRate: 0, count: 0 }
      },
      confidence: 0,
      statisticalSignificance: false,
      recommendations: []
    };

    this.activeABTests.set(testId, abTest);
    logger.info('A/B test started', { testId, testName });
    
    return testId;
  }

  /**
   * Assign email to A/B test variant
   */
  public assignToABTest(testId: string, emailId: string, variant: 'A' | 'B'): void {
    const test = this.activeABTests.get(testId);
    const metrics = this.conversionData.get(emailId);

    if (test && metrics) {
      if (variant === 'A') {
        test.variant_A.metrics.push(metrics);
      } else {
        test.variant_B.metrics.push(metrics);
      }
      this.activeABTests.set(testId, test);
    }
  }

  /**
   * Get A/B test results
   */
  public getABTestResults(testId: string): A_BTestResult | null {
    const test = this.activeABTests.get(testId);
    if (!test) return null;

    // Calculate performance for each variant
    test.variant_A.performance = this.calculateVariantPerformance(test.variant_A.metrics);
    test.variant_B.performance = this.calculateVariantPerformance(test.variant_B.metrics);

    // Determine statistical significance and winner
    const significance = this.calculateStatisticalSignificance(
      test.variant_A.performance,
      test.variant_B.performance
    );

    test.statisticalSignificance = significance.significant;
    test.confidence = significance.confidence;

    if (significance.significant) {
      if (test.variant_A.performance.responseRate > test.variant_B.performance.responseRate) {
        test.winner = 'A';
      } else if (test.variant_B.performance.responseRate > test.variant_A.performance.responseRate) {
        test.winner = 'B';
      } else {
        test.winner = 'tie';
      }
    }

    test.recommendations = this.generateABTestRecommendations(test);

    return test;
  }

  /**
   * Get optimization recommendations for a specific campaign
   */
  public getCampaignOptimizationRecommendations(campaignId: string): {
    subjectLineOptimization: string[];
    timingOptimization: string[];
    personalizationOptimization: string[];
    triggerOptimization: string[];
    overallScore: number;
  } {
    const campaignMetrics = Array.from(this.conversionData.values())
      .filter(m => m.campaignId === campaignId);

    if (campaignMetrics.length === 0) {
      return {
        subjectLineOptimization: ['Insufficient data for recommendations'],
        timingOptimization: ['Insufficient data for recommendations'],
        personalizationOptimization: ['Insufficient data for recommendations'],
        triggerOptimization: ['Insufficient data for recommendations'],
        overallScore: 0
      };
    }

    const currentPerformance = this.calculateOverallPerformance(campaignMetrics);
    const allMetrics = Array.from(this.conversionData.values());
    const benchmarkPerformance = this.calculateOverallPerformance(allMetrics);

    const recommendations = {
      subjectLineOptimization: this.getSubjectLineRecommendations(campaignMetrics, allMetrics),
      timingOptimization: this.getTimingRecommendations(campaignMetrics, allMetrics),
      personalizationOptimization: this.getPersonalizationRecommendations(campaignMetrics, allMetrics),
      triggerOptimization: this.getTriggerRecommendations(campaignMetrics, allMetrics),
      overallScore: Math.round((currentPerformance.responseRate / benchmarkPerformance.responseRate) * 100)
    };

    return recommendations;
  }

  // Private helper methods
  private calculateOverallPerformance(metrics: ConversionMetrics[]): ConversionInsights['overallPerformance'] {
    const totalSent = metrics.length;
    const opened = metrics.filter(m => m.opened).length;
    const clicked = metrics.filter(m => m.clicked).length;
    const replied = metrics.filter(m => m.replied).length;

    return {
      totalSent,
      openRate: totalSent > 0 ? opened / totalSent : 0,
      clickRate: totalSent > 0 ? clicked / totalSent : 0,
      responseRate: totalSent > 0 ? replied / totalSent : 0
    };
  }

  private calculatePerformanceByIndustry(metrics: ConversionMetrics[]): ConversionInsights['byIndustry'] {
    const industryGroups = this.groupBy(metrics, 'industry');
    const result: ConversionInsights['byIndustry'] = {};

    for (const [industry, industryMetrics] of Object.entries(industryGroups)) {
      const performance = this.calculateOverallPerformance(industryMetrics);
      result[industry] = {
        openRate: performance.openRate,
        responseRate: performance.responseRate,
        count: industryMetrics.length
      };
    }

    return result;
  }

  private calculatePerformanceBySubjectLineStyle(metrics: ConversionMetrics[]): ConversionInsights['bySubjectLineStyle'] {
    const styleGroups = this.groupBy(metrics, 'subjectLineStyle');
    const result: ConversionInsights['bySubjectLineStyle'] = {};

    for (const [style, styleMetrics] of Object.entries(styleGroups)) {
      const performance = this.calculateOverallPerformance(styleMetrics);
      result[style] = {
        openRate: performance.openRate,
        responseRate: performance.responseRate,
        count: styleMetrics.length
      };
    }

    return result;
  }

  private calculatePerformanceByPsychologicalTrigger(metrics: ConversionMetrics[]): ConversionInsights['byPsychologicalTrigger'] {
    const result: ConversionInsights['byPsychologicalTrigger'] = {};

    // Create a map of trigger usage
    const triggerMetrics: Record<string, ConversionMetrics[]> = {};

    metrics.forEach(metric => {
      metric.psychologicalTriggers.forEach(trigger => {
        if (!triggerMetrics[trigger]) {
          triggerMetrics[trigger] = [];
        }
        triggerMetrics[trigger].push(metric);
      });
    });

    for (const [trigger, triggerMetricsList] of Object.entries(triggerMetrics)) {
      const performance = this.calculateOverallPerformance(triggerMetricsList);
      result[trigger] = {
        effectivenessScore: Math.round(performance.responseRate * 100),
        responseRate: performance.responseRate,
        count: triggerMetricsList.length
      };
    }

    return result;
  }

  private calculateTimingPerformance(metrics: ConversionMetrics[]): ConversionInsights['byTiming'] {
    const dayPerformance: Record<number, { replied: number; total: number }> = {};
    const hourPerformance: Record<number, { replied: number; total: number }> = {};

    metrics.forEach(metric => {
      // Day of week performance
      if (!dayPerformance[metric.dayOfWeek]) {
        dayPerformance[metric.dayOfWeek] = { replied: 0, total: 0 };
      }
      dayPerformance[metric.dayOfWeek].total++;
      if (metric.replied) {
        dayPerformance[metric.dayOfWeek].replied++;
      }

      // Hour of day performance
      if (!hourPerformance[metric.hourOfDay]) {
        hourPerformance[metric.hourOfDay] = { replied: 0, total: 0 };
      }
      hourPerformance[metric.hourOfDay].total++;
      if (metric.replied) {
        hourPerformance[metric.hourOfDay].replied++;
      }
    });

    // Find best performing times
    let bestDay = 0;
    let bestHour = 0;
    let bestDayRate = 0;
    let bestHourRate = 0;

    for (const [day, performance] of Object.entries(dayPerformance)) {
      const rate = performance.replied / performance.total;
      if (rate > bestDayRate && performance.total >= 5) {
        bestDayRate = rate;
        bestDay = parseInt(day);
      }
    }

    for (const [hour, performance] of Object.entries(hourPerformance)) {
      const rate = performance.replied / performance.total;
      if (rate > bestHourRate && performance.total >= 3) {
        bestHourRate = rate;
        bestHour = parseInt(hour);
      }
    }

    const timingPerformance: Record<string, number> = {};
    Object.entries(dayPerformance).forEach(([day, perf]) => {
      timingPerformance[`day_${day}`] = perf.replied / perf.total;
    });
    Object.entries(hourPerformance).forEach(([hour, perf]) => {
      timingPerformance[`hour_${hour}`] = perf.replied / perf.total;
    });

    return {
      bestDayOfWeek: bestDay,
      bestHourOfDay: bestHour,
      timingPerformance
    };
  }

  private calculatePersonalizationImpact(metrics: ConversionMetrics[]): ConversionInsights['personalizationImpact'] {
    const high = metrics.filter(m => m.personalizationElements.length >= 3);
    const medium = metrics.filter(m => m.personalizationElements.length === 2);
    const low = metrics.filter(m => m.personalizationElements.length <= 1);

    return {
      highPersonalization: {
        responseRate: this.calculateOverallPerformance(high).responseRate,
        count: high.length
      },
      mediumPersonalization: {
        responseRate: this.calculateOverallPerformance(medium).responseRate,
        count: medium.length
      },
      lowPersonalization: {
        responseRate: this.calculateOverallPerformance(low).responseRate,
        count: low.length
      }
    };
  }

  private generateRecommendations(metrics: ConversionMetrics[]): string[] {
    const recommendations: string[] = [];
    const performance = this.calculateOverallPerformance(metrics);

    if (performance.responseRate < 0.03) {
      recommendations.push('Response rate is below industry average (3%). Consider testing different subject line styles and psychological triggers.');
    }

    if (performance.openRate < 0.25) {
      recommendations.push('Open rate is low. Focus on subject line optimization and send time testing.');
    }

    const personalizationImpact = this.calculatePersonalizationImpact(metrics);
    if (personalizationImpact.highPersonalization.responseRate > personalizationImpact.lowPersonalization.responseRate * 1.5) {
      recommendations.push('High personalization shows strong impact on response rates. Increase personalization depth.');
    }

    const triggerPerformance = this.calculatePerformanceByPsychologicalTrigger(metrics);
    const topTrigger = Object.entries(triggerPerformance)
      .sort(([,a], [,b]) => b.responseRate - a.responseRate)[0];
    
    if (topTrigger) {
      recommendations.push(`${topTrigger[0]} trigger shows highest response rate (${(topTrigger[1].responseRate * 100).toFixed(1)}%). Use more frequently.`);
    }

    return recommendations;
  }

  private calculateVariantPerformance(metrics: ConversionMetrics[]): { openRate: number; responseRate: number; count: number } {
    const performance = this.calculateOverallPerformance(metrics);
    return {
      openRate: performance.openRate,
      responseRate: performance.responseRate,
      count: metrics.length
    };
  }

  private calculateStatisticalSignificance(
    variantA: { responseRate: number; count: number },
    variantB: { responseRate: number; count: number }
  ): { significant: boolean; confidence: number } {
    // Simplified statistical significance test
    const minSampleSize = 50;
    const minDifference = 0.02; // 2% difference threshold

    if (variantA.count < minSampleSize || variantB.count < minSampleSize) {
      return { significant: false, confidence: 0 };
    }

    const difference = Math.abs(variantA.responseRate - variantB.responseRate);
    if (difference < minDifference) {
      return { significant: false, confidence: 0 };
    }

    // Simplified confidence calculation
    const totalSamples = variantA.count + variantB.count;
    const confidence = Math.min(95, (totalSamples / 100) * difference * 1000);

    return {
      significant: confidence >= 90,
      confidence: Math.round(confidence)
    };
  }

  private generateABTestRecommendations(test: A_BTestResult): string[] {
    const recommendations: string[] = [];

    if (test.statisticalSignificance && test.winner) {
      const winnerVariant = test.winner === 'A' ? test.variant_A : test.variant_B;
      const improvement = test.winner === 'A' 
        ? test.variant_A.performance.responseRate - test.variant_B.performance.responseRate
        : test.variant_B.performance.responseRate - test.variant_A.performance.responseRate;

      recommendations.push(
        `Variant ${test.winner} (${winnerVariant.name}) wins with ${(improvement * 100).toFixed(1)}% higher response rate`
      );
      recommendations.push(`Implement ${winnerVariant.name} approach for future campaigns`);
    } else {
      recommendations.push('Test needs more data for statistical significance');
      recommendations.push(`Current sample sizes: A=${test.variant_A.performance.count}, B=${test.variant_B.performance.count}`);
    }

    return recommendations;
  }

  private getSubjectLineRecommendations(campaignMetrics: ConversionMetrics[], allMetrics: ConversionMetrics[]): string[] {
    const campaignStyles = this.calculatePerformanceBySubjectLineStyle(campaignMetrics);
    const benchmarkStyles = this.calculatePerformanceBySubjectLineStyle(allMetrics);
    
    const recommendations: string[] = [];
    
    for (const [style, performance] of Object.entries(campaignStyles)) {
      const benchmark = benchmarkStyles[style];
      if (benchmark && performance.responseRate < benchmark.responseRate * 0.8) {
        recommendations.push(`${style} style underperforming. Benchmark: ${(benchmark.responseRate * 100).toFixed(1)}%, Current: ${(performance.responseRate * 100).toFixed(1)}%`);
      }
    }

    return recommendations.length > 0 ? recommendations : ['Subject line performance within expected range'];
  }

  private getTimingRecommendations(campaignMetrics: ConversionMetrics[], allMetrics: ConversionMetrics[]): string[] {
    const timingPerformance = this.calculateTimingPerformance(campaignMetrics);
    const benchmarkTiming = this.calculateTimingPerformance(allMetrics);
    
    const recommendations: string[] = [];
    
    if (timingPerformance.bestDayOfWeek !== benchmarkTiming.bestDayOfWeek) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      recommendations.push(`Consider testing sends on ${dayNames[benchmarkTiming.bestDayOfWeek]} (best performing day overall)`);
    }

    if (Math.abs(timingPerformance.bestHourOfDay - benchmarkTiming.bestHourOfDay) > 2) {
      recommendations.push(`Consider testing sends around ${benchmarkTiming.bestHourOfDay}:00 (best performing hour overall)`);
    }

    return recommendations.length > 0 ? recommendations : ['Send timing appears optimal'];
  }

  private getPersonalizationRecommendations(campaignMetrics: ConversionMetrics[], allMetrics: ConversionMetrics[]): string[] {
    const campaignPersonalization = this.calculatePersonalizationImpact(campaignMetrics);
    const benchmarkPersonalization = this.calculatePersonalizationImpact(allMetrics);

    const recommendations: string[] = [];

    if (campaignPersonalization.highPersonalization.responseRate < benchmarkPersonalization.highPersonalization.responseRate * 0.9) {
      recommendations.push('High personalization underperforming. Review personalization quality and relevance');
    }

    const highPersonalizationShare = campaignPersonalization.highPersonalization.count / campaignMetrics.length;
    if (highPersonalizationShare < 0.3) {
      recommendations.push('Increase high personalization usage. Currently only ' + (highPersonalizationShare * 100).toFixed(1) + '% of emails');
    }

    return recommendations.length > 0 ? recommendations : ['Personalization strategy appears effective'];
  }

  private getTriggerRecommendations(campaignMetrics: ConversionMetrics[], allMetrics: ConversionMetrics[]): string[] {
    const campaignTriggers = this.calculatePerformanceByPsychologicalTrigger(campaignMetrics);
    const benchmarkTriggers = this.calculatePerformanceByPsychologicalTrigger(allMetrics);

    const recommendations: string[] = [];

    // Find underperforming triggers
    for (const [trigger, performance] of Object.entries(campaignTriggers)) {
      const benchmark = benchmarkTriggers[trigger];
      if (benchmark && performance.responseRate < benchmark.responseRate * 0.8) {
        recommendations.push(`${trigger} trigger underperforming vs benchmark`);
      }
    }

    // Find top performing triggers not being used enough
    const topBenchmarkTriggers = Object.entries(benchmarkTriggers)
      .sort(([,a], [,b]) => b.responseRate - a.responseRate)
      .slice(0, 3);

    for (const [trigger] of topBenchmarkTriggers) {
      if (!campaignTriggers[trigger] || campaignTriggers[trigger].count < 5) {
        recommendations.push(`Consider using ${trigger} trigger more frequently (top performer overall)`);
      }
    }

    return recommendations.length > 0 ? recommendations : ['Psychological trigger usage appears optimal'];
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }
}