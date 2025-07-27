import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import { IEmployeeService } from '../../../business/EmployeeService';
import { IIncomeService } from '../../../business/IncomeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:get-business-info');

export class GetBusinessInfoTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Get complete business information including business details, employee count, and basic statistics. Use when user asks about their business info or business details.';

  public parameters = z.object({});

  constructor(
    private readonly managerService: IManagerService,
    private readonly employeeService: IEmployeeService,
    private readonly incomeService: IIncomeService,
    private readonly telegramUserId: string,
  ) {
    super();
  }

  public async execute(): Promise<string> {
    try {
      debug('Getting business info for user:', this.telegramUserId);

      const manager = await this.managerService.getManagerByTelegramId(
        this.telegramUserId,
      );

      if (!manager) {
        return `❌ No Business Found!\n\nYou don't have a registered business yet. Use the registerBusiness tool to create your garage business first.\n\n🚀 To get started:\n1. Register your business with a name\n2. Add employees to your team\n3. Start tracking daily income`;
      }

      const employees = await this.employeeService.getEmployeesByManager(
        manager.id!,
      );
      const employeeCount = employees.length;

      let todayStats = 'No income recorded today';
      try {
        const today = new Date().toISOString().split('T')[0];
        todayStats = 'Income data available - use getTodayIncome for details';
      } catch (error) {
        debug('Error getting today stats:', error);
      }

      return `🏢 Business Information\n\n📊 ${manager.business_name}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 Manager: You (${this.telegramUserId})\n📅 Registered: ${new Date(manager.created_at!).toLocaleDateString('id-ID')}\n👥 Total Employees: ${employeeCount}\n📈 Status: Active\n\n💼 Business Overview:\n• Business Type: Garage/Automotive Service\n• System: TrackPendapatanBot\n• Account Limit: 1 business per account\n\n👥 Team Members:\n${
        employees.length > 0
          ? employees
              .map((emp, idx) => `${idx + 1}. ${emp.employee_name}`)
              .join('\n')
          : 'No employees registered yet'
      }\n\n📊 Quick Stats:\n• ${todayStats}\n• Use business statistics tool for detailed reports\n\n🛠️ Available Actions:\n• Register employees\n• Record daily income\n• View detailed statistics\n• Update business name`;
    } catch (error) {
      debug('Error getting business info:', error);
      return '❌ Error retrieving business information. Please try again.';
    }
  }
}
