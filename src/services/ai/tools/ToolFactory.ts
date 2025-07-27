import { IUserService } from '../../business/UserService';
import { IIncomeService } from '../../business/IncomeService';
import { IManagerService } from '../../business/ManagerService';
import { IEmployeeService } from '../../business/EmployeeService';
import { IReportingService } from '../../business/ReportingService';
import { IWebSearchService } from '../../external/WebSearchService';
import { WeatherService } from '../../external/WeatherService';
import { IAutomatedReportingService } from '../../automation/AutomatedReportingService';
import { RegisterBusinessTool } from './business/RegisterBusinessTool';
import { GetBusinessInfoTool } from './business/GetBusinessInfoTool';
import { RegisterEmployeeTool } from './business/RegisterEmployeeTool';
import { ListEmployeesTool } from './business/ListEmployeesTool';
import { RecordIncomeTool } from './business/RecordIncomeTool';
import { GetTodayIncomeTool } from './business/GetTodayIncomeTool';
import { GetMonthlyIncomeTool } from './business/GetMonthlyIncomeTool';
import { GetIncomeHistoryTool } from './business/GetIncomeHistoryTool';
import { GetBusinessStatsTool } from './business/GetBusinessStatsTool';
import { GenerateEmployeeReportTool } from './business/GenerateEmployeeReportTool';
import { GenerateTrendAnalysisTool } from './business/GenerateTrendAnalysisTool';
import { ManageReportScheduleTool } from './business/ManageReportScheduleTool';
import { UpdateBusinessNameTool } from './business/UpdateBusinessNameTool';
import { GetCurrentTimeTool } from './utility/GetCurrentTimeTool';
import { CalculateMathTool } from './utility/CalculateMathTool';
import { GetWeatherTool } from './utility/GetWeatherTool';
import { Telegraf } from 'telegraf';
import createDebug from 'debug';

const debug = createDebug('bot:tool-factory');

export class ToolFactory {
  constructor(
    private readonly userService: IUserService,
    private readonly incomeService: IIncomeService,
    private readonly managerService: IManagerService,
    private readonly employeeService: IEmployeeService,
    private readonly reportingService: IReportingService,
    private readonly webSearchService: IWebSearchService,
    private readonly automatedReportingService: IAutomatedReportingService,
    private readonly weatherService: WeatherService,
    private readonly bot?: Telegraf,
  ) {}

  public createTools(userId: string) {
    debug('Creating tools for user:', userId);

    const tools = {
      // Utility tools
      getCurrentTime: new GetCurrentTimeTool(),
      calculateMath: new CalculateMathTool(),
      getWeather: new GetWeatherTool(this.weatherService),

      // Business management tools
      registerBusiness: new RegisterBusinessTool(this.managerService, userId),
      getBusinessInfo: new GetBusinessInfoTool(
        this.managerService,
        this.employeeService,
        this.incomeService,
        userId,
      ),
      updateBusinessName: new UpdateBusinessNameTool(
        this.managerService,
        userId,
      ),

      // Employee management tools
      registerEmployee: new RegisterEmployeeTool(
        this.managerService,
        this.employeeService,
        userId,
      ),
      listEmployees: new ListEmployeesTool(
        this.managerService,
        this.employeeService,
        userId,
      ),

      // Income management tools
      recordIncome: new RecordIncomeTool(
        this.managerService,
        this.employeeService,
        this.incomeService,
        userId,
      ),
      getTodayIncome: new GetTodayIncomeTool(
        this.userService,
        this.incomeService,
        userId,
      ),
      getMonthlyIncome: new GetMonthlyIncomeTool(
        this.userService,
        this.incomeService,
        userId,
      ),
      getIncomeHistory: new GetIncomeHistoryTool(
        this.userService,
        this.incomeService,
        userId,
      ),
      getBusinessStats: new GetBusinessStatsTool(
        this.userService,
        this.incomeService,
        userId,
      ),

      // Advanced reporting tools
      generateEmployeeReport: new GenerateEmployeeReportTool(
        this.managerService,
        this.reportingService,
        userId,
      ),
      generateTrendAnalysis: new GenerateTrendAnalysisTool(
        this.managerService,
        this.reportingService,
        this.webSearchService,
        userId,
      ),

      // Automation tools
      manageReportSchedule: new ManageReportScheduleTool(
        this.automatedReportingService,
        userId,
        this.bot,
      ),
    };

    debug('Created tools:', Object.keys(tools));
    return tools;
  }
}
