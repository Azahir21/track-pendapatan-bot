import { Context } from 'telegraf';
import { callLLMWithContext, clearUserSession } from '../services';
import createDebug from 'debug';

const debug = createDebug('bot:chat_command');

const chat = () => async (ctx: Context) => {
  const userId = ctx.from?.id.toString();
  const userMessage =
    ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string'
      ? ctx.message.text.replace('/chat ', '')
      : '';
  
  if (!userId) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  if (!userMessage) {
    await ctx.reply('Please provide a message to chat with the AI.\nExample: /chat Hello, how are you?');
    return;
  }

  try {
    const response = await callLLMWithContext(userId, userMessage);
    await ctx.reply(response);
  } catch (error) {
    debug('Chat command error:', error);
    await ctx.reply('Sorry, there was an error processing your request.');
  }
};

const clearChat = () => async (ctx: Context) => {
  const userId = ctx.from?.id.toString();
  
  if (!userId) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  clearUserSession(userId);
  await ctx.reply('Chat history cleared! Starting fresh conversation.');
};

export { chat, clearChat };