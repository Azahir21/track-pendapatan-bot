export interface IIncomeEntry {
  id?: number;
  employee_id: number;
  date?: Date;
  amount: number;
  notes?: string;
  created_at?: Date;
}

export class IncomeEntry implements IIncomeEntry {
  public id?: number;
  public employee_id: number;
  public date?: Date;
  public amount: number;
  public notes?: string;
  public created_at?: Date;

  constructor(
    employeeId: number,
    amount: number,
    notes?: string,
    id?: number,
    date?: Date,
    createdAt?: Date,
  ) {
    this.employee_id = employeeId;
    this.amount = amount;
    this.notes = notes;
    this.id = id;
    this.date = date;
    this.created_at = createdAt;
  }

  public static fromDatabaseRow(row: any): IncomeEntry {
    return new IncomeEntry(
      row.employee_id,
      parseFloat(row.amount),
      row.notes,
      row.id,
      row.date,
      row.created_at,
    );
  }

  public toDatabaseInsert(): Omit<IIncomeEntry, 'id' | 'date' | 'created_at'> {
    return {
      employee_id: this.employee_id,
      amount: this.amount,
      notes: this.notes || '',
    };
  }

  public getFormattedAmount(): string {
    return `Rp ${this.amount.toLocaleString('id-ID')}`;
  }

  public getFormattedDate(): string {
    if (!this.date) return new Date().toLocaleDateString('id-ID');
    return new Date(this.date).toLocaleDateString('id-ID');
  }
}
