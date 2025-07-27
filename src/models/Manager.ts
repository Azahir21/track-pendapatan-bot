export interface IManager {
  id?: number;
  telegram_user_id: string;
  business_name: string;
  created_at?: Date;
}

export class Manager implements IManager {
  public id?: number;
  public telegram_user_id: string;
  public business_name: string;
  public created_at?: Date;

  constructor(
    telegramUserId: string,
    businessName: string = 'My Garage Business',
    id?: number,
    createdAt?: Date,
  ) {
    this.telegram_user_id = telegramUserId;
    this.business_name = businessName;
    this.id = id;
    this.created_at = createdAt;
  }

  public static fromDatabaseRow(row: any): Manager {
    return new Manager(
      row.telegram_user_id,
      row.business_name,
      row.id,
      row.created_at,
    );
  }

  public toDatabaseInsert(): Omit<IManager, 'id' | 'created_at'> {
    return {
      telegram_user_id: this.telegram_user_id,
      business_name: this.business_name,
    };
  }

  public displayInfo(): string {
    return `Business: ${this.business_name}\nTelegram ID: ${this.telegram_user_id}`;
  }
}
