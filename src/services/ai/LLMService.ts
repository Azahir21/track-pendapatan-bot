import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import createDebug from 'debug';
import { ISessionManager, ConversationMessage } from './SessionManager';
import { ToolFactory } from './tools/ToolFactory';

const debug = createDebug('bot:llm-service');

export interface ILLMService {
  processMessage(userId: string, message: string): Promise<string>;
  clearUserSession(userId: string): void;
}

export class LLMService implements ILLMService {
  constructor(
    private readonly sessionManager: ISessionManager,
    private readonly toolFactory: ToolFactory,
  ) {}

  public async processMessage(
    userId: string,
    message: string,
  ): Promise<string> {
    debug('Processing message for user:', userId);

    try {
      // Get conversation history
      let conversation = this.sessionManager.getSession(userId);
      debug('Current conversation length:', conversation.length);

      // Add user message to conversation history
      if (message && message.trim()) {
        this.sessionManager.addMessage(userId, {
          role: 'user',
          content: message,
        });
        conversation = this.sessionManager.getSession(userId);
      }

      // Validate messages
      const validMessages = this.sessionManager.validateMessages(conversation);

      // Create tools for this user
      const tools = this.toolFactory.createTools(userId);
      debug('Available tools:', Object.keys(tools));

      // Convert tools to the format expected by AI SDK
      const aiTools: Record<string, any> = {};
      for (const [key, tool] of Object.entries(tools)) {
        aiTools[key] = {
          description: tool.description,
          parameters: tool.parameters,
          execute: async (args: any) => {
            debug(`Executing tool: ${key} with args:`, args);
            try {
              const result = await tool.execute(args);
              debug(`Tool ${key} result:`, result);
              return result;
            } catch (error) {
              debug(`Tool ${key} error:`, error);
              throw error;
            }
          },
        };
      }

      debug('Calling generateText with', Object.keys(aiTools).length, 'tools');

      // Generate response with more explicit tool instructions
      const result = await generateText({
        model: google('gemini-1.5-flash'),
        system: this.getOptimizedSystemPrompt(),
        messages: validMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        tools: aiTools,
        maxTokens: 1200,
        temperature: 0.3, // Lower temperature for more consistent tool usage
        toolChoice: 'auto', // Explicitly enable automatic tool choice
      });

      debug('GenerateText response - text:', result.text);
      debug(
        'GenerateText response - toolCalls:',
        result.toolCalls?.length || 0,
      );
      debug(
        'GenerateText response - toolResults:',
        result.toolResults?.length || 0,
      );

      let response = result.text;

      // Handle cases where the model doesn't provide text but executed tools
      if (
        (!response || response.trim().length === 0) &&
        result.toolResults &&
        result.toolResults.length > 0
      ) {
        debug('No text response but have tool results, using fallback...');

        // Create a contextual response based on the tool that was executed
        response = this.createContextualResponse(
          result.toolCalls,
          result.toolResults,
          message,
        );
      }

      // Final fallback
      if (!response || response.trim().length === 0) {
        response = this.getDefaultResponse();
      }

      debug('Final response:', response);

      // Add assistant response to conversation history
      if (response && response.trim()) {
        this.sessionManager.addMessage(userId, {
          role: 'assistant',
          content: response,
        });
      }

      return response;
    } catch (error) {
      debug('LLM API error:', error);
      return 'I apologize, but I encountered an error with TrackPendapatanBot. Please try again or rephrase your message.';
    }
  }

