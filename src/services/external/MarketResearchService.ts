import { IWebSearchService } from './WebSearchService';
import createDebug from 'debug';

const debug = createDebug('bot:market-research');

export interface MarketInsight {
  category: string;
  insights: string[];
  sources: string[];
  impact: 'positive' | 'negative' | 'neutral';
  relevanceScore: number;
}

export interface SeasonalInsight {
  season: string;
  month: number;
  trends: string[];
  businessRecommendations: string[];
  marketFactors: string[];
}

export interface IMarketResearchService {
  getIndustryInsights(
    businessType: string,
    timeFrame: string,
  ): Promise<MarketInsight[]>;
  getSeasonalInsights(
    month: number,
    businessType: string,
  ): Promise<SeasonalInsight>;
  getEconomicFactors(region: string): Promise<MarketInsight>;
  analyzeCompetitorTrends(businessType: string): Promise<MarketInsight>;
}

export class MarketResearchService implements IMarketResearchService {
  constructor(private readonly webSearchService: IWebSearchService) {}

  public async getIndustryInsights(
    businessType: string = 'automotive garage',
    timeFrame: string = 'recent',
  ): Promise<MarketInsight[]> {
    const insights: MarketInsight[] = [];

    try {
      // Search for industry trends
      const industryQueries = [
        `indonesia ${businessType} industry trends 2024`,
        `automotive service business indonesia market analysis`,
        `small business ${businessType} indonesia economic impact`,
        `customer behavior automotive services indonesia 2024`,
      ];

      for (const query of industryQueries) {
        try {
          const results = await this.webSearchService.search(query, 3);

          if (results.length > 0) {
            const insight = this.extractInsightFromResults(
              results,
              this.categorizeQuery(query),
            );
            if (insight.insights.length > 0) {
              insights.push(insight);
            }
          }

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          debug('Error searching for industry insights:', error);
        }
      }

      // Add fallback insights if no search results
      if (insights.length === 0) {
        insights.push(this.getFallbackIndustryInsights(businessType));
      }
    } catch (error) {
      debug('Error getting industry insights:', error);
      insights.push(this.getFallbackIndustryInsights(businessType));
    }

    return insights;
  }

  public async getSeasonalInsights(
    month: number,
    businessType: string = 'automotive garage',
  ): Promise<SeasonalInsight> {
    try {
      const seasonName = this.getSeasonName(month);
      const searchQuery = `indonesia ${seasonName} season ${businessType} business trends consumer behavior`;

      const results = await this.webSearchService.search(searchQuery, 3);

      if (results.length > 0) {
        return this.extractSeasonalInsights(
          results,
          month,
          seasonName,
          businessType,
        );
      }
    } catch (error) {
      debug('Error getting seasonal insights:', error);
    }

    return this.getFallbackSeasonalInsights(month, businessType);
  }

