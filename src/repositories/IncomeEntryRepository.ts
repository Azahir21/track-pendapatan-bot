// src/repositories/IncomeEntryRepository.ts
import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { IncomeEntry } from '../models/IncomeEntry';

export interface IIncomeEntryRepository {
  create(entry: IncomeEntry): Promise<IncomeEntry>;
  findTodayByEmployeeId(
    employeeId: number,
  ): Promise<{ count: number; total: number }>;
  findTodayByUserId(userId: number): Promise<{ count: number; total: number }>;
  findTodayEntryByEmployeeId(employeeId: number): Promise<IncomeEntry | null>;
  updateTodayEntry(
    employeeId: number,
    entry: IncomeEntry,
  ): Promise<IncomeEntry>;
  findMonthlyByEmployeeId(
    employeeId: number,
    month: number,
    year: number,
  ): Promise<{ count: number; total: number }>;
  findMonthlyByUserId(
    userId: number,
    month: number,
    year: number,
  ): Promise<{ count: number; total: number }>;
  findRecentByEmployeeId(
    employeeId: number,
    limit: number,
  ): Promise<IncomeEntry[]>;
  findRecentByUserId(userId: number, limit: number): Promise<IncomeEntry[]>;
  findByManagerId(managerId: number): Promise<IncomeEntry[]>;
  getServiceStatsByManagerId(
    managerId: number,
  ): Promise<Array<{ service_type: string; count: number; total: number }>>;
  getServiceStatsByUserId(
    userId: number,
  ): Promise<Array<{ service_type: string; count: number; total: number }>>;
}

