import { Context } from 'telegraf';
import { callLLMWithContext } from '../services';
import createDebug from 'debug';

const debug = createDebug('bot:greeting_text');

const greeting = () => async (ctx: Context) => {
  debug('Triggered "greeting" text command');

  const userId = ctx.from?.id.toString();
  const userMessage = ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string'
    ? ctx.message.text
    : '';

  // Skip if it's a command (starts with /)
  if (userMessage.startsWith('/')) {
    return; // Let command handlers deal with this
  }

  if (!userId) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  if (!userMessage) {
    await ctx.reply('Please send a text message to chat with the AI.');
    return;
  }

  try {
    debug(`Processing message from user ${userId}: ${userMessage}`);
    const response = await callLLMWithContext(userId, userMessage);
    await ctx.reply(response);
  } catch (error) {
    debug('LLM error:', error);
    await ctx.reply('Sorry, there was an error processing your message. Please try again.');
  }
};

export { greeting };