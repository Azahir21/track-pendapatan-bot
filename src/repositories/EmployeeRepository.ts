// src/repositories/EmployeeRepository.ts
import { BaseRepository } from './BaseRepository';
import { Employee, IEmployee } from '../models/Employee';

export interface IEmployeeRepository {
  findById(id: number): Promise<Employee | null>;
  findByManagerId(managerId: number): Promise<Employee[]>;
  findByManagerIdAndName(
    managerId: number,
    employeeName: string,
  ): Promise<Employee | null>;
  create(employee: Omit<IEmployee, 'id' | 'created_at'>): Promise<Employee>;
  update(id: number, employee: Partial<IEmployee>): Promise<Employee | null>;
  delete(id: number): Promise<boolean>;
}

export class EmployeeRepository
  extends BaseRepository
  implements IEmployeeRepository
{
  public async findById(id: number): Promise<Employee | null> {
    const query = `
      SELECT * FROM "TrackPendapatanBot".employees 
      WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return Employee.fromDatabaseRow(result.rows[0]);
  }

  public async findByManagerId(managerId: number): Promise<Employee[]> {
    const query = `
      SELECT * FROM "TrackPendapatanBot".employees 
      WHERE manager_id = $1
      ORDER BY employee_name
    `;
    const result = await this.pool.query(query, [managerId]);

    return result.rows.map((row) => Employee.fromDatabaseRow(row));
  }

  public async findByManagerIdAndName(
    managerId: number,
    employeeName: string,
  ): Promise<Employee | null> {
    const query = `
      SELECT * FROM "TrackPendapatanBot".employees 
      WHERE manager_id = $1 AND employee_name = $2
    `;
    const result = await this.pool.query(query, [managerId, employeeName]);

    if (result.rows.length === 0) {
      return null;
    }

    return Employee.fromDatabaseRow(result.rows[0]);
  }

  public async create(
    employee: Omit<IEmployee, 'id' | 'created_at'>,
  ): Promise<Employee> {
    const query = `
      INSERT INTO "TrackPendapatanBot".employees (manager_id, employee_name)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      employee.manager_id,
      employee.employee_name,
    ]);

    return Employee.fromDatabaseRow(result.rows[0]);
  }

  public async update(
    id: number,
    employee: Partial<IEmployee>,
  ): Promise<Employee | null> {
    const fields = [];
    const values = [];
    let paramCounter = 1;

    if (employee.employee_name !== undefined) {
      fields.push(`employee_name = $${paramCounter++}`);
      values.push(employee.employee_name);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);
    const query = `
      UPDATE "TrackPendapatanBot".employees 
      SET ${fields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.length > 0
      ? Employee.fromDatabaseRow(result.rows[0])
      : null;
  }

  public async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM "TrackPendapatanBot".employees WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}