export class IncomeEntryRepository
  extends BaseRepository
  implements IIncomeEntryRepository
{
  constructor(pool: Pool) {
    super(pool, 'income_entries');
  }

  public async create(entry: IncomeEntry): Promise<IncomeEntry> {
    const insertData = entry.toDatabaseInsert();
    const query = `
      INSERT INTO ${this.getFullTableName()} (employee_id, amount, notes) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (employee_id, date) DO UPDATE SET
        amount = EXCLUDED.amount,
        notes = EXCLUDED.notes
      RETURNING *
    `;

    const result = await this.executeQuery(query, [
      insertData.employee_id,
      insertData.amount,
      insertData.notes,
    ]);

    return IncomeEntry.fromDatabaseRow(result.rows[0]);
  }

  public async findTodayByEmployeeId(
    employeeId: number,
  ): Promise<{ count: number; total: number }> {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      SELECT COUNT(*) as entry_count, COALESCE(SUM(amount), 0) as total_amount 
      FROM ${this.getFullTableName()} 
      WHERE employee_id = $1 AND date = $2
    `;

    const result = await this.executeQuery(query, [employeeId, today]);
    const row = result.rows[0];

    return {
      count: parseInt(row.entry_count),
      total: parseFloat(row.total_amount),
    };
  }

  public async findTodayEntryByEmployeeId(
    employeeId: number,
  ): Promise<IncomeEntry | null> {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      SELECT * FROM ${this.getFullTableName()} 
      WHERE employee_id = $1 AND date = $2
    `;

    const result = await this.executeQuery(query, [employeeId, today]);
    if (result.rows.length === 0) {
      return null;
    }

    return IncomeEntry.fromDatabaseRow(result.rows[0]);
  }

  public async updateTodayEntry(
    employeeId: number,
    entry: IncomeEntry,
  ): Promise<IncomeEntry> {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      UPDATE ${this.getFullTableName()} 
      SET amount = $3, notes = $4
      WHERE employee_id = $1 AND date = $2
      RETURNING *
    `;

    const result = await this.executeQuery(query, [
      employeeId,
      today,
      entry.amount,
      entry.notes || '',
    ]);

    return IncomeEntry.fromDatabaseRow(result.rows[0]);
  }

  public async findMonthlyByEmployeeId(
    employeeId: number,
    month: number,
    year: number,
  ): Promise<{ count: number; total: number }> {
    const query = `
      SELECT COUNT(*) as entry_count, COALESCE(SUM(amount), 0) as total_amount 
      FROM ${this.getFullTableName()} 
      WHERE employee_id = $1 
      AND EXTRACT(MONTH FROM date) = $2 
      AND EXTRACT(YEAR FROM date) = $3
    `;

    const result = await this.executeQuery(query, [employeeId, month, year]);
    const row = result.rows[0];

    return {
      count: parseInt(row.entry_count),
      total: parseFloat(row.total_amount),
    };
  }

  public async findRecentByEmployeeId(
    employeeId: number,
    limit: number,
  ): Promise<IncomeEntry[]> {
    const query = `
      SELECT * FROM ${this.getFullTableName()} 
      WHERE employee_id = $1 
      ORDER BY date DESC, created_at DESC 
      LIMIT $2
    `;

    const result = await this.executeQuery(query, [employeeId, limit]);

    return result.rows.map((row: any) => IncomeEntry.fromDatabaseRow(row));
  }

  public async findByManagerId(managerId: number): Promise<IncomeEntry[]> {
    const query = `
      SELECT ie.* FROM ${this.getFullTableName()} ie
      JOIN "TrackPendapatanBot".employees e ON ie.employee_id = e.id
      WHERE e.manager_id = $1
      ORDER BY ie.date DESC, ie.created_at DESC
    `;

    const result = await this.executeQuery(query, [managerId]);
    return result.rows.map((row: any) => IncomeEntry.fromDatabaseRow(row));
  }

  public async getServiceStatsByManagerId(
    managerId: number,
  ): Promise<Array<{ service_type: string; count: number; total: number }>> {
    const query = `
      SELECT ie.service_type, COUNT(*) as count, SUM(ie.amount) as total
      FROM ${this.getFullTableName()} ie
      JOIN "TrackPendapatanBot".employees e ON ie.employee_id = e.id
      WHERE e.manager_id = $1 
      GROUP BY ie.service_type 
      ORDER BY total DESC LIMIT 5
    `;

    const result = await this.executeQuery(query, [managerId]);

    return result.rows.map((row: any) => ({
      service_type: row.service_type,
      count: parseInt(row.count),
      total: parseFloat(row.total),
    }));
  }

  // Legacy methods for backward compatibility with User-based system
  public async findTodayByUserId(
    userId: number,
  ): Promise<{ count: number; total: number }> {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      SELECT COUNT(*) as entry_count, COALESCE(SUM(amount), 0) as total_amount 
      FROM ${this.getFullTableName()} 
      WHERE user_id = $1 AND date = $2
    `;

    const result = await this.executeQuery(query, [userId, today]);
    const row = result.rows[0];

    return {
      count: parseInt(row.entry_count),
      total: parseFloat(row.total_amount),
    };
  }

  public async findMonthlyByUserId(
    userId: number,
    month: number,
    year: number,
  ): Promise<{ count: number; total: number }> {
    const query = `
      SELECT COUNT(*) as entry_count, COALESCE(SUM(amount), 0) as total_amount 
      FROM ${this.getFullTableName()} 
      WHERE user_id = $1 
      AND EXTRACT(MONTH FROM date) = $2 
      AND EXTRACT(YEAR FROM date) = $3
    `;

    const result = await this.executeQuery(query, [userId, month, year]);
    const row = result.rows[0];

    return {
      count: parseInt(row.entry_count),
      total: parseFloat(row.total_amount),
    };
  }

  public async findRecentByUserId(
    userId: number,
    limit: number,
  ): Promise<IncomeEntry[]> {
    const query = `
      SELECT * FROM ${this.getFullTableName()} 
      WHERE user_id = $1 
      ORDER BY date DESC, created_at DESC 
      LIMIT $2
    `;

    const result = await this.executeQuery(query, [userId, limit]);
    return result.rows.map((row: any) => IncomeEntry.fromDatabaseRow(row));
  }

  public async getServiceStatsByUserId(
    userId: number,
  ): Promise<Array<{ service_type: string; count: number; total: number }>> {
    const query = `
      SELECT service_type, COUNT(*) as count, SUM(amount) as total
      FROM ${this.getFullTableName()} 
      WHERE user_id = $1 
      GROUP BY service_type 
      ORDER BY total DESC LIMIT 5
    `;

    const result = await this.executeQuery(query, [userId]);

    return result.rows.map((row: any) => ({
      service_type: row.service_type,
      count: parseInt(row.count),
      total: parseFloat(row.total),
    }));
  }
}
