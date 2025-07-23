import { Context } from 'telegraf';
import createDebug from 'debug';

const debug = createDebug('bot:help_command');

const help = () => async (ctx: Context) => {
  debug('Triggered "help" command');
  
  const helpMessage = `
🤖 *Bot Commands:*

/help - Show this help message
/about - Show bot information and version
/clear - Clear your chat history with the AI
/chat <message> - Chat with AI using a command (optional)

💬 *Direct Chat:*
You can also chat with the AI directly by sending any text message without commands!

📝 *Examples:*
\`/chat Hello, how are you?\`
\`Hello, how are you?\` (direct message)
\`/clear\` (clear chat history)
\`/about\` (bot info)
  `;

  await ctx.replyWithMarkdown(helpMessage);
};

export { help };