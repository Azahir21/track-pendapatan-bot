import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IUserService } from '../../../business/UserService';
import { IIncomeService } from '../../../business/IncomeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:income-history');

export class GetIncomeHistoryTool extends BaseTool {
  public description =
    'Get recent income history from the TrackPendapatanBot database';
  public parameters = z.object({
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe('Number of recent entries to retrieve (default: 10)'),
  });

  constructor(
    private userService: IUserService,
    private incomeService: IIncomeService,
    private userId: string,
  ) {
    super();
  }

  public async execute({ limit = 10 }: { limit?: number }): Promise<string> {
    try {
      const user = await this.userService.getOrCreateUser(this.userId);
      if (!user) {
        return 'You need to register as an employee first. Use the registerEmployee tool with your name.';
      }

      const entries = await this.incomeService.getIncomeHistory(user, limit);

      if (entries.length === 0) {
        return 'No income entries found in TrackPendapatanBot. Start recording your daily income summaries!';
      }

      let historyText = `📋 Daily Income History (Last ${entries.length} entries)\n🏪 TrackPendapatanBot - Garage Business\n\nEmployee: ${user.employee_name}\n\n`;

      entries.forEach((entry, index) => {
        historyText += `${index + 1}. ${entry.getFormattedDate()}\n`;
        historyText += `   💰 Daily Total: ${entry.getFormattedAmount()}\n`;
        if (entry.notes) {
          historyText += `   📝 Notes: ${entry.notes}\n`;
        }
        historyText += '\n';
      });

      const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
      historyText += `💵 Grand Total: ${this.formatCurrency(totalAmount)}`;

      return historyText;
    } catch (error) {
      debug('Error getting income history:', error);
      return 'Error retrieving income history. Please try again.';
    }
  }
}