  public async getEconomicFactors(
    region: string = 'indonesia',
  ): Promise<MarketInsight> {
    try {
      const queries = [
        `${region} economic indicators 2024 small business impact`,
        `inflation rate ${region} consumer spending automotive`,
        `fuel prices ${region} 2024 automotive industry impact`,
      ];

      for (const query of queries) {
        try {
          const results = await this.webSearchService.search(query, 2);

          if (results.length > 0) {
            return this.extractInsightFromResults(results, 'Economic Factors');
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          debug('Error searching economic factors:', error);
        }
      }
    } catch (error) {
      debug('Error getting economic factors:', error);
    }

    return this.getFallbackEconomicInsights(region);
  }

  public async analyzeCompetitorTrends(
    businessType: string,
  ): Promise<MarketInsight> {
    try {
      const queries = [
        `automotive service competition indonesia 2024`,
        `garage business market share trends indonesia`,
        `car service industry competitive analysis indonesia`,
      ];

      for (const query of queries) {
        try {
          const results = await this.webSearchService.search(query, 3);

          if (results.length > 0) {
            return this.extractInsightFromResults(
              results,
              'Competitive Analysis',
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          debug('Error analyzing competitor trends:', error);
        }
      }
    } catch (error) {
      debug('Error getting competitor analysis:', error);
    }

    return this.getFallbackCompetitorInsights();
  }

  private extractInsightFromResults(
    results: any[],
    category: string,
  ): MarketInsight {
    const insights: string[] = [];
    const sources: string[] = [];

    results.forEach((result) => {
      if (result.snippet) {
        // Extract key insights from snippets
        const sentences = result.snippet
          .split(/[.!?]+/)
          .filter((s: string) => s.trim().length > 20);
        sentences.forEach((sentence: string) => {
          const cleaned: string = sentence.trim();
          if (cleaned && this.isRelevantInsight(cleaned)) {
            insights.push(cleaned);
          }
        });
      }

      if (result.title) {
        sources.push(result.title);
      }
    });

    return {
      category,
      insights: insights.slice(0, 5), // Limit to top 5 insights
      sources: sources.slice(0, 3), // Limit to top 3 sources
      impact: this.determineImpact(insights),
      relevanceScore: this.calculateRelevanceScore(insights, category),
    };
  }

  private extractSeasonalInsights(
    results: any[],
    month: number,
    season: string,
    businessType: string,
  ): SeasonalInsight {
    const trends: string[] = [];
    const businessRecommendations: string[] = [];
    const marketFactors: string[] = [];

    results.forEach((result) => {
      if (result.snippet) {
        const sentences = result.snippet
          .split(/[.!?]+/)
          .filter((s: string) => s.trim().length > 15);
        sentences.forEach((sentence: string) => {
          const cleaned: string = sentence.trim().toLowerCase();

          if (cleaned.includes('trend') || cleaned.includes('pattern')) {
            trends.push(sentence.trim());
          } else if (
            cleaned.includes('recommend') ||
            cleaned.includes('should') ||
            cleaned.includes('strategy')
          ) {
            businessRecommendations.push(sentence.trim());
          } else if (
            cleaned.includes('market') ||
            cleaned.includes('demand') ||
            cleaned.includes('consumer')
          ) {
            marketFactors.push(sentence.trim());
          }
        });
      }
    });

    return {
      season,
      month,
      trends: trends.slice(0, 3),
      businessRecommendations: businessRecommendations.slice(0, 3),
      marketFactors: marketFactors.slice(0, 3),
    };
  }

  private categorizeQuery(query: string): string {
    if (query.includes('trends')) return 'Industry Trends';
    if (query.includes('market analysis')) return 'Market Analysis';
    if (query.includes('economic impact')) return 'Economic Impact';
    if (query.includes('customer behavior')) return 'Customer Behavior';
    return 'General Industry';
  }

  private isRelevantInsight(text: string): boolean {
    const keywords = [
      'increase',
      'decrease',
      'trend',
      'growth',
      'decline',
      'demand',
      'market',
      'consumer',
      'customer',
      'business',
      'service',
      'automotive',
      'revenue',
      'profit',
      'competition',
      'opportunity',
      'challenge',
      'forecast',
      'prediction',
    ];

    const lowerText = text.toLowerCase();
    return keywords.some((keyword) => lowerText.includes(keyword));
  }

  private determineImpact(
    insights: string[],
  ): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'increase',
      'growth',
      'opportunity',
      'improve',
      'better',
      'rise',
      'expand',
    ];
    const negativeWords = [
      'decrease',
      'decline',
      'challenge',
      'problem',
      'fall',
      'reduce',
      'crisis',
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    insights.forEach((insight) => {
      const lowerInsight = insight.toLowerCase();
      positiveCount += positiveWords.filter((word) =>
        lowerInsight.includes(word),
      ).length;
      negativeCount += negativeWords.filter((word) =>
        lowerInsight.includes(word),
      ).length;
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private calculateRelevanceScore(
    insights: string[],
    category: string,
  ): number {
    const relevantTerms = [
      'automotive',
      'garage',
      'service',
      'business',
      'indonesia',
      'market',
    ];
    let score = 0;

    insights.forEach((insight) => {
      const lowerInsight = insight.toLowerCase();
      score += relevantTerms.filter((term) =>
        lowerInsight.includes(term),
      ).length;
    });

    return Math.min(score / insights.length, 1.0); // Normalize to 0-1
  }

  private getSeasonName(
    month: number,
  ): 'rainy' | 'dry' | 'cool dry' | 'transition' {
    if (month >= 11 || month <= 2) return 'rainy'; // Dec-Feb
    if (month >= 3 && month <= 5) return 'dry'; // Mar-May
    if (month >= 6 && month <= 8) return 'cool dry'; // Jun-Aug
    return 'transition'; // Sep-Nov
  }

  private getFallbackIndustryInsights(businessType: string): MarketInsight {
    const currentMonth = new Date().getMonth();
    const insights = [
      "Indonesia's automotive service industry continues to grow with increasing vehicle ownership",
      'Digital transformation is reshaping customer expectations in automotive services',
      'Economic recovery post-pandemic shows positive trends for small automotive businesses',
      'Fuel price fluctuations continue to impact customer behavior and service demand',
    ];

    // Add seasonal context
    if (currentMonth >= 11 || currentMonth <= 2) {
      insights.push(
        'Rainy season typically increases demand for brake and electrical services',
      );
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      insights.push(
        'Dry season shows increased demand for AC and cooling system services',
      );
    }

    return {
      category: 'Industry Overview',
      insights,
      sources: ['Market Analysis Fallback'],
      impact: 'neutral',
      relevanceScore: 0.7,
    };
  }

  private getFallbackSeasonalInsights(
    month: number,
    businessType: string,
  ): SeasonalInsight {
    const season = this.getSeasonName(month);

    const seasonalData = {
      rainy: {
        trends: [
          'Increased demand for brake and tire services during rainy season',
          'Higher frequency of electrical system issues due to humidity',
          'Reduced walk-in traffic but more urgent repair needs',
        ],
        businessRecommendations: [
          'Promote brake inspection and tire replacement services',
          'Offer covered service areas to attract customers during rain',
          'Stock up on electrical components and wiper blades',
        ],
        marketFactors: [
          'Seasonal flooding may affect customer accessibility',
          'Insurance claims increase for weather-related vehicle damage',
          'Competition for indoor service bays intensifies',
        ],
      },
      dry: {
        trends: [
          'Peak demand for AC maintenance and cooling system services',
          'Increased long-distance travel driving service needs',
          'Higher customer traffic during dry weather conditions',
        ],
        businessRecommendations: [
          'Focus marketing on AC repair and coolant system maintenance',
          'Extend operating hours to accommodate higher demand',
          'Prepare for pre-holiday vehicle check-up campaigns',
        ],
        marketFactors: [
          'Fuel consumption patterns change affecting service intervals',
          'Tourism season drives demand for reliable vehicle maintenance',
          'Heat stress on vehicles creates opportunities for preventive services',
        ],
      },
      'cool dry': {
        trends: [
          'Moderate weather provides optimal working conditions',
          'Balanced demand across all service categories',
          'Good period for major repair work and painting services',
        ],
        businessRecommendations: [
          'Schedule complex repairs during favorable weather',
          'Promote comprehensive vehicle check-ups',
          'Take advantage of good conditions for exterior work',
        ],
        marketFactors: [
          'Stable weather patterns support consistent business operations',
          'School calendar affects family vehicle usage patterns',
          'End-of-year budget considerations influence customer decisions',
        ],
      },
      transition: {
        trends: [
          'Variable weather patterns create diverse service needs',
          'Customers prepare vehicles for upcoming season changes',
          'Mixed demand for both cooling and weatherproofing services',
        ],
        businessRecommendations: [
          'Offer seasonal transition service packages',
          'Prepare inventory for changing weather conditions',
          'Educate customers on seasonal maintenance needs',
        ],
        marketFactors: [
          'Weather unpredictability affects service planning',
          'Holiday seasons influence customer spending patterns',
          'Preparation period for major seasonal changes',
        ],
      },
    };

    const data = seasonalData[season] || seasonalData['transition'];

    return {
      season,
      month,
      trends: data.trends,
      businessRecommendations: data.businessRecommendations,
      marketFactors: data.marketFactors,
    };
  }

  private getFallbackEconomicInsights(region: string): MarketInsight {
    return {
      category: 'Economic Factors',
      insights: [
        "Indonesia's economic recovery shows positive signs for small business growth",
        'Inflation affects spare parts pricing and customer spending power',
        'Fuel price stability is crucial for automotive service demand',
        'Government policies supporting small businesses create opportunities',
        'Rising middle class increases demand for quality automotive services',
      ],
      sources: ['Economic Analysis Fallback'],
      impact: 'neutral',
      relevanceScore: 0.6,
    };
  }

  private getFallbackCompetitorInsights(): MarketInsight {
    return {
      category: 'Competitive Analysis',
      insights: [
        'Traditional garages face competition from authorized service centers',
        'Digital marketing and online booking systems become competitive advantages',
        'Specialization in specific vehicle brands or services differentiates businesses',
        'Customer service quality increasingly determines market positioning',
        'Price competition remains significant in local markets',
      ],
      sources: ['Competitive Analysis Fallback'],
      impact: 'neutral',
      relevanceScore: 0.6,
    };
  }
}
