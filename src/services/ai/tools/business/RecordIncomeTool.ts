import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import { IEmployeeService } from '../../../business/EmployeeService';
import { IIncomeService } from '../../../business/IncomeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:record-income');

export class RecordIncomeTool extends BaseTool {
  public description =
    'Record daily income summary for an employee in the TrackPendapatanBot database. Each employee can have only one record per day - this represents their total daily income.';
  public parameters = z.object({
    employeeName: z
      .string()
      .describe('Name of the employee who earned the income'),
    amount: z.number().describe('Total daily income amount in IDR'),
    notes: z
      .string()
      .optional()
      .describe('Additional notes about the daily income summary'),
  });

  constructor(
    private managerService: IManagerService,
    private employeeService: IEmployeeService,
    private incomeService: IIncomeService,
    private telegramUserId: string,
  ) {
    super();
  }

  public async execute({
    employeeName,
    amount,
    notes,
  }: {
    employeeName: string;
    amount: number;
    notes?: string;
  }): Promise<string> {
    try {
      const manager = await this.managerService.getManagerByTelegramId(
        this.telegramUserId,
      );
      if (!manager) {
        return 'No business found. Please register an employee first to create your business.';
      }

      const employee = await this.employeeService.getOrCreateEmployee(
        manager.id!,
        employeeName,
      );

      const entry = await this.incomeService.recordIncomeForEmployee(
        employee,
        amount,
        notes,
      );

      const currentDate = this.formatDate();
      const isUpdate =
        entry.created_at &&
        entry.created_at.toDateString() !== new Date().toDateString();

      return `✅ Daily income ${isUpdate ? 'updated' : 'recorded'} successfully in TrackPendapatanBot!\n\nID: ${entry.id}\nDate: ${currentDate}\nEmployee: ${employeeName}\nDaily Total: ${entry.getFormattedAmount()}\nBusiness: ${manager.business_name}\nNotes: ${notes || 'None'}\n\n${isUpdate ? "📝 Today's income summary has been updated!" : '💰 Daily income summary recorded!'}\n\n⚠️ Note: Each employee can only have one daily summary record per day.`;
    } catch (error) {
      debug('Error recording income:', error);
      if (error instanceof Error && error.message.includes('duplicate')) {
        return "Today's income summary has already been recorded for this employee. Each employee can only have one daily summary record per day.";
      }
      return 'Error recording daily income summary. Please try again.';
    }
  }
}
