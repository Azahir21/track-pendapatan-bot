import { z } from 'zod';
import { BaseTool } from '../BaseTool';
import { IManagerService } from '../../../business/ManagerService';
import { IEmployeeService } from '../../../business/EmployeeService';
import createDebug from 'debug';

const debug = createDebug('bot:tools:register-employee');

export class RegisterEmployeeTool extends BaseTool {
  public description =
    'REQUIRED TOOL: Use this to register/add any new employee when user mentions registering, adding, or creating employees. Always use this for employee registration requests.';
  public parameters = z.object({
    employeeName: z
      .string()
      .describe('Full name of the employee to register in the garage business'),
  });

  constructor(
    private managerService: IManagerService,
    private employeeService: IEmployeeService,
    private telegramUserId: string,
  ) {
    super();
  }

  public async execute({
    employeeName,
  }: {
    employeeName: string;
  }): Promise<string> {
    try {
      debug('Attempting to register employee:', employeeName);

      const manager = await this.managerService.getOrCreateManager(
        this.telegramUserId,
      );

      const newEmployee = await this.employeeService.getOrCreateEmployee(
        manager.id!,
        employeeName,
      );

      return `✅ Employee registered successfully in TrackPendapatanBot!\n\nEmployee: ${employeeName}\nEmployee ID: ${newEmployee.id}\nBusiness: ${manager.business_name}\nManager: ${this.telegramUserId}\nSchema: TrackPendapatanBot\n\nThe employee can now record one income entry per day for garage services.`;
    } catch (error) {
      debug('Error registering employee:', error);
      return 'Error registering employee. Please check your database configuration and try again.';
    }
  }
}
