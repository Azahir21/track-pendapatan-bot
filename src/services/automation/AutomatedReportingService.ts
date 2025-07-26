import { Telegraf } from 'telegraf';
import { IManagerService } from '../business/ManagerService';
import { IReportingService } from '../business/ReportingService';
import { IWebSearchService } from '../external/WebSearchService';
import { IWeatherService, WeatherService } from '../external/WeatherService';
import {
  IMarketResearchService,
  MarketResearchService,
} from '../external/MarketResearchService';
import createDebug from 'debug';

const debug = createDebug('bot:automated-reporting');

export interface ReportSchedule {
  type: 'test' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  description: string;
  enabled: boolean;
}

export interface IAutomatedReportingService {
  startScheduledReports(bot: Telegraf): void;
  stopScheduledReports(): void;
  sendTestReport(telegramUserId: string, bot: Telegraf): Promise<void>;
  updateSchedule(type: string, enabled: boolean): void;
  getScheduleStatus(): ReportSchedule[];
}

export class AutomatedReportingService implements IAutomatedReportingService {
  private readonly intervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly schedules: Map<string, ReportSchedule> = new Map();
  private readonly weatherService: IWeatherService;
  private readonly marketResearchService: IMarketResearchService;

  constructor(
    private readonly managerService: IManagerService,
    private readonly reportingService: IReportingService,
    private readonly webSearchService: IWebSearchService,
    weatherService?: IWeatherService,
    marketResearchService?: IMarketResearchService,
  ) {
    // Initialize services with fallbacks
    this.weatherService = weatherService || new WeatherService();
    this.marketResearchService =
      marketResearchService || new MarketResearchService(webSearchService);
    this.initializeSchedules();
  }

  private initializeSchedules(): void {
    // Test report every 3 minutes (for development/testing)
    this.schedules.set('test', {
      type: 'test',
      interval: 3 * 60 * 1000, // 3 minutes
      description: 'Test report every 3 minutes',
      enabled: process.env.NODE_ENV === 'development', // Only enable in dev
    });

    // Weekly report every Friday at 5 PM (check every hour)
    this.schedules.set('weekly', {
      type: 'weekly',
      interval: 60 * 60 * 1000, // Check every hour
      description: 'Weekly report every Friday at 5 PM',
      enabled: true,
    });

    // Monthly report on the 1st of every month at 9 AM (check every hour)
    this.schedules.set('monthly', {
      type: 'monthly',
      interval: 60 * 60 * 1000, // Check every hour
      description: 'Monthly report on 1st of every month at 9 AM',
      enabled: true,
    });

    // Yearly report on January 1st at 10 AM (check every hour)
    this.schedules.set('yearly', {
      type: 'yearly',
      interval: 60 * 60 * 1000, // Check every hour
      description: 'Yearly report on January 1st at 10 AM',
      enabled: true,
    });
  }

  public startScheduledReports(bot: Telegraf): void {
    debug('Starting automated reporting service');

    for (const [key, schedule] of this.schedules.entries()) {
      if (schedule.enabled) {
        this.startSchedule(key, schedule, bot);
      }
    }
  }

  private startSchedule(
    key: string,
    schedule: ReportSchedule,
    bot: Telegraf,
  ): void {
    debug(`Starting ${schedule.type} reports: ${schedule.description}`);

    // Clear existing interval if any
    if (this.intervals.has(key)) {
      clearInterval(this.intervals.get(key));
    }

    const intervalId = setInterval(async () => {
      try {
        // Check if it's the right time to send the report
        if (this.shouldSendReport(schedule.type)) {
          await this.executeScheduledReport(schedule.type, bot);
        }
      } catch (error) {
        debug(`Error executing ${schedule.type} report:`, error);
      }
    }, schedule.interval);

    this.intervals.set(key, intervalId);
    debug(
      `${schedule.type} report scheduled with interval: ${schedule.interval}ms`,
    );
  }

