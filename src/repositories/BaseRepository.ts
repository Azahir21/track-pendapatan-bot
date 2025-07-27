import { Pool } from 'pg';

export abstract class BaseRepository {
  protected pool: Pool;
  protected tableName: string;
  protected schemaName: string = 'TrackPendapatanBot';

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  protected getFullTableName(): string {
    return `"${this.schemaName}".${this.tableName}`;
  }

  protected async executeQuery(
    query: string,
    params: any[] = [],
  ): Promise<any> {
    try {
      const result = await this.pool.query(query, params);
      return result;
    } catch (error) {
      throw new Error(`Database query failed: ${error}`);
    }
  }
}
