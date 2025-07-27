export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ISessionManager {
  getSession(userId: string): ConversationMessage[];
  addMessage(userId: string, message: ConversationMessage): void;
  clearSession(userId: string): void;
  validateMessages(messages: ConversationMessage[]): ConversationMessage[];
}

export class SessionManager implements ISessionManager {
  private sessions = new Map<string, ConversationMessage[]>();
  private readonly maxMessages = 10;

  public getSession(userId: string): ConversationMessage[] {
    return this.sessions.get(userId) || [];
  }

  public addMessage(userId: string, message: ConversationMessage): void {
    if (!message.content || !message.content.trim()) {
      return;
    }

    let conversation = this.getSession(userId);
    conversation.push({ ...message, content: message.content.trim() });

    if (conversation.length > this.maxMessages) {
      conversation = conversation.slice(-this.maxMessages);
    }

    this.sessions.set(userId, conversation);
  }

  public clearSession(userId: string): void {
    this.sessions.delete(userId);
  }

  public validateMessages(
    messages: ConversationMessage[],
  ): ConversationMessage[] {
    const validMessages = messages.filter(
      (msg) => msg.content && msg.content.trim().length > 0,
    );

    if (validMessages.length === 0) {
      validMessages.push({ role: 'user', content: 'Hello' });
    }

    return validMessages;
  }
}
