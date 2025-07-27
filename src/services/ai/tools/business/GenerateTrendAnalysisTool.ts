import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import { IReportingService } from '../../../business/ReportingService';
import { IWebSearchService } from '../../../external/WebSearchService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:trend-analysis');

export class GenerateTrendAnalysisTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Generate comprehensive trend analysis with real-world context. Use when user asks for trends, pattern analysis, or wants to understand why income changes occur over time.';

  public parameters = z.object({
    timeFrame: z
      .string()
      .describe(
        'Time frame for trend analysis like "last 3 months", "last 6 months", "this year"',
      ),
    includeMarketAnalysis: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to include real market trends and external factors'),
  });

  constructor(
    private readonly managerService: IManagerService,
    private readonly reportingService: IReportingService,
    private readonly webSearchService: IWebSearchService,
    private readonly telegramUserId: string,
  ) {
    super();
  }

  public async execute({
    timeFrame,
    includeMarketAnalysis = true,
  }: {
    timeFrame: string;
    includeMarketAnalysis?: boolean;
  }): Promise<string> {
    try {
      debug('Generating trend analysis:', { timeFrame, includeMarketAnalysis });

      const manager = await this.managerService.getManagerByTelegramId(
        this.telegramUserId,
      );
      if (!manager) {
        return '❌ No business found. Please register your business first.';
      }

      const months = this.parseMonthsFromTimeFrame(timeFrame);

      const trendAnalysis = await this.reportingService.generateTrendAnalysis(
        manager.id!,
        months,
      );

      let reportText = `📈 Trend Analysis Report - ${manager.business_name}\n`;
      reportText += `📅 Analysis Period: ${timeFrame} (${months} months)\n`;
      reportText += `📊 Overall Trend: ${trendAnalysis.overallTrend.toUpperCase()} by ${trendAnalysis.trendPercentage}%\n\n`;

      reportText += `📊 Monthly Performance:\n`;
      trendAnalysis.periods.forEach((period, index) => {
        const trendIcon =
          index > 0
            ? period.totalIncome >= trendAnalysis.periods[index - 1].totalIncome
              ? '📈'
              : '📉'
            : '📊';

        reportText += `${trendIcon} ${period.period}: ${this.formatCurrency(period.totalIncome)} (${period.entryCount} entries)\n`;
      });

      reportText += '\n🔍 Business Insights:\n';
      trendAnalysis.insights.forEach((insight) => {
        reportText += `• ${insight}\n`;
      });

      if (includeMarketAnalysis && months >= 3) {
        reportText += '\n🌐 Market Context & External Factors:\n';

        try {
          const marketData = await this.getMarketContext(trendAnalysis);
          reportText += marketData;
        } catch (error) {
          debug('Error getting market context:', error);
          reportText += '• Market analysis temporarily unavailable\n';
        }
      }

      reportText += '\n💡 Recommendations:\n';
      const recommendations = this.generateRecommendations(trendAnalysis);
      recommendations.forEach((rec) => {
        reportText += `• ${rec}\n`;
      });

      return reportText;
    } catch (error) {
      debug('Error generating trend analysis:', error);
      return '❌ Error generating trend analysis. Please try again.';
    }
  }

  private parseMonthsFromTimeFrame(timeFrame: string): number {
    const lowerFrame = timeFrame.toLowerCase();

    const monthMatch = lowerFrame.match(/(\d+)\s*months?/);
    if (monthMatch) {
      return parseInt(monthMatch[1]);
    }

    if (lowerFrame.includes('quarter')) return 3;
    if (lowerFrame.includes('half year') || lowerFrame.includes('6 months'))
      return 6;
    if (lowerFrame.includes('year')) return 12;

    return 3;
  }

  private async getMarketContext(trendAnalysis: any): Promise<string> {
    const searchQueries = [
      'indonesia automotive industry trends 2024',
      'indonesia economic factors affecting small business',
      'garage automotive service market indonesia',
      'indonesia consumer spending automotive 2024',
    ];

    let contextText = '';

    for (const query of searchQueries.slice(0, 2)) {
      try {
        const results = await this.webSearchService.search(query, 3);

        if (results.length > 0) {
          contextText += `\n📰 Recent Market Insights:\n`;
          results.slice(0, 2).forEach((result) => {
            contextText += `• ${result.title}\n  ${result.snippet}\n`;
          });
          break;
        }
      } catch (error) {
        debug('Search error:', error);
        continue;
      }
    }

    if (!contextText) {
      contextText =
        '• Market data analysis: External factors may include seasonal variations, economic conditions, and local automotive service demand\n';

      if (trendAnalysis.overallTrend === 'increasing') {
        contextText +=
          '• Positive trend may indicate growing automotive service demand or improved service quality\n';
      } else if (trendAnalysis.overallTrend === 'decreasing') {
        contextText +=
          '• Declining trend may be influenced by economic factors, increased competition, or seasonal patterns\n';
      } else {
        contextText +=
          '• Stable trend indicates consistent market position and steady customer base\n';
      }
    }

    return contextText;
  }

  private generateRecommendations(trendAnalysis: any): string[] {
    const recommendations: string[] = [];

    if (trendAnalysis.overallTrend === 'increasing') {
      recommendations.push(
        'Capitalize on positive momentum by expanding service offerings',
      );
      recommendations.push(
        'Consider investing in additional equipment or staff training',
      );
      recommendations.push(
        'Document successful practices to maintain growth trajectory',
      );
    } else if (trendAnalysis.overallTrend === 'decreasing') {
      recommendations.push('Analyze specific factors contributing to decline');
      recommendations.push(
        'Consider promotional campaigns or service improvements',
      );
      recommendations.push('Review pricing strategy and customer feedback');
      recommendations.push(
        'Explore new revenue streams or service diversification',
      );
    } else {
      recommendations.push(
        'Identify opportunities to break out of stable pattern',
      );
      recommendations.push('Consider customer acquisition strategies');
      recommendations.push('Analyze competitor offerings and market gaps');
    }

    const currentMonth = new Date().getMonth();
    if (currentMonth >= 11 || currentMonth <= 1) {
      recommendations.push(
        'Consider end-of-year maintenance campaigns for vehicle owners',
      );
    } else if (currentMonth >= 5 && currentMonth <= 7) {
      recommendations.push(
        'Leverage travel season for pre-trip vehicle maintenance services',
      );
    }

    return recommendations;
  }
}
