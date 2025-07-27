import { Context } from 'telegraf';
import { callLLMWithContext } from '../services';
import createDebug from 'debug';
import * as fs from 'fs';

const debug = createDebug('bot:greeting_text');

const greeting = () => async (ctx: Context) => {
  debug('Triggered "greeting" text command');

  const userId = ctx.from?.id.toString();
  const userMessage =
    ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string'
      ? ctx.message.text
      : '';

  if (userMessage.startsWith('/')) {
    return;
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

    if (response.includes('File path:') && response.includes('.csv')) {
      const filePathMatch = response.match(/File path: (.+\.csv)/);
      if (filePathMatch) {
        const filePath = filePathMatch[1];

        try {
          await ctx.replyWithDocument(
            { source: filePath },
            {
              caption:
                '📊 Your employee report is ready! Open this CSV file in Excel or Google Sheets for analysis.',
            },
          );

          setTimeout(() => {
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              debug('Error deleting temp file:', err);
            }
          }, 5000);
        } catch (error) {
          debug('Error sending CSV file:', error);
          await ctx.reply('❌ Error sending CSV file. Please try again.');
        }
      }
    } else {
      await ctx.reply(response);
    }
  } catch (error) {
    debug('LLM error:', error);
    await ctx.reply(
      'Sorry, there was an error processing your message. Please try again.',
    );
  }
};

export { greeting };
