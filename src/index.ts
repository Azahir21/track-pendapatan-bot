import { Telegraf } from 'telegraf';
import { about, chat, clearChat, help } from './commands';
import { greeting } from './text';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { development, production } from './core';
import { ApplicationService } from './services/ApplicationService';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';

const bot = new Telegraf(BOT_TOKEN);

// Set bot commands for autocomplete
const setBotCommands = async () => {
  try {
    await bot.telegram.setMyCommands([
      {
        command: 'help',
        description: 'Show help message with all available commands',
      },
      { command: 'about', description: 'Show bot information and version' },
      { command: 'chat', description: 'Chat with AI using a command' },
      { command: 'clear', description: 'Clear your chat history with the AI' },
    ]);
    console.log('Bot commands set successfully');
  } catch (error) {
    console.error('Error setting bot commands:', error);
  }
};

// Initialize automated reporting with safeguards
const initializeAutomatedReporting = async () => {
  try {
    const appService = ApplicationService.getInstance();

    // Initialize with bot instance FIRST
    appService.initializeWithBot(bot);

    // Then initialize the service
    await appService.initialize();

    // Only start automated reporting in production or if explicitly enabled
    const enableAutomatedReports =
      process.env.ENABLE_AUTOMATED_REPORTS === 'true' ||
      ENVIRONMENT === 'production';

    if (enableAutomatedReports) {
      const automatedReportingService =
        appService.getAutomatedReportingService();
      automatedReportingService.startScheduledReports(bot);
      console.log('Automated reporting initialized successfully');
    } else {
      console.log(
        'Automated reporting disabled (set ENABLE_AUTOMATED_REPORTS=true to enable)',
      );
    }
  } catch (error) {
    console.error('Error initializing automated reporting:', error);
  }
};

// Set commands when bot starts
setBotCommands();

// Initialize automated reporting
initializeAutomatedReporting();

bot.command('help', help());
bot.command('about', about());
bot.command('chat', chat());
bot.command('clear', clearChat());
bot.on('message', greeting());

//prod mode (Vercel)
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};
//dev mode
ENVIRONMENT !== 'production' && development(bot);
