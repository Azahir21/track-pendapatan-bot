import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import { IReportingService } from '../../../business/ReportingService';
import createDebug from 'debug';
import * as fs from 'fs';
import * as path from 'path';

const debug = createDebug('bot:tools:employee-report');

export class GenerateEmployeeReportTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Generate comprehensive employee income reports for specific periods. Use when user asks for employee reports, performance reports, or income summaries for employees. Leave employeeName empty for all employees. Supports both text and CSV formats with detailed daily breakdown.';

  public parameters = z.object({
    employeeName: z
      .string()
      .optional()
      .describe(
        'Specific employee name (optional - leave empty or undefined for all employees)',
      ),
    timeFrame: z
      .string()
      .optional()
      .default('this month')
      .describe(
        'Time frame like "this week", "last month", "2 weeks ago", "last 3 months". Defaults to "this month" if not specified.',
      ),
    format: z
      .enum(['text', 'csv', 'detailed_csv', 'csv_file', 'detailed_csv_file'])
      .optional()
      .default('text')
      .describe(
        'Output format: text for readable format, csv for summary CSV text, detailed_csv for day-by-day CSV text, csv_file for CSV file attachment, detailed_csv_file for detailed CSV file attachment',
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
    timeFrame = 'this month',
    format = 'text',
  }: {
    employeeName?: string;
    timeFrame?: string;
    format?: 'text' | 'csv' | 'detailed_csv' | 'csv_file' | 'detailed_csv_file';
  }): Promise<string> {
    try {
      debug('Generating employee report:', { employeeName, timeFrame, format });

      const manager = await this.managerService.getManagerByTelegramId(
        this.telegramUserId,
      );
      if (!manager) {
        return '❌ No business found. Please register your business first.';
      }

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

      if (format === 'csv_file' || format === 'detailed_csv_file') {
        return this.generateCSVFile(
          reports,
          manager.business_name,
          period,
          startDate,
          endDate,
          format === 'detailed_csv_file',
        );
      }

      if (format === 'detailed_csv') {
        return this.generateDetailedCSVReport(
          reports,
          manager.business_name,
          period,
          startDate,
          endDate,
        );
      }

      if (format === 'csv') {
        return this.generateCSVReport(
          reports,
          manager.business_name,
          period,
          startDate,
          endDate,
        );
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

  private async generateCSVFile(
    reports: any[],
    businessName: string,
    period: string,
    startDate: Date,
    endDate: Date,
    isDetailed: boolean,
  ): Promise<string> {
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = isDetailed
        ? `detailed-employee-report-${timestamp}.csv`
        : `employee-report-${timestamp}.csv`;
      const filePath = path.join(tempDir, fileName);

      let csvContent = '';

      if (isDetailed) {
        csvContent = 'Date,Employee Name,Amount (IDR),Notes,Entry ID\n';

        const allEntries: Array<{
          date: string;
          employeeName: string;
          amount: number;
          notes: string;
          entryId: number;
        }> = [];

        reports.forEach((report) => {
          report.entries.forEach((entry: any) => {
            allEntries.push({
              date: entry.getFormattedDate(),
              employeeName: report.employee.employee_name,
              amount: entry.amount,
              notes: entry.notes || '',
              entryId: entry.id || 0,
            });
          });
        });

        allEntries.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );

        allEntries.forEach((entry) => {
          const notes = entry.notes.replace(/"/g, '""');
          csvContent += `"${entry.date}","${entry.employeeName}",${entry.amount},"${notes}",${entry.entryId}\n`;
        });

        const totalAmount = allEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0,
        );
        const totalEntries = allEntries.length;

        csvContent += `\n"DETAILED SUMMARY","","","",""\n`;
        csvContent += `"Business Name","${businessName}","","",""\n`;
        csvContent += `"Period","${period}","","",""\n`;
        csvContent += `"Date Range","${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}","","",""\n`;
        csvContent += `"Total Employees","${reports.length}","","",""\n`;
        csvContent += `"Total Entries","${totalEntries}","","",""\n`;
        csvContent += `"Total Business Income","${totalAmount}","","",""\n`;

        csvContent += `\n"EMPLOYEE SUMMARY","","","",""\n`;
        csvContent += `"Employee Name","Total Income (IDR)","Entry Count","Daily Average (IDR)",""\n`;
        reports.forEach((report) => {
          csvContent += `"${report.employee.employee_name}",${report.totalIncome},${report.entryCount},${Math.round(report.averageDaily)},""\n`;
        });
      } else {
        csvContent =
          'Employee Name,Total Income (IDR),Total Entries,Daily Average (IDR),Latest Entry Date\n';

        reports.forEach((report) => {
          const latestEntryDate =
            report.entries.length > 0
              ? report.entries[0].getFormattedDate()
              : 'No entries';

          csvContent += `"${report.employee.employee_name}",${report.totalIncome},${report.entryCount},${Math.round(report.averageDaily)},"${latestEntryDate}"\n`;
        });

        const totalIncome = reports.reduce((sum, r) => sum + r.totalIncome, 0);
        const totalEntries = reports.reduce((sum, r) => sum + r.entryCount, 0);

        csvContent += `\n"SUMMARY","","","",""\n`;
        csvContent += `"Business Name","${businessName}","","",""\n`;
        csvContent += `"Period","${period}","","",""\n`;
        csvContent += `"Date Range","${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}","","",""\n`;
        csvContent += `"Total Employees","${reports.length}","","",""\n`;
        csvContent += `"Total Business Income","${totalIncome}","","",""\n`;
        csvContent += `"Total Entries","${totalEntries}","","",""\n`;
      }

      fs.writeFileSync(filePath, csvContent, 'utf8');

      return `📊 ${isDetailed ? 'Detailed ' : ''}Employee Report Generated!\n\n📁 CSV file created: ${fileName}\n📂 File path: ${filePath}\n\n💾 The CSV file contains ${isDetailed ? 'detailed day-by-day entries for each employee' : 'summary data for all employees'} and can be opened in Excel or Google Sheets.\n\n🔄 The file will be sent as an attachment in the next message.`;
    } catch (error) {
      debug('Error generating CSV file:', error);
      return '❌ Error generating CSV file. Please try again.';
    }
  }

  private generateDetailedCSVReport(
    reports: any[],
    businessName: string,
    period: string,
    startDate: Date,
    endDate: Date,
  ): string {
    const csvHeader = 'Date,Employee Name,Amount (IDR),Notes,Entry ID\n';

    const allEntries: Array<{
      date: string;
      employeeName: string;
      amount: number;
      notes: string;
      entryId: number;
    }> = [];

    reports.forEach((report) => {
      report.entries.forEach((entry: any) => {
        allEntries.push({
          date: entry.getFormattedDate(),
          employeeName: report.employee.employee_name,
          amount: entry.amount,
          notes: entry.notes || '',
          entryId: entry.id || 0,
        });
      });
    });

    allEntries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const csvRows = allEntries
      .map((entry) => {
        const notes = entry.notes.replace(/"/g, '""');
        return `"${entry.date}","${entry.employeeName}",${entry.amount},"${notes}",${entry.entryId}`;
      })
      .join('\n');

    const totalAmount = allEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    );
    const totalEntries = allEntries.length;

    const summary = `\n\n"DETAILED SUMMARY","","","",""\n"Business Name","${businessName}","","",""\n"Period","${period}","","",""\n"Date Range","${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}","","",""\n"Total Employees","${reports.length}","","",""\n"Total Entries","${totalEntries}","","",""\n"Total Business Income","${totalAmount}","","",""`;

    let employeeSummary =
      '\n\n"EMPLOYEE SUMMARY","","","",""\n"Employee Name","Total Income (IDR)","Entry Count","Daily Average (IDR)",""\n';
    reports.forEach((report) => {
      employeeSummary += `"${report.employee.employee_name}",${report.totalIncome},${report.entryCount},${Math.round(report.averageDaily)},""\n`;
    });

    return `📊 Detailed Employee Report - CSV Format\n\n\`\`\`csv\n${csvHeader}${csvRows}${summary}${employeeSummary}\n\`\`\`\n\n💾 This detailed CSV includes every daily entry for each employee. You can:\n• Sort by date to see chronological progression\n• Filter by employee name for individual analysis\n• Analyze daily patterns and trends\n• Import into Excel/Google Sheets for advanced analysis`;
  }

  private generateCSVReport(
    reports: any[],
    businessName: string,
    period: string,
    startDate: Date,
    endDate: Date,
  ): string {
    const csvHeader =
      'Employee Name,Total Income (IDR),Total Entries,Daily Average (IDR),Latest Entry Date\n';

    const csvRows = reports
      .map((report) => {
        const latestEntryDate =
          report.entries.length > 0
            ? report.entries[0].getFormattedDate()
            : 'No entries';

        return `"${report.employee.employee_name}",${report.totalIncome},${report.entryCount},${Math.round(report.averageDaily)},"${latestEntryDate}"`;
      })
      .join('\n');

    const totalIncome = reports.reduce((sum, r) => sum + r.totalIncome, 0);
    const totalEntries = reports.reduce((sum, r) => sum + r.entryCount, 0);

    const summary = `\n\n"SUMMARY","","","",""\n"Business Name","${businessName}","","",""\n"Period","${period}","","",""\n"Date Range","${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}","","",""\n"Total Employees","${reports.length}","","",""\n"Total Business Income","${totalIncome}","","",""\n"Total Entries","${totalEntries}","","",""`;

    return `📊 Employee Report - CSV Format\n\n\`\`\`csv\n${csvHeader}${csvRows}${summary}\n\`\`\`\n\n💾 You can copy this CSV data and paste it into Excel or Google Sheets for further analysis.`;
  }
}
