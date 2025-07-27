import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IAutomatedReportingService } from '../../../automation/AutomatedReportingService';
import { Telegraf } from 'telegraf';
import createDebug from 'debug';

const debug = createDebug('bot:tools:manage-schedule');

export class ManageReportScheduleTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Manage automated report schedules. Use when user wants to enable/disable automatic reports, check schedule status, or send test reports.';

  public parameters = z.object({
    action: z
      .enum(['status', 'enable', 'disable', 'test'])
      .describe(
        'Action to perform: status (check schedules), enable/disable (specific report type), test (send test report)',
      ),
    reportType: z
      .enum(['test', 'weekly', 'monthly', 'yearly'])
      .optional()
      .describe(
        'Type of report to enable/disable (required for enable/disable actions)',
      ),
  });

  constructor(
    private readonly automatedReportingService: IAutomatedReportingService,
    private readonly telegramUserId: string,
    private readonly bot?: Telegraf,
  ) {
    super();
  }

  public async execute({
    action,
    reportType,
  }: {
    action: 'status' | 'enable' | 'disable' | 'test';
    reportType?: 'test' | 'weekly' | 'monthly' | 'yearly';
  }): Promise<string> {
    try {
      debug('Managing report schedule:', { action, reportType });

      switch (action) {
        case 'status':
          return this.getScheduleStatus();

        case 'enable':
        case 'disable':
          if (!reportType) {
            return '❌ Report type is required for enable/disable actions.';
          }
          return this.updateSchedule(reportType, action === 'enable');

        case 'test':
          return await this.sendTestReport();

        default:
          return '❌ Invalid action. Use: status, enable, disable, or test.';
      }
    } catch (error) {
      debug('Error managing report schedule:', error);
      return '❌ Error managing report schedule. Please try again.';
    }
  }

  private getScheduleStatus(): string {
    const schedules = this.automatedReportingService.getScheduleStatus();

    let statusText = `📋 Automated Report Schedule Status\n\n`;

    schedules.forEach((schedule) => {
      const status = schedule.enabled ? '✅ Enabled' : '❌ Disabled';
      statusText += `${this.getScheduleIcon(schedule.type)} ${schedule.type.toUpperCase()} Reports\n`;
      statusText += `   Status: ${status}\n`;
      statusText += `   ${schedule.description}\n\n`;
    });

    statusText += `💡 Use "enable/disable [reportType]" to change settings\n`;
    statusText += `🧪 Use "test report" to send a test report immediately`;

    return statusText;
  }

  private updateSchedule(reportType: string, enabled: boolean): string {
    this.automatedReportingService.updateSchedule(reportType, enabled);

    const action = enabled ? 'enabled' : 'disabled';
    const icon = this.getScheduleIcon(reportType);

    return `${enabled ? '✅' : '❌'} ${icon} ${reportType.toUpperCase()} reports have been ${action}!\n\n${this.getScheduleDescription(
      reportType,
    )}\n\n💡 Changes will take effect on the next scheduled run.`;
  }

  private async sendTestReport(): Promise<string> {
    try {
      debug('Sending immediate test report for user:', this.telegramUserId);

      if (this.bot) {
        await this.automatedReportingService.sendTestReport(
          this.telegramUserId,
          this.bot,
        );
        return `🧪 Test Report Sent Successfully!\n\n📊 Check your messages - you should have received a detailed test report with your current business data.\n\n⏱️ The report includes today's income, active employees, and quick business insights.`;
      } else {
        return `🧪 Test report generated!\n\n📊 Report content would be sent here, but bot instance not available for direct sending.\n\n💡 Try using the automated test reports that run every 3 minutes in development mode.`;
      }
    } catch (error) {
      debug('Error sending test report:', error);
      return `❌ Error sending test report: ${
        error instanceof Error ? error.message : 'Unknown error'
      }\n\n💡 Please ensure your business is registered and try again.`;
    }
  }

  private getScheduleIcon(type: string): string {
    switch (type) {
      case 'test':
        return '🧪';
      case 'weekly':
        return '📊';
      case 'monthly':
        return '📈';
      case 'yearly':
        return '🎊';
      default:
        return '📋';
    }
  }

  private getScheduleDescription(type: string): string {
    switch (type) {
      case 'test':
        return '🧪 Test reports are sent every 3 minutes (development only)';
      case 'weekly':
        return '📊 Weekly reports are sent every Friday at 5 PM (Jakarta time)';
      case 'monthly':
        return '📈 Monthly reports are sent on the 1st of every month at 9 AM';
      case 'yearly':
        return '🎊 Yearly reports are sent on January 1st at 10 AM';
      default:
        return '';
    }
  }
}
