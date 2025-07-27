import { IncomeEntry } from '../../models/IncomeEntry';
import { User } from '../../models/User';
import { Employee } from '../../models/Employee';
import { IIncomeEntryRepository } from '../../repositories/IncomeEntryRepository';
import createDebug from 'debug';

const debug = createDebug('bot:income-service');

export interface IIncomeService {
  recordIncome(
    user: User,
    amount: number,
    notes?: string,
  ): Promise<IncomeEntry>;
  recordIncomeForEmployee(
    employee: Employee,
    amount: number,
    notes?: string,
  ): Promise<IncomeEntry>;
  getTodayIncome(user: User): Promise<{ count: number; total: number }>;
  getTodayIncomeForEmployee(
    employee: Employee,
  ): Promise<{ count: number; total: number }>;
  getMonthlyIncome(
    user: User,
    month?: number,
    year?: number,
  ): Promise<{ count: number; total: number; monthName: string; year: number }>;
  getMonthlyIncomeForEmployee(
    employee: Employee,
    month?: number,
    year?: number,
  ): Promise<{ count: number; total: number; monthName: string; year: number }>;
  getIncomeHistory(user: User, limit?: number): Promise<IncomeEntry[]>;
  getIncomeHistoryForEmployee(
    employee: Employee,
    limit?: number,
  ): Promise<IncomeEntry[]>;
  getBusinessStats(user: User): Promise<{
    today: { count: number; total: number };
    month: { count: number; total: number };
    topServices: Array<{ service_type: string; count: number; total: number }>;
  }>;
  getBusinessStatsForManager(managerId: number): Promise<{
    today: { count: number; total: number };
    month: { count: number; total: number };
    topServices: Array<{ service_type: string; count: number; total: number }>;
  }>;
}

export class IncomeService implements IIncomeService {
  private readonly monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  constructor(private incomeRepository: IIncomeEntryRepository) {}

  public async recordIncome(
    user: User,
    amount: number,
    notes?: string,
  ): Promise<IncomeEntry> {
    try {
      debug('Recording income for user:', user.employee_name);

      const entry = new IncomeEntry(user.id!, amount, notes);
      const createdEntry = await this.incomeRepository.create(entry);

      debug('Income recorded:', createdEntry.id);
      return createdEntry;
    } catch (error) {
      debug('Error recording income:', error);
      throw error;
    }
  }

  public async recordIncomeForEmployee(
    employee: Employee,
    amount: number,
    notes?: string,
  ): Promise<IncomeEntry> {
    try {
      debug('Recording income for employee:', employee.employee_name);

      const entry = new IncomeEntry(employee.id!, amount, notes);
      const createdEntry = await this.incomeRepository.create(entry);

      debug('Income recorded for employee:', createdEntry.id);
      return createdEntry;
    } catch (error) {
      debug('Error recording income for employee:', error);
      throw error;
    }
  }

  public async getTodayIncome(
    user: User,
  ): Promise<{ count: number; total: number }> {
    try {
      return await this.incomeRepository.findTodayByUserId(user.id!);
    } catch (error) {
      debug('Error getting today income:', error);
      throw error;
    }
  }

  public async getTodayIncomeForEmployee(
    employee: Employee,
  ): Promise<{ count: number; total: number }> {
    try {
      return await this.incomeRepository.findTodayByEmployeeId(employee.id!);
    } catch (error) {
      debug('Error getting today income for employee:', error);
      throw error;
    }
  }

  public async getMonthlyIncome(
    user: User,
    month?: number,
    year?: number,
  ): Promise<{
    count: number;
    total: number;
    monthName: string;
    year: number;
  }> {
    try {
      const currentDate = new Date();
      const targetMonth = month || currentDate.getMonth() + 1;
      const targetYear = year || currentDate.getFullYear();

      const result = await this.incomeRepository.findMonthlyByUserId(
        user.id!,
        targetMonth,
        targetYear,
      );

      return {
        ...result,
        monthName: this.monthNames[targetMonth - 1],
        year: targetYear,
      };
    } catch (error) {
      debug('Error getting monthly income:', error);
      throw error;
    }
  }

  public async getIncomeHistory(
    user: User,
    limit: number = 10,
  ): Promise<IncomeEntry[]> {
    try {
      return await this.incomeRepository.findRecentByUserId(user.id!, limit);
    } catch (error) {
      debug('Error getting income history:', error);
      throw error;
    }
  }

  public async getBusinessStats(user: User): Promise<{
    today: { count: number; total: number };
    month: { count: number; total: number };
    topServices: Array<{ service_type: string; count: number; total: number }>;
  }> {
    try {
      const currentDate = new Date();

      const [today, month, topServices] = await Promise.all([
        this.incomeRepository.findTodayByUserId(user.id!),
        this.incomeRepository.findMonthlyByUserId(
          user.id!,
          currentDate.getMonth() + 1,
          currentDate.getFullYear(),
        ),
        this.incomeRepository.getServiceStatsByUserId(user.id!),
      ]);

      return { today, month, topServices };
    } catch (error) {
      debug('Error getting business stats:', error);
      throw error;
    }
  }

  public async getMonthlyIncomeForEmployee(
    employee: Employee,
    month?: number,
    year?: number,
  ): Promise<{
    count: number;
    total: number;
    monthName: string;
    year: number;
  }> {
    try {
      const currentDate = new Date();
      const targetMonth = month || currentDate.getMonth() + 1;
      const targetYear = year || currentDate.getFullYear();

      const result = await this.incomeRepository.findMonthlyByEmployeeId(
        employee.id!,
        targetMonth,
        targetYear,
      );

      return {
        ...result,
        monthName: this.monthNames[targetMonth - 1],
        year: targetYear,
      };
    } catch (error) {
      debug('Error getting monthly income for employee:', error);
      throw error;
    }
  }

  public async getIncomeHistoryForEmployee(
    employee: Employee,
    limit: number = 10,
  ): Promise<IncomeEntry[]> {
    try {
      return await this.incomeRepository.findRecentByEmployeeId(
        employee.id!,
        limit,
      );
    } catch (error) {
      debug('Error getting income history for employee:', error);
      throw error;
    }
  }

  public async getBusinessStatsForManager(managerId: number): Promise<{
    today: { count: number; total: number };
    month: { count: number; total: number };
    topServices: Array<{ service_type: string; count: number; total: number }>;
  }> {
    try {
      const currentDate = new Date();

      const allEntries = await this.incomeRepository.findByManagerId(managerId);

      const today = {
        count: 0,
        total: 0,
      };

      const todayStr = currentDate.toISOString().split('T')[0];
      const todayEntries = allEntries.filter(
        (entry) =>
          entry.date && entry.date.toISOString().split('T')[0] === todayStr,
      );

      today.count = todayEntries.length;
      today.total = todayEntries.reduce((sum, entry) => sum + entry.amount, 0);

      const month = {
        count: 0,
        total: 0,
      };

      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const monthEntries = allEntries.filter((entry) => {
        if (!entry.date) return false;
        const entryDate = new Date(entry.date);
        return (
          entryDate.getMonth() + 1 === currentMonth &&
          entryDate.getFullYear() === currentYear
        );
      });

      month.count = monthEntries.length;
      month.total = monthEntries.reduce((sum, entry) => sum + entry.amount, 0);

      const topServices =
        await this.incomeRepository.getServiceStatsByManagerId(managerId);

      return { today, month, topServices };
    } catch (error) {
      debug('Error getting business stats for manager:', error);
      throw error;
    }
  }
}
