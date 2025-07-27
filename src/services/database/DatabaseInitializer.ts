import { Pool } from 'pg';
import createDebug from 'debug';

const debug = createDebug('bot:database:initializer');

export class DatabaseInitializer {
  constructor(private pool: Pool) {}

  public async initialize(): Promise<void> {
    try {
      await this.createSchema();
      await this.createTables();
      debug('Database initialized successfully in TrackPendapatanBot schema');
    } catch (error) {
      debug('Error initializing database:', error);
      throw error;
    }
  }

  private async createSchema(): Promise<void> {
    await this.pool.query(`CREATE SCHEMA IF NOT EXISTS "TrackPendapatanBot"`);
    debug('Schema TrackPendapatanBot ensured');

    await this.pool.query(`SET search_path TO "TrackPendapatanBot", public`);
  }

  private async createTables(): Promise<void> {
    await this.createManagersTable();
    await this.createEmployeesTable();
    await this.createIncomeEntriesTable();
  }

  private async createManagersTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS "TrackPendapatanBot".managers (
        id SERIAL PRIMARY KEY,
        telegram_user_id VARCHAR(255) UNIQUE NOT NULL,
        business_name VARCHAR(255) DEFAULT 'My Garage Business',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.pool.query(query);
    debug('Managers table created/verified');
  }

  private async createEmployeesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS "TrackPendapatanBot".employees (
        id SERIAL PRIMARY KEY,
        manager_id INTEGER REFERENCES "TrackPendapatanBot".managers(id) ON DELETE CASCADE,
        employee_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(manager_id, employee_name)
      )
    `;
    await this.pool.query(query);
    debug('Employees table created/verified');
  }

  private async createUsersTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS "TrackPendapatanBot".users (
        id SERIAL PRIMARY KEY,
        telegram_user_id VARCHAR(255) UNIQUE NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await this.pool.query(query);
    debug('Users table created/verified (deprecated - keeping for migration)');
  }

  private async createIncomeEntriesTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS "TrackPendapatanBot".income_entries (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES "TrackPendapatanBot".employees(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        amount DECIMAL(12, 2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, date)
      )
    `;
    await this.pool.query(query);
    debug('Income entries table created/verified');
  }
}
