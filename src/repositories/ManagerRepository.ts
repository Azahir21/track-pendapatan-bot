// src/repositories/ManagerRepository.ts
import { BaseRepository } from './BaseRepository';
import { Manager, IManager } from '../models/Manager';

export interface IManagerRepository {
  findByTelegramUserId(telegramUserId: string): Promise<Manager | null>;
  create(manager: Omit<IManager, 'id' | 'created_at'>): Promise<Manager>;
  update(id: number, manager: Partial<IManager>): Promise<Manager | null>;
  delete(id: number): Promise<boolean>;
}

export class ManagerRepository
  extends BaseRepository
  implements IManagerRepository
{
  public async findByTelegramUserId(
    telegramUserId: string,
  ): Promise<Manager | null> {
    const query = `
      SELECT * FROM "TrackPendapatanBot".managers 
      WHERE telegram_user_id = $1
    `;
    const result = await this.pool.query(query, [telegramUserId]);

    if (result.rows.length === 0) {
      return null;
    }

    return Manager.fromDatabaseRow(result.rows[0]);
  }

  public async create(
    manager: Omit<IManager, 'id' | 'created_at'>,
  ): Promise<Manager> {
    const query = `
      INSERT INTO "TrackPendapatanBot".managers (telegram_user_id, business_name)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await this.pool.query(query, [
      manager.telegram_user_id,
      manager.business_name,
    ]);

    return Manager.fromDatabaseRow(result.rows[0]);
  }

  public async update(
    id: number,
    manager: Partial<IManager>,
  ): Promise<Manager | null> {
    const fields = [];
    const values = [];
    let paramCounter = 1;

    if (manager.business_name !== undefined) {
      fields.push(`business_name = $${paramCounter++}`);
      values.push(manager.business_name);
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);
    const query = `
      UPDATE "TrackPendapatanBot".managers 
      SET ${fields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return result.rows.length > 0
      ? Manager.fromDatabaseRow(result.rows[0])
      : null;
  }

  public async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM "TrackPendapatanBot".managers WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}
