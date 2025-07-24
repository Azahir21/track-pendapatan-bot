import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import { IReportingService } from '../../../business/ReportingService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:employee-report');

export class GenerateEmployeeReportTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Generate comprehensive employee income reports for specific periods. Use when user asks for employee reports, performance reports, or income summaries for employees. Leave employeeName empty for all employees.';

  public parameters = z.object({
    employeeName: z
      .string()
      .optional()
      .describe(
        'Specific employee name (optional - leave empty or undefined for all employees)',
      ),
    timeFrame: z
      .string()
      .describe(
        'Time frame like "this week", "last month", "2 weeks ago", "last 3 months"',
      ),
  });

  constructor(
    private readonly managerService: IManagerService,
    private readonly reportingService: IReportingService,
    private readonly telegramUserId: string,
  ) {
    super();
  }

  public async execute({
    employeeName,
    timeFrame,
  }: {
    employeeName?: string;
    timeFrame: string;
  }): Promise<string> {
    try {
      debug('Generating employee report:', { employeeName, timeFrame });

      const manager = await this.managerService.getManagerByTelegramId(
        this.telegramUserId,
      );
      if (!manager) {
        return '❌ No business found. Please register your business first.';
      }

      // Handle empty string or undefined employeeName
      const targetEmployeeName =
        employeeName && employeeName.trim() !== ''
          ? employeeName.trim()
          : undefined;

      const { startDate, endDate, period } =
        this.reportingService.parseTimeFrame(timeFrame);

      const reports = await this.reportingService.generateEmployeeReport(
        manager.id!,
        targetEmployeeName,
        startDate,
        endDate,
      );

      if (reports.length === 0) {
        return `📊 No employees found${targetEmployeeName ? ` matching "${targetEmployeeName}"` : ''} for ${period}.`;
      }

      let reportText = `📊 Employee Income Report - ${manager.business_name}\n`;
      reportText += `📅 Period: ${period}\n`;
      reportText += `🗓️ Date Range: ${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}\n\n`;

      if (targetEmployeeName) {
        reportText += `👤 Employee: ${targetEmployeeName}\n\n`;
      } else {
        reportText += `👥 Total Employees: ${reports.length}\n\n`;
      }

      reports.forEach((report, index) => {
        reportText += `${index + 1}. ${report.employee.employee_name}\n`;
        reportText += `   💰 Total Income: ${this.formatCurrency(report.totalIncome)}\n`;
        reportText += `   📝 Total Entries: ${report.entryCount}\n`;
        reportText += `   📈 Daily Average: ${this.formatCurrency(report.averageDaily)}\n`;

        if (report.entries.length > 0) {
          const latestEntry = report.entries[0];
          reportText += `   📅 Latest Entry: ${latestEntry.getFormattedDate()}\n`;
        }
        reportText += '\n';
      });

      const totalIncome = reports.reduce((sum, r) => sum + r.totalIncome, 0);
      const totalEntries = reports.reduce((sum, r) => sum + r.entryCount, 0);

      reportText += `💼 Summary:\n`;
      reportText += `   Total Business Income: ${this.formatCurrency(totalIncome)}\n`;
      reportText += `   Total Entries: ${totalEntries}\n`;
      reportText += `   Average per Employee: ${this.formatCurrency(reports.length > 0 ? totalIncome / reports.length : 0)}\n`;

      if (reports.length > 1) {
        const topPerformer = reports[0];
        reportText += `   🏆 Top Performer: ${topPerformer.employee.employee_name} (${this.formatCurrency(topPerformer.totalIncome)})\n`;
      }

      return reportText;
    } catch (error) {
      debug('Error generating employee report:', error);
      return '❌ Error generating employee report. Please try again.';
    }
  }
}
