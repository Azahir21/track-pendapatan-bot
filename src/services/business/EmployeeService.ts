import { IEmployeeRepository } from '../../repositories/EmployeeRepository';
import { Employee } from '../../models/Employee';
import createDebug from 'debug';

const debug = createDebug('bot:employee-service');

export interface IEmployeeService {
  getEmployeesByManager(managerId: number): Promise<Employee[]>;
  getOrCreateEmployee(
    managerId: number,
    employeeName: string,
  ): Promise<Employee>;
  getEmployeeById(employeeId: number): Promise<Employee | null>;
  updateEmployee(
    employeeId: number,
    employeeName: string,
  ): Promise<Employee | null>;
  deleteEmployee(employeeId: number): Promise<boolean>;
}

export class EmployeeService implements IEmployeeService {
  constructor(private employeeRepository: IEmployeeRepository) {}

  public async getEmployeesByManager(managerId: number): Promise<Employee[]> {
    debug('Getting employees for manager:', managerId);
    const employees = await this.employeeRepository.findByManagerId(managerId);
    debug('Found', employees.length, 'employees');
    return employees;
  }

  public async getOrCreateEmployee(
    managerId: number,
    employeeName: string,
  ): Promise<Employee> {
    debug(
      'Getting or creating employee:',
      employeeName,
      'for manager:',
      managerId,
    );

    let employee = await this.employeeRepository.findByManagerIdAndName(
      managerId,
      employeeName,
    );

    if (!employee) {
      debug('Employee not found, creating new employee');
      employee = await this.employeeRepository.create({
        manager_id: managerId,
        employee_name: employeeName,
      });
      debug('Employee created:', employee.employee_name);
    } else {
      debug('Employee found:', employee.employee_name);
    }

    return employee;
  }

  public async getEmployeeById(employeeId: number): Promise<Employee | null> {
    debug('Getting employee by ID:', employeeId);
    return await this.employeeRepository.findById(employeeId);
  }

  public async updateEmployee(
    employeeId: number,
    employeeName: string,
  ): Promise<Employee | null> {
    debug('Updating employee:', employeeId, 'with name:', employeeName);

    const employee = await this.employeeRepository.update(employeeId, {
      employee_name: employeeName,
    });

    if (employee) {
      debug('Employee updated successfully');
    } else {
      debug('Employee not found for update');
    }

    return employee;
  }

  public async deleteEmployee(employeeId: number): Promise<boolean> {
    debug('Deleting employee:', employeeId);
    const result = await this.employeeRepository.delete(employeeId);
    debug('Employee deletion result:', result);
    return result;
  }
}
