// src/services/ai/tools/business/GetBusinessStatsTool.ts
import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IUserService } from '../../../business/UserService';
import { IIncomeService } from '../../../business/IncomeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:business-stats');

export class GetBusinessStatsTool extends BaseTool {
  public description =
    'Get comprehensive business statistics from TrackPendapatanBot';
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

      const stats = await this.incomeService.getBusinessStats(user);

      let statsText = `📊 Business Statistics - TrackPendapatanBot\n🏪 Garage Business Dashboard\n\nEmployee: ${user.employee_name}\n\n`;

      statsText += `📅 Today:\n`;
      statsText += `   Transactions: ${stats.today.count}\n`;
      statsText += `   Revenue: ${this.formatCurrency(stats.today.total)}\n\n`;

      statsText += `📆 This Month:\n`;
      statsText += `   Transactions: ${stats.month.count}\n`;
      statsText += `   Revenue: ${this.formatCurrency(stats.month.total)}\n\n`;

      if (stats.topServices.length > 0) {
        statsText += `🔧 Top Services:\n`;
        stats.topServices.forEach((service, index) => {
          statsText += `   ${index + 1}. ${service.service_type}: ${service.count} jobs, ${this.formatCurrency(service.total)}\n`;
        });
      }

      return statsText;
    } catch (error) {
      debug('Error getting business stats:', error);
      return 'Error retrieving business statistics. Please try again.';
    }
  }
}
