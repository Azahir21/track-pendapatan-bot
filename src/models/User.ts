// src/models/User.ts
export interface IUser {
  id?: number;
  telegram_user_id: string;
  employee_name: string;
  created_at?: Date;
}

export class User implements IUser {
  public id?: number;
  public telegram_user_id: string;
  public employee_name: string;
  public created_at?: Date;

  constructor(
    telegramUserId: string,
    employeeName: string,
    id?: number,
    createdAt?: Date,
  ) {
    this.telegram_user_id = telegramUserId;
    this.employee_name = employeeName;
    this.id = id;
    this.created_at = createdAt;
  }

  public static fromDatabaseRow(row: any): User {
    return new User(
      row.telegram_user_id,
      row.employee_name,
      row.id,
      row.created_at,
    );
  }

  public toDatabaseInsert(): Omit<IUser, 'id' | 'created_at'> {
    return {
      telegram_user_id: this.telegram_user_id,
      employee_name: this.employee_name,
    };
  }
}
