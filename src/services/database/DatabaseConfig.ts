import { PoolConfig } from 'pg';

export class DatabaseConfig {
  public static createAivenConfig(): PoolConfig {
    return {
      user: process.env.AIVEN_USER?.toString(),
      password: process.env.AIVEN_PASSWORD?.toString(),
      host: process.env.AIVEN_HOST?.toString(),
      port: parseInt(process.env.AIVEN_PORT || '5432'),
      database: process.env.AIVEN_DATABASE?.toString(),
      ssl: this.getSSLConfig(),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
      options: '--search_path=TrackPendapatanBot,public',
    };
  }

  private static getSSLConfig(): any {
    if (process.env.NODE_ENV === 'production' || process.env.AIVEN_CA_CERT) {
      return {
        rejectUnauthorized: true,
        ca: process.env.AIVEN_CA_CERT?.toString() || undefined,
      };
    }
    return false;
  }

  public static validateConfig(): void {
    const requiredEnvVars = [
      'AIVEN_USER',
      'AIVEN_PASSWORD',
      'AIVEN_HOST',
      'AIVEN_DATABASE',
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`,
      );
    }
  }
}
