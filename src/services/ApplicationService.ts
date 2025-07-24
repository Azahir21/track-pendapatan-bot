// src/services/ApplicationService.ts
import { Pool } from 'pg';
import {
  DatabaseConnection,
  IDatabaseConnection,
} from './database/DatabaseConnection';
import { DatabaseConfig } from './database/DatabaseConfig';
import { DatabaseInitializer } from './database/DatabaseInitializer';
import { UserRepository } from '../repositories/UserRepository';
import { IncomeEntryRepository } from '../repositories/IncomeEntryRepository';
import { ManagerRepository } from '../repositories/ManagerRepository';
import { EmployeeRepository } from '../repositories/EmployeeRepository';
import { UserService } from './business/UserService';
import { IncomeService } from './business/IncomeService';
import { ManagerService } from './business/ManagerService';
import { EmployeeService } from './business/EmployeeService';
import { ReportingService } from './business/ReportingService';
import { WebSearchService } from './external/WebSearchService';
import { SessionManager } from './ai/SessionManager';
import { ToolFactory } from './ai/tools/ToolFactory';
import { LLMService, ILLMService } from './ai/LLMService';
import createDebug from 'debug';

const debug = createDebug('bot:app-service');

export class ApplicationService {
  private static instance: ApplicationService | null = null;
  private databaseConnection: IDatabaseConnection | null = null;
  private llmService: ILLMService | null = null;
  private initialized: boolean = false;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): ApplicationService {
    if (!ApplicationService.instance) {
      ApplicationService.instance = new ApplicationService();
    }
    return ApplicationService.instance;
  }

  private initializeServices(): void {
    try {
      // Validate configuration
      DatabaseConfig.validateConfig();

      // Create database connection
      const config = DatabaseConfig.createAivenConfig();
      this.databaseConnection = new DatabaseConnection(config);

      // Initialize repositories
      const pool = this.databaseConnection.getPool();
      const userRepository = new UserRepository(pool);
      const incomeEntryRepository = new IncomeEntryRepository(pool);
      const managerRepository = new ManagerRepository(pool, 'managers');
      const employeeRepository = new EmployeeRepository(pool, 'employees');

      // Initialize business services
      const userService = new UserService(userRepository);
      const incomeService = new IncomeService(incomeEntryRepository);
      const managerService = new ManagerService(managerRepository);
      const employeeService = new EmployeeService(employeeRepository);
      const reportingService = new ReportingService(
        employeeService,
        incomeService,
        managerService,
      );

      // Initialize external services
      const webSearchService = new WebSearchService();

      // Initialize AI services
      const sessionManager = new SessionManager();
      const toolFactory = new ToolFactory(
        userService,
        incomeService,
        managerService,
        employeeService,
        reportingService,
        webSearchService,
      );
      this.llmService = new LLMService(sessionManager, toolFactory);

      debug('Application services initialized');
    } catch (error) {
      debug('Error initializing services:', error);
      throw error;
    }
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      debug('Initializing application...');

      // Initialize services first
      this.initializeServices();

      // Connect to database
      const connected = await this.connectToDatabase();
      if (!connected) {
        throw new Error('Failed to connect to database');
      }

      // Initialize database schema
      await this.initializeDatabase();

      this.initialized = true;
      debug('Application initialized successfully');
    } catch (error) {
      debug('Error initializing application:', error);
      throw error;
    }
  }

  private async connectToDatabase(): Promise<boolean> {
    if (!this.databaseConnection) return false;

    let connected = await this.databaseConnection.connect();

    if (!connected) {
      // Try with SSL if first attempt fails
      debug('Retrying database connection with SSL...');
      if ('retryWithSSL' in this.databaseConnection) {
        connected = await (this.databaseConnection as any).retryWithSSL();
      }
    }

    return connected;
  }

  private async initializeDatabase(): Promise<void> {
    if (!this.databaseConnection) {
      throw new Error('Database connection not initialized');
    }
    const pool = this.databaseConnection.getPool();
    const initializer = new DatabaseInitializer(pool);
    await initializer.initialize();
  }

  public getLLMService(): ILLMService {
    if (!this.initialized || !this.llmService) {
      throw new Error('Application not initialized. Call initialize() first.');
    }
    return this.llmService;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async shutdown(): Promise<void> {
    debug('Shutting down application...');
    if (this.databaseConnection) {
      await this.databaseConnection.disconnect();
    }
    debug('Application shutdown complete');
  }
}
