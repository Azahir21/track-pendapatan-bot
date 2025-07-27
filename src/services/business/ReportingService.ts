import { IEmployeeService } from './EmployeeService';
import { IIncomeService } from './IncomeService';
import { IManagerService } from './ManagerService';
import { Employee } from '../../models/Employee';
import { IncomeEntry } from '../../models/IncomeEntry';
import createDebug from 'debug';

const debug = createDebug('bot:reporting-service');

export interface EmployeeReport {
  employee: Employee;
  totalIncome: number;
  entryCount: number;
  averageDaily: number;
  entries: IncomeEntry[];
}

export interface PeriodReport {
  period: string;
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  totalEntries: number;
  averageDaily: number;
  employeeReports: EmployeeReport[];
  topPerformers: EmployeeReport[];
  insights: string[];
}

export interface TrendAnalysis {
  periods: Array<{
    period: string;
    totalIncome: number;
    entryCount: number;
    averageDaily: number;
  }>;
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  insights: string[];
}

export interface IReportingService {
  generateEmployeeReport(
    managerId: number,
    employeeName?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<EmployeeReport[]>;

  generatePeriodReport(
    managerId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<PeriodReport>;

  generateTrendAnalysis(
    managerId: number,
    months: number,
  ): Promise<TrendAnalysis>;

  parseTimeFrame(query: string): {
    startDate: Date;
    endDate: Date;
    period: string;
  };
}

export class ReportingService implements IReportingService {
  constructor(
    private employeeService: IEmployeeService,
    private incomeService: IIncomeService,
    private managerService: IManagerService,
  ) {}

  public async generateEmployeeReport(
    managerId: number,
    employeeName?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<EmployeeReport[]> {
    debug('Generating employee report for manager:', managerId);

    const employees =
      await this.employeeService.getEmployeesByManager(managerId);
    const targetEmployees = employeeName
      ? employees.filter((emp) =>
          emp.employee_name.toLowerCase().includes(employeeName.toLowerCase()),
        )
      : employees;

    const reports: EmployeeReport[] = [];

    for (const employee of targetEmployees) {
      const entries = await this.getEntriesInPeriod(
        employee.id!,
        startDate,
        endDate,
      );
      const totalIncome = entries.reduce((sum, entry) => sum + entry.amount, 0);
      const entryCount = entries.length;

      const daysDiff =
        startDate && endDate
          ? Math.ceil(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
            )
          : 30;

      const averageDaily = daysDiff > 0 ? totalIncome / daysDiff : 0;

      reports.push({
        employee,
        totalIncome,
        entryCount,
        averageDaily,
        entries,
      });
    }

    return reports.sort((a, b) => b.totalIncome - a.totalIncome);
  }

  public async generatePeriodReport(
    managerId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<PeriodReport> {
    debug('Generating period report from', startDate, 'to', endDate);

    const employeeReports = await this.generateEmployeeReport(
      managerId,
      undefined,
      startDate,
      endDate,
    );

    const totalIncome = employeeReports.reduce(
      (sum, report) => sum + report.totalIncome,
      0,
    );
    const totalEntries = employeeReports.reduce(
      (sum, report) => sum + report.entryCount,
      0,
    );

    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const averageDaily = daysDiff > 0 ? totalIncome / daysDiff : 0;

    const topPerformers = employeeReports.slice(0, 5);

    const insights = this.generateInsights(employeeReports, daysDiff);

    return {
      period: this.formatPeriod(startDate, endDate),
      startDate,
      endDate,
      totalIncome,
      totalEntries,
      averageDaily,
      employeeReports,
      topPerformers,
      insights,
    };
  }

  public async generateTrendAnalysis(
    managerId: number,
    months: number,
  ): Promise<TrendAnalysis> {
    debug('Generating trend analysis for', months, 'months');

    const periods: Array<{
      period: string;
      totalIncome: number;
      entryCount: number;
      averageDaily: number;
    }> = [];

    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const endDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i + 1,
        0,
      );
      const startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1,
      );

      const report = await this.generatePeriodReport(
        managerId,
        startDate,
        endDate,
      );

      periods.push({
        period: this.formatMonth(startDate),
        totalIncome: report.totalIncome,
        entryCount: report.totalEntries,
        averageDaily: report.averageDaily,
      });
    }

    const { trend, percentage } = this.calculateTrend(periods);
    const insights = this.generateTrendInsights(periods, trend, percentage);

    return {
      periods,
      overallTrend: trend,
      trendPercentage: percentage,
      insights,
    };
  }

  public parseTimeFrame(query: string): {
    startDate: Date;
    endDate: Date;
    period: string;
  } {
    const currentDate = new Date();
    const queryLower = query.toLowerCase();

    if (queryLower.includes('this week')) {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return {
        startDate: startOfWeek,
        endDate: endOfWeek,
        period: 'This Week',
      };
    }

    if (queryLower.includes('last week')) {
      const startOfLastWeek = new Date(currentDate);
      startOfLastWeek.setDate(currentDate.getDate() - currentDate.getDay() - 7);
      const endOfLastWeek = new Date(startOfLastWeek);
      endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);

      return {
        startDate: startOfLastWeek,
        endDate: endOfLastWeek,
        period: 'Last Week',
      };
    }

    const weeksAgoMatch = queryLower.match(/(\d+)\s*weeks?\s*ago/);
    if (weeksAgoMatch) {
      const weeksAgo = parseInt(weeksAgoMatch[1]);
      const startDate = new Date(currentDate);
      startDate.setDate(
        currentDate.getDate() - weeksAgo * 7 - currentDate.getDay(),
      );
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      return {
        startDate,
        endDate,
        period: `${weeksAgo} Week${weeksAgo > 1 ? 's' : ''} Ago`,
      };
    }

    if (queryLower.includes('this month')) {
      const startOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );
      const endOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      );

