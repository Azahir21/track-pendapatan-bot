// src/services/database/DatabaseConnection.ts
import { Pool, PoolConfig } from 'pg';
import createDebug from 'debug';

const debug = createDebug('bot:database');

export interface IDatabaseConnection {
  getPool(): Pool;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

export class DatabaseConnection implements IDatabaseConnection {
  private pool: Pool;
  private connected: boolean = false;
  private config: PoolConfig;

  constructor(config: PoolConfig) {
    this.config = config;
    this.pool = this.createPool();
  }

  private createPool(): Pool {
    debug('Creating PostgreSQL pool with config:', {
      user: this.config.user,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      ssl: this.config.ssl ? 'enabled' : 'disabled',
    });

    return new Pool(this.config);
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async connect(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT VERSION()');
      debug('Database connected successfully:', result.rows[0].version);
      client.release();
      this.connected = true;
      return true;
    } catch (error: any) {
      debug('Database connection failed:', error.message);
      this.connected = false;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.connected = false;
      debug('Database disconnected');
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public async retryWithSSL(): Promise<boolean> {
    debug('Retrying connection with SSL enabled...');

    await this.disconnect();

    const sslConfig: PoolConfig = {
      ...this.config,
      ssl: {
        rejectUnauthorized: false,
      },
    };

    this.config = sslConfig;
    this.pool = this.createPool();

    return await this.connect();
  }
}
