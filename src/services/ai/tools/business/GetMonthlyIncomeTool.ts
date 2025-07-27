import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IUserService } from '../../../business/UserService';
import { IIncomeService } from '../../../business/IncomeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:monthly-income');

export class GetMonthlyIncomeTool extends BaseTool {
  public description =
    'Get monthly total income from the TrackPendapatanBot database';
  public parameters = z.object({
    month: z
      .number()
      .min(1)
      .max(12)
      .optional()
      .describe('Month number (1-12), defaults to current month'),
    year: z.number().optional().describe('Year, defaults to current year'),
  });

  constructor(
    private userService: IUserService,
    private incomeService: IIncomeService,
    private userId: string,
  ) {
    super();
  }

  public async execute({
    month,
    year,
  }: {
    month?: number;
    year?: number;
  }): Promise<string> {
    try {
      const user = await this.userService.getOrCreateUser(this.userId);
      if (!user) {
        return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
      }

      const monthlyIncome = await this.incomeService.getMonthlyIncome(
        user,
        month,
        year,
      );

      return `📊 Monthly Income Summary\n🏪 TrackPendapatanBot - Garage Business\n\nEmployee: ${user.employee_name}\nMonth: ${monthlyIncome.monthName} ${monthlyIncome.year}\nTotal Entries: ${monthlyIncome.count}\nTotal Income: ${this.formatCurrency(monthlyIncome.total)}\n\n📈 Track your business growth!`;
    } catch (error) {
      debug('Error getting monthly income:', error);
      return 'Error retrieving monthly income. Please try again.';
    }
  }
}
