import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { User, IUser } from '../models/User';

export interface IUserRepository {
  findByTelegramId(telegramUserId: string): Promise<User | null>;
  create(user: User): Promise<User>;
  findById(id: number): Promise<User | null>;
}

export class UserRepository extends BaseRepository implements IUserRepository {
  constructor(pool: Pool) {
    super(pool, 'users');
  }

  public async findByTelegramId(telegramUserId: string): Promise<User | null> {
    const query = `SELECT * FROM ${this.getFullTableName()} WHERE telegram_user_id = $1`;
    const result = await this.executeQuery(query, [telegramUserId]);

    if (result.rows.length === 0) {
      return null;
    }

    return User.fromDatabaseRow(result.rows[0]);
  }

  public async create(user: User): Promise<User> {
    const insertData = user.toDatabaseInsert();
    const query = `
      INSERT INTO ${this.getFullTableName()} (telegram_user_id, employee_name) 
      VALUES ($1, $2) 
      RETURNING *
    `;

    const result = await this.executeQuery(query, [
      insertData.telegram_user_id,
      insertData.employee_name,
    ]);

    return User.fromDatabaseRow(result.rows[0]);
  }

  public async findById(id: number): Promise<User | null> {
    const query = `SELECT * FROM ${this.getFullTableName()} WHERE id = $1`;
    const result = await this.executeQuery(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return User.fromDatabaseRow(result.rows[0]);
  }
}
