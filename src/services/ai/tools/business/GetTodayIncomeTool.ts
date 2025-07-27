import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IUserService } from '../../../business/UserService';
import { IIncomeService } from '../../../business/IncomeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:today-income');

export class GetTodayIncomeTool extends BaseTool {
  public description =
    "Get today's total income from the TrackPendapatanBot database";
  public parameters = z.object({});

  constructor(
    private userService: IUserService,
    private incomeService: IIncomeService,
    private userId: string,
  ) {
    super();
  }

  public async execute(): Promise<string> {
    try {
      const user = await this.userService.getOrCreateUser(this.userId);
      if (!user) {
        return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
      }

      const todayIncome = await this.incomeService.getTodayIncome(user);
      const todayFormatted = this.formatDate();

      return `📊 Today's Income Summary (${todayFormatted})\n🏪 TrackPendapatanBot - Garage Business\n\nEmployee: ${user.employee_name}\nTotal Entries: ${todayIncome.count}\nTotal Income: ${this.formatCurrency(todayIncome.total)}\n\n💡 Keep up the great work!`;
    } catch (error) {
      debug('Error getting today income:', error);
      return "Error retrieving today's income. Please try again.";
    }
  }
}