      return {
        startDate: startOfMonth,
        endDate: endOfMonth,
        period: 'This Month',
      };
    }

    if (queryLower.includes('last month')) {
      const startOfLastMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        0,
      );

      return {
        startDate: startOfLastMonth,
        endDate: endOfLastMonth,
        period: 'Last Month',
      };
    }

    const monthsMatch = queryLower.match(/last\s*(\d+)\s*months?/);
    if (monthsMatch) {
      const monthsBack = parseInt(monthsMatch[1]);
      const startDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - monthsBack,
        1,
      );
      const endDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      );

      return {
        startDate,
        endDate,
        period: `Last ${monthsBack} Month${monthsBack > 1 ? 's' : ''}`,
      };
    }

    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    return {
      startDate: startOfMonth,
      endDate: endOfMonth,
      period: 'This Month',
    };
  }

  private async getEntriesInPeriod(
    employeeId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<IncomeEntry[]> {
    const allEntries = await this.incomeService.getIncomeHistoryForEmployee(
      { id: employeeId } as Employee,
      1000,
    );

    if (!startDate || !endDate) {
      return allEntries;
    }

    return allEntries.filter((entry) => {
      if (!entry.date) return false;
      const entryDate = new Date(entry.date);
      return entryDate >= startDate && entryDate <= endDate;
    });
  }

  private generateInsights(
    reports: EmployeeReport[],
    daysPeriod: number,
  ): string[] {
    const insights: string[] = [];

    if (reports.length === 0) {
      insights.push('No employee data available for this period');
      return insights;
    }

    const topPerformer = reports[0];
    const averageIncome =
      reports.reduce((sum, r) => sum + r.totalIncome, 0) / reports.length;

    insights.push(
      `Top performer: ${topPerformer.employee.employee_name} with ${this.formatCurrency(topPerformer.totalIncome)}`,
    );
    insights.push(
      `Average income per employee: ${this.formatCurrency(averageIncome)}`,
    );

    const activeEmployees = reports.filter((r) => r.entryCount > 0).length;
    const inactiveEmployees = reports.length - activeEmployees;

    if (inactiveEmployees > 0) {
      insights.push(
        `${inactiveEmployees} employee${inactiveEmployees > 1 ? 's' : ''} had no income entries in this period`,
      );
    }

    if (daysPeriod >= 7) {
      const weeklyAverage =
        reports.reduce((sum, r) => sum + r.totalIncome, 0) / (daysPeriod / 7);
      insights.push(
        `Weekly average income: ${this.formatCurrency(weeklyAverage)}`,
      );
    }

    return insights;
  }

  private calculateTrend(periods: Array<{ totalIncome: number }>): {
    trend: 'increasing' | 'decreasing' | 'stable';
    percentage: number;
  } {
    if (periods.length < 2) {
      return { trend: 'stable', percentage: 0 };
    }

    const firstPeriod = periods[0].totalIncome;
    const lastPeriod = periods[periods.length - 1].totalIncome;

    if (firstPeriod === 0 && lastPeriod === 0) {
      return { trend: 'stable', percentage: 0 };
    }

    if (firstPeriod === 0) {
      return { trend: 'increasing', percentage: 100 };
    }

    const percentage = ((lastPeriod - firstPeriod) / firstPeriod) * 100;

    if (Math.abs(percentage) < 5) {
      return {
        trend: 'stable',
        percentage: Math.round(percentage * 100) / 100,
      };
    }

    return {
      trend: percentage > 0 ? 'increasing' : 'decreasing',
      percentage: Math.round(Math.abs(percentage) * 100) / 100,
    };
  }

  private generateTrendInsights(
    periods: Array<{ period: string; totalIncome: number }>,
    trend: string,
    percentage: number,
  ): string[] {
    const insights: string[] = [];

    const totalIncome = periods.reduce((sum, p) => sum + p.totalIncome, 0);
    const averageMonthly = totalIncome / periods.length;

    insights.push(`Overall trend: ${trend} by ${percentage}%`);
    insights.push(
      `Average monthly income: ${this.formatCurrency(averageMonthly)}`,
    );

    const bestMonth = periods.reduce((max, p) =>
      p.totalIncome > max.totalIncome ? p : max,
    );
    const worstMonth = periods.reduce((min, p) =>
      p.totalIncome < min.totalIncome ? p : min,
    );

    insights.push(
      `Best performing month: ${bestMonth.period} (${this.formatCurrency(bestMonth.totalIncome)})`,
    );
    insights.push(
      `Lowest performing month: ${worstMonth.period} (${this.formatCurrency(worstMonth.totalIncome)})`,
    );

    return insights;
  }

  private formatPeriod(startDate: Date, endDate: Date): string {
    const start = startDate.toLocaleDateString('id-ID');
    const end = endDate.toLocaleDateString('id-ID');
    return `${start} - ${end}`;
  }

  private formatMonth(date: Date): string {
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
  }

  private formatCurrency(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }
}