  private shouldSendReport(type: string): boolean {
    const now = new Date();
    const jakartaTime = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }),
    );

    switch (type) {
      case 'test':
        // Always send test reports when scheduled (every 3 minutes in dev)
        return process.env.NODE_ENV === 'development';

      case 'weekly':
        // Send on Friday at 5 PM Jakarta time
        return jakartaTime.getDay() === 5 && jakartaTime.getHours() === 17;

      case 'monthly':
        // Send on 1st of month at 9 AM Jakarta time
        return jakartaTime.getDate() === 1 && jakartaTime.getHours() === 9;

      case 'yearly':
        // Send on January 1st at 10 AM Jakarta time
        return (
          jakartaTime.getMonth() === 0 &&
          jakartaTime.getDate() === 1 &&
          jakartaTime.getHours() === 10
        );

      default:
        return false;
    }
  }

  private async executeScheduledReport(
    type: string,
    bot: Telegraf,
  ): Promise<void> {
    debug(`Executing ${type} report`);

    try {
      // Get all registered managers (businesses)
      const managers = await this.getAllManagers();

      if (managers.length === 0) {
        debug('No registered businesses found for automated reports');
        return;
      }

      for (const manager of managers) {
        try {
          let reportContent = '';
          let reportTitle = '';

          switch (type) {
            case 'test':
              reportContent = await this.generateTestReport(manager.id);
              reportTitle = '🧪 Test Report (Every 3 Minutes)';
              break;
            case 'weekly':
              reportContent = await this.generateWeeklyReport(manager.id);
              reportTitle = '📊 Weekly Business Report';
              break;
            case 'monthly':
              reportContent = await this.generateMonthlyReport(manager.id);
              reportTitle = '📈 Monthly Business Report';
              break;
            case 'yearly':
              reportContent = await this.generateYearlyReport(manager.id);
              reportTitle = '🎊 Annual Business Report';
              break;
            default:
              continue;
          }

          const fullReport = `${reportTitle}\n\n🏢 ${manager.business_name}\n${this.getCurrentDateTime()}\n\n${reportContent}`;

          // Send report to business owner
          await bot.telegram.sendMessage(manager.telegram_user_id, fullReport);
          debug(
            `${type} report sent to ${manager.telegram_user_id} (${manager.business_name})`,
          );
        } catch (error) {
          debug(
            `Error sending ${type} report to ${manager.telegram_user_id}:`,
            error,
          );
        }
      }
    } catch (error) {
      debug(`Error in executeScheduledReport for ${type}:`, error);
    }
  }

  private async generateTestReport(managerId: number): Promise<string> {
    try {
      const { startDate, endDate } = this.getDateRange('today');
      const report = await this.reportingService.generatePeriodReport(
        managerId,
        startDate,
        endDate,
      );

      // Get current weather with enhanced error handling
      let weatherContext = '';
      try {
        const currentWeather =
          await this.weatherService.getCurrentWeather('Jakarta');

        const dataSource = process.env.WEATHER_API_KEY
          ? '🌐 Live Weather Data'
          : '🤖 Intelligent Climate Analysis';

        weatherContext = `🌤️ Weather Impact Analysis (${dataSource}):\n`;
        weatherContext += `   Temperature: ${currentWeather.temperature}°C (${currentWeather.description})\n`;
        weatherContext += `   Condition: ${currentWeather.condition}\n`;
        weatherContext += `   Humidity: ${currentWeather.humidity}%\n`;

        // Business-specific insights
        if (currentWeather.condition.toLowerCase().includes('rain')) {
          weatherContext += `   💡 Rainy conditions may reduce walk-in traffic but increase emergency brake and electrical services\n`;
          weatherContext += `   🔧 Recommended: Stock wiper blades and offer covered service areas\n`;
        } else if (currentWeather.temperature > 32) {
          weatherContext += `   💡 Hot weather increases AC service demand and affects workshop comfort\n`;
          weatherContext += `   🔧 Recommended: Promote AC maintenance and ensure adequate workshop ventilation\n`;
        } else if (currentWeather.temperature < 25) {
          weatherContext += `   💡 Cooler weather typically increases vehicle maintenance needs\n`;
          weatherContext += `   🔧 Recommended: Focus on engine check-ups and heating system services\n`;
        } else {
          weatherContext += `   💡 Moderate weather provides optimal conditions for all service types\n`;
          weatherContext += `   🔧 Recommended: Ideal time for comprehensive vehicle inspections\n`;
        }
        weatherContext += '\n';
      } catch (error) {
        debug('Error getting weather for test report:', error);
        weatherContext = `🌤️ Weather Analysis: Using Jakarta climate patterns\n`;
        weatherContext += `   💡 Set WEATHER_API_KEY in .env for live weather data\n`;
        weatherContext += `   🔧 Current conditions affect garage operations - monitor local weather\n\n`;
      }

      let content = `📋 Quick Status Check\n\n`;
      content += `💰 Today's Income: Rp ${report.totalIncome.toLocaleString('id-ID')}\n`;
      content += `📝 Total Entries: ${report.totalEntries}\n`;
      content += `👥 Active Employees: ${report.employeeReports.length}\n\n`;
      content += weatherContext;
      content += `🔄 This is an automated test report sent every 3 minutes.\n`;
      content += `💡 Disable in production by setting NODE_ENV=production\n`;

      // Add API status info for development
      if (process.env.NODE_ENV === 'development') {
        const apiStatus = process.env.WEATHER_API_KEY
          ? '✅ Weather API configured'
          : '⚠️  Weather API not configured - using intelligent mock data';
        content += `🔧 Dev Info: ${apiStatus}`;
      }

      return content;
    } catch (error) {
      return `❌ Error generating test report: ${error}`;
    }
  }

  private async generateWeeklyReport(managerId: number): Promise<string> {
    try {
      const { startDate, endDate } = this.getDateRange('thisWeek');
      const report = await this.reportingService.generatePeriodReport(
        managerId,
        startDate,
        endDate,
      );

      let content = `📅 This Week's Performance\n`;
      content += `🗓️ ${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}\n\n`;

      content += `💰 Total Revenue: Rp ${report.totalIncome.toLocaleString('id-ID')}\n`;
      content += `📈 Daily Average: Rp ${report.averageDaily.toLocaleString('id-ID')}\n`;
      content += `📝 Total Transactions: ${report.totalEntries}\n\n`;

      if (report.topPerformers.length > 0) {
        content += `🏆 Top Performers:\n`;
        report.topPerformers.slice(0, 3).forEach((emp, idx) => {
          content += `${idx + 1}. ${emp.employee.employee_name}: Rp ${emp.totalIncome.toLocaleString('id-ID')}\n`;
        });
        content += '\n';
      }

      // Add weather insights with error handling
      try {
        const weatherData = await this.weatherService.getWeatherHistory(
          'Jakarta',
          startDate,
          endDate,
        );
        const weatherInsights = this.weatherService.generateWeatherInsights(
          weatherData,
          'garage',
        );

        content += `🌤️ Weather Impact Analysis:\n`;
        content += `   Average Temperature: ${weatherInsights.averageTemp}°C\n`;
        content += `   Dominant Condition: ${weatherInsights.dominantCondition}\n`;
        content += `   Rainy Days: ${weatherInsights.rainyDays}/${weatherInsights.totalDays}\n`;
        content += `   📊 ${weatherInsights.weatherImpact}\n`;
        content += `   💡 ${weatherInsights.businessRecommendation}\n\n`;
      } catch (error) {
        debug('Error getting weather insights for weekly report:', error);
        content += `🌤️ Weather analysis temporarily unavailable\n\n`;
      }

      // Add market insights with error handling
      try {
        const industryInsights =
          await this.marketResearchService.getIndustryInsights(
            'automotive garage',
            'weekly',
          );
        if (industryInsights.length > 0) {
          content += `📊 Market Intelligence:\n`;
          industryInsights.slice(0, 2).forEach((insight) => {
            if (insight.insights.length > 0) {
              content += `   ${insight.category}:\n`;
              insight.insights.slice(0, 2).forEach((item) => {
                content += `   • ${item}\n`;
              });
            }
          });
          content += '\n';
        }
      } catch (error) {
        debug('Error getting market insights for weekly report:', error);
      }

      content += `💡 Key Business Insights:\n`;
      report.insights.forEach((insight) => {
        content += `• ${insight}\n`;
      });

      content += `\n🎯 Have a productive weekend and great week ahead!`;
      return content;
    } catch (error) {
      return `❌ Error generating weekly report: ${error}`;
    }
  }

  private async generateMonthlyReport(managerId: number): Promise<string> {
    try {
      const { startDate, endDate } = this.getDateRange('lastMonth');
      const report = await this.reportingService.generatePeriodReport(
        managerId,
        startDate,
        endDate,
      );

      // Get trend analysis for last 3 months
      const trendAnalysis = await this.reportingService.generateTrendAnalysis(
        managerId,
        3,
      );

      let content = `📊 Monthly Business Summary\n`;
      content += `🗓️ ${startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}\n\n`;

      content += `💰 Monthly Revenue: Rp ${report.totalIncome.toLocaleString('id-ID')}\n`;
      content += `📈 Daily Average: Rp ${report.averageDaily.toLocaleString('id-ID')}\n`;
      content += `📝 Total Transactions: ${report.totalEntries}\n`;
      content += `👥 Active Employees: ${report.employeeReports.length}\n\n`;

      content += `📈 3-Month Trend: ${trendAnalysis.overallTrend.toUpperCase()} by ${trendAnalysis.trendPercentage}%\n\n`;

      if (report.topPerformers.length > 0) {
        content += `🏆 Monthly Top Performers:\n`;
        report.topPerformers.forEach((emp, idx) => {
          content += `${idx + 1}. ${emp.employee.employee_name}: Rp ${emp.totalIncome.toLocaleString('id-ID')} (${emp.entryCount} transactions)\n`;
        });
        content += '\n';
      }

      // Enhanced insights with error handling
      try {
        // Weather Analysis
        const weatherData = await this.weatherService.getWeatherHistory(
          'Jakarta',
          startDate,
          endDate,
        );
        const weatherInsights = this.weatherService.generateWeatherInsights(
          weatherData,
          'garage',
        );

        content += `🌤️ Monthly Weather Analysis:\n`;
        content += `   ${weatherInsights.weatherImpact}\n`;
        content += `   Recommendation: ${weatherInsights.businessRecommendation}\n\n`;

        // Seasonal Insights
        const seasonalInsights =
          await this.marketResearchService.getSeasonalInsights(
            startDate.getMonth(),
            'automotive garage',
          );

        content += `🌸 Seasonal Market Intelligence (${seasonalInsights.season} season):\n`;
        if (seasonalInsights.trends.length > 0) {
          content += `   Market Trends:\n`;
          seasonalInsights.trends.slice(0, 2).forEach((trend) => {
            content += `   • ${trend}\n`;
          });
        }

        if (seasonalInsights.businessRecommendations.length > 0) {
          content += `   Strategic Recommendations:\n`;
          seasonalInsights.businessRecommendations
            .slice(0, 2)
            .forEach((rec) => {
              content += `   • ${rec}\n`;
            });
        }
        content += '\n';

        // Economic Context
        const economicInsights =
          await this.marketResearchService.getEconomicFactors('indonesia');
        content += `📊 Economic Context:\n`;
        economicInsights.insights.slice(0, 3).forEach((insight) => {
          content += `   • ${insight}\n`;
        });
        content += '\n';
      } catch (error) {
        debug('Error getting enhanced insights for monthly report:', error);
        content += `📊 Enhanced insights temporarily unavailable\n\n`;
      }

      content += `💡 Monthly Insights:\n`;
      report.insights.forEach((insight) => {
        content += `• ${insight}\n`;
      });

      content += `\n🚀 Here's to another successful month ahead!`;
      return content;
    } catch (error) {
      return `❌ Error generating monthly report: ${error}`;
    }
  }

  private async generateYearlyReport(managerId: number): Promise<string> {
    try {
      const { startDate, endDate } = this.getDateRange('lastYear');
      const report = await this.reportingService.generatePeriodReport(
        managerId,
        startDate,
        endDate,
      );

      // Get 12-month trend analysis
      const trendAnalysis = await this.reportingService.generateTrendAnalysis(
        managerId,
        12,
      );

      let content = `🎊 ANNUAL BUSINESS REPORT ${endDate.getFullYear()}\n`;
      content += `🏢 Year in Review\n\n`;

      content += `💰 Annual Revenue: Rp ${report.totalIncome.toLocaleString('id-ID')}\n`;
      content += `📈 Monthly Average: Rp ${(report.totalIncome / 12).toLocaleString('id-ID')}\n`;
      content += `📝 Total Transactions: ${report.totalEntries}\n`;
      content += `👥 Team Size: ${report.employeeReports.length} employees\n\n`;

      content += `📈 Annual Trend: ${trendAnalysis.overallTrend.toUpperCase()} by ${trendAnalysis.trendPercentage}%\n\n`;

      if (report.topPerformers.length > 0) {
        content += `🏆 Annual Top Performers:\n`;
        report.topPerformers.forEach((emp, idx) => {
          content += `${idx + 1}. ${emp.employee.employee_name}: Rp ${emp.totalIncome.toLocaleString('id-ID')} (${emp.entryCount} transactions)\n`;
        });
        content += '\n';
      }

      // Comprehensive market analysis with error handling
      try {
        // Industry Analysis
        const industryInsights =
          await this.marketResearchService.getIndustryInsights(
            'automotive garage',
            'yearly',
          );
        content += `🏭 Industry Intelligence Summary:\n`;
        industryInsights.slice(0, 2).forEach((insight) => {
          if (insight.insights.length > 0) {
            content += `   ${insight.category}:\n`;
            insight.insights.slice(0, 2).forEach((item) => {
              content += `   • ${item}\n`;
            });
          }
        });
        content += '\n';

        // Competitive Landscape
        const competitorAnalysis =
          await this.marketResearchService.analyzeCompetitorTrends(
            'automotive garage',
          );
        content += `🏁 Competitive Landscape:\n`;
        competitorAnalysis.insights.slice(0, 3).forEach((insight) => {
          content += `   • ${insight}\n`;
        });
        content += '\n';

        // Seasonal Analysis
        const seasonalPatterns = await Promise.all([
          this.marketResearchService.getSeasonalInsights(
            11,
            'automotive garage',
          ), // Rainy season
          this.marketResearchService.getSeasonalInsights(
            6,
            'automotive garage',
          ), // Dry season
        ]);

        content += `🌅 Seasonal Business Patterns:\n`;
        content += `   Rainy Season Impact: Higher demand for brake/electrical services\n`;
        content += `   Dry Season Opportunities: Peak AC maintenance period\n`;
        seasonalPatterns.forEach((pattern) => {
          if (pattern.businessRecommendations.length > 0) {
            content += `   ${pattern.season} Strategy: ${pattern.businessRecommendations[0]}\n`;
          }
        });
        content += '\n';

        // Economic Context
        const economicInsights =
          await this.marketResearchService.getEconomicFactors('indonesia');
        content += `📊 Economic Environment:\n`;
        economicInsights.insights.slice(0, 3).forEach((insight) => {
          content += `   • ${insight}\n`;
        });
        content += '\n';
      } catch (error) {
        debug(
          'Error getting comprehensive market analysis for yearly report:',
          error,
        );
        content += `📊 Comprehensive market analysis temporarily unavailable\n\n`;
      }

      content += `💡 Annual Strategic Insights:\n`;
      trendAnalysis.insights.forEach((insight) => {
        content += `• ${insight}\n`;
      });

      content += `\n🎯 Thank you for an amazing year! Here's to continued success in ${new Date().getFullYear()}!\n`;
      content += `\n🔮 Looking ahead: Focus on digital transformation, service quality, and weather-adaptive strategies for sustained growth.`;

      return content;
    } catch (error) {
      return `❌ Error generating yearly report: ${error}`;
    }
  }

  public async sendTestReport(
    telegramUserId: string,
    bot: Telegraf,
  ): Promise<void> {
    try {
      const manager =
        await this.managerService.getManagerByTelegramId(telegramUserId);
      if (!manager) {
        await bot.telegram.sendMessage(
          telegramUserId,
          '❌ No business found. Please register your business first.',
        );
        return;
      }

      const reportContent = await this.generateWeeklyReport(manager.id!);
      const fullReport = `🧪 Manual Test Report\n\n🏢 ${manager.business_name}\n${this.getCurrentDateTime()}\n\n${reportContent}`;

      await bot.telegram.sendMessage(telegramUserId, fullReport);
    } catch (error) {
      debug('Error sending manual test report:', error);
      await bot.telegram.sendMessage(
        telegramUserId,
        '❌ Error generating test report. Please try again.',
      );
    }
  }

  public stopScheduledReports(): void {
    debug('Stopping automated reporting service');

    for (const [key, intervalId] of this.intervals.entries()) {
      clearInterval(intervalId);
      debug(`Stopped ${key} report schedule`);
    }

    this.intervals.clear();
  }

  public updateSchedule(type: string, enabled: boolean): void {
    const schedule = this.schedules.get(type);
    if (schedule) {
      schedule.enabled = enabled;
      debug(`Updated ${type} schedule: enabled=${enabled}`);
    }
  }

  public getScheduleStatus(): ReportSchedule[] {
    return Array.from(this.schedules.values());
  }

  private async getAllManagers(): Promise<
    Array<{ id: number; telegram_user_id: string; business_name: string }>
  > {
    try {
      // Get all managers from the service
      const managers = await this.managerService.getAllManagers();
      return managers.map((manager) => ({
        id: manager.id!,
        telegram_user_id: manager.telegram_user_id,
        business_name: manager.business_name,
      }));
    } catch (error) {
      debug('Error getting all managers:', error);
      return [];
    }
  }

  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
        );
        break;

      case 'thisWeek':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;

      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;

      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;

      default:
        return this.getDateRange('today');
    }

    return { startDate, endDate };
  }

  private getCurrentDateTime(): string {
    return new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'short',
    });
  }
}
