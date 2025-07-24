// src/services/ai/tools/business/ListEmployeesTool.ts
import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import { IEmployeeService } from '../../../business/EmployeeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:list-employees');

export class ListEmployeesTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Use this to list/show/get all employees when user asks for employee lists, employee data, or wants to see registered employees. Always use this for employee listing requests.';
  public parameters = z.object({});

  constructor(
    private managerService: IManagerService,
    private employeeService: IEmployeeService,
    private telegramUserId: string,
  ) {
    super();
  }

  public async execute(): Promise<string> {
    try {
      debug('Listing employees for telegram user:', this.telegramUserId);

      // Get manager
      const manager = await this.managerService.getManagerByTelegramId(
        this.telegramUserId,
      );
      if (!manager) {
        return 'No business found. Please register an employee first to create your business.';
      }

      // Get all employees
      const employees = await this.employeeService.getEmployeesByManager(
        manager.id!,
      );

      if (employees.length === 0) {
        return `Business: ${manager.business_name}\n\nNo employees registered yet. Use the registerEmployee tool to add employees to your garage business.`;
      }

      let message = `🏢 Business: ${manager.business_name}\n👥 Employees (${employees.length}):\n\n`;

      employees.forEach((employee, index) => {
        message += `${index + 1}. ${employee.employee_name} (ID: ${employee.id})\n`;
      });

      message += `\nEach employee can record one income entry per day.`;

      return message;
    } catch (error) {
      debug('Error listing employees:', error);
      return 'Error retrieving employees list. Please try again.';
    }
  }
}
