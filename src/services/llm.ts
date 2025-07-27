import { ApplicationService } from './ApplicationService';
import createDebug from 'debug';

const debug = createDebug('bot:llm');

// Singleton instance of the application service
let appService: ApplicationService | null = null;

const initializeAppService = async (): Promise<void> => {
  if (appService && appService.isInitialized()) {
    return;
  }

  try {
    debug('Initializing application service...');
    appService = ApplicationService.getInstance();
    await appService.initialize();
    debug('Application service initialized successfully');
  } catch (error) {
    debug('Failed to initialize application service:', error);
    appService = null;
  }
};
setTimeout(initializeAppService, 1000);

export const callLLMWithContext = async (
  userId: string,
  message: string,
): Promise<string> => {
  debug('Calling LLM with context for user:', userId);

  try {
    if (!appService || !appService.isInitialized()) {
      await initializeAppService();
      if (!appService) {
        throw new Error('Failed to initialize application service');
      }
    }

    const llmService = appService.getLLMService();
    return await llmService.processMessage(userId, message);
  } catch (error) {
    debug('Error in callLLMWithContext:', error);
    return 'I apologize, but I encountered an error with TrackPendapatanBot. Please try again or rephrase your message.';
  }
};

export const clearUserSession = (userId: string): void => {
  try {
    if (appService && appService.isInitialized()) {
      const llmService = appService.getLLMService();
      llmService.clearUserSession(userId);
    }
    debug('Cleared session for user:', userId);
  } catch (error) {
    debug('Error clearing user session:', error);
  }
};

process.on('SIGINT', async () => {
  debug('Shutting down TrackPendapatanBot application...');
  if (appService) {
    await appService.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  debug('Shutting down TrackPendapatanBot application...');
  if (appService) {
    await appService.shutdown();
  }
  process.exit(0);
});