  private createContextualResponse(
    toolCalls: any[] | undefined,
    toolResults: any[],
    userMessage: string,
  ): string {
    if (!toolCalls || !toolResults || toolResults.length === 0) {
      return this.getDefaultResponse();
    }

    const firstToolCall = toolCalls[0];
    const firstResult = toolResults[0];

    if (!firstResult.result) {
      return 'I executed the requested action, but no specific data was returned.';
    }

    const toolResult =
      typeof firstResult.result === 'string'
        ? firstResult.result
        : JSON.stringify(firstResult.result);

    // Create contextual responses based on tool type
    switch (firstToolCall.toolName) {
      case 'getCurrentTime':
        return `The current time is: ${toolResult}`;

      case 'calculateMath':
        return toolResult; // Math tool already returns a formatted response

      case 'getWeather':
        return toolResult; // Weather tool already returns a formatted response

      case 'registerBusiness':
        return `${toolResult}\n\n🚀 Your business is now registered! Next steps:\n• Register employees\n• Start recording daily income\n• Generate business reports`;

      case 'getBusinessInfo':
        return `${toolResult}\n\n💡 You can now manage employees, record income, and generate detailed reports for your business.`;

      case 'registerEmployee':
        return `${toolResult}\n\n🚀 Great! Your employee is now registered. You can start recording daily income entries for your garage business.`;

      case 'updateBusinessName':
        return `${toolResult}\n\n✨ Your business identity has been updated! You can continue managing employees and tracking income with your new business name.`;

      case 'listEmployees':
        return `${toolResult}\n\n💡 Tip: Each employee can record one income entry per day. Use the recordIncome tool to log daily services.`;

      case 'recordIncome':
        return `${toolResult}\n\n📊 Keep tracking your daily services to monitor your garage business performance!`;

      case 'getTodayIncome':
        return `${toolResult}\n\n💰 This shows your garage's performance for today. Keep up the excellent work!`;

      case 'getMonthlyIncome':
        return `${toolResult}\n\n📈 Monthly tracking helps you understand your business trends and plan for growth.`;

      case 'getIncomeHistory':
        return `${toolResult}\n\n🔍 This history shows your recent garage service activities. Use this data to identify popular services and busy periods.`;

      case 'getBusinessStats':
        return `${toolResult}\n\n📊 These statistics give you valuable insights into your garage business performance. Consider focusing on your top services for maximum revenue!`;

      case 'generateEmployeeReport':
        return `${toolResult}\n\n📊 This detailed report shows your team's performance. Use these insights to:\n• Recognize top performers\n• Identify improvement opportunities\n• Plan business strategies\n• Track progress over time`;

      case 'generateTrendAnalysis':
        return `${toolResult}\n\n📈 This trend analysis provides valuable business intelligence with real market context. Use these insights to:\n• Make informed business decisions\n• Adapt to market changes\n• Plan for future growth\n• Optimize operations`;

      default:
        return `${toolResult}\n\nIs there anything else I can help you with for your garage business?`;
    }
  }

  public clearUserSession(userId: string): void {
    this.sessionManager.clearSession(userId);
    debug('Cleared session for user:', userId);
  }

  private getOptimizedSystemPrompt(): string {
    return `You are TrackPendapatanBot, a garage business management AI assistant with advanced reporting and trend analysis capabilities.

CRITICAL RULES:
- ALWAYS use tools when the user requests actions like "register", "list", "show", "get", "record", "update", "report", "trend"
- NEVER make up or assume data - always call the appropriate tool to get real information
- For reporting requests, ALWAYS use generateEmployeeReport or generateTrendAnalysis tools
- Parse time frames intelligently from user queries
- When user asks for "all employees", leave employeeName empty/undefined in generateEmployeeReport

ADVANCED REPORTING CAPABILITIES:
- Employee performance reports for any time period
- Trend analysis with real market context
- Business insights with external factor analysis
- Intelligent time frame parsing (this week, last month, 2 weeks ago, etc.)

TOOL USAGE EXAMPLES:
- "report for all employees this week" → MUST call generateEmployeeReport with timeFrame="this week" and NO employeeName
- "report for Budi last month" → MUST call generateEmployeeReport with employeeName="Budi" and timeFrame="last month"
- "trend analysis last 3 months" → MUST call generateTrendAnalysis with timeFrame="last 3 months"
- "why income declining" → MUST call generateTrendAnalysis with market analysis enabled

PARAMETER HANDLING:
- For ALL employees: Do NOT provide employeeName parameter or set it to undefined
- For SPECIFIC employee: Provide the exact employee name
- For time frames: Use natural language like "this week", "last month", etc.

AVAILABLE TOOLS:
🕒 getCurrentTime, calculateMath, getWeather
🏢 registerBusiness, getBusinessInfo, updateBusinessName
👥 registerEmployee, listEmployees
💰 recordIncome, getTodayIncome, getMonthlyIncome, getIncomeHistory, getBusinessStats
📊 generateEmployeeReport, generateTrendAnalysis (with real web search)

The system can intelligently parse time frames like:
- "this week", "last week", "2 weeks ago"
- "this month", "last month", "3 months ago"
- "this quarter", "last 6 months", "this year"

REMEMBER: You are an advanced business intelligence assistant with real-world market analysis capabilities!`;
  }

  private getDefaultResponse(): string {
    return 'I received your message. How can I help you with your TrackPendapatanBot garage business today?';
  }
}
