export interface IEmployee {
  id?: number;
  manager_id: number;
  employee_name: string;
  created_at?: Date;
}

export class Employee implements IEmployee {
  public id?: number;
  public manager_id: number;
  public employee_name: string;
  public created_at?: Date;

  constructor(
    managerId: number,
    employeeName: string,
    id?: number,
    createdAt?: Date,
  ) {
    this.manager_id = managerId;
    this.employee_name = employeeName;
    this.id = id;
    this.created_at = createdAt;
  }

  public static fromDatabaseRow(row: any): Employee {
    return new Employee(
      row.manager_id,
      row.employee_name,
      row.id,
      row.created_at,
    );
  }

  public toDatabaseInsert(): Omit<IEmployee, 'id' | 'created_at'> {
    return {
      manager_id: this.manager_id,
      employee_name: this.employee_name,
    };
  }

  public displayInfo(): string {
    return `Employee: ${this.employee_name} (ID: ${this.id})`;
  }
}
