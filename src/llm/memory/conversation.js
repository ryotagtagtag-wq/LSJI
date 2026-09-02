/**
 * Conversation Memory
 * 
 * Manages conversation history for LLM agents.
 * Supports token-aware truncation and persistence.
 */

import { createStorage } from '../../index.js';

/**
 * Conversation message
 * @typedef {Object} Message
 * @property {string} role - 'system' | 'user' | 'assistant' | 'tool'
 * @property {string} content - Message content
 * @property {string} [name] - Name for tool messages
 * @property {string} [tool_call_id] - Tool call ID
 * @property {Array} [tool_calls] - Tool calls from assistant
 * @property {Date} [timestamp] - Message timestamp
 */

/**
 * Conversation Memory - Stores and manages conversation history
 */
export class ConversationMemory {
  constructor({ storage, maxTokens = 100000, tokenCounter } = {}) {
    this.storage = storage;
    this.maxTokens = maxTokens;
    this.tokenCounter = tokenCounter;
    this.messages = [];
    this.sessionId = null;
    this.initialized = false;
  }

  /**
   * Initialize conversation table
   */
  async initialize() {
    if (this.initialized) return;
    
    // Use the new storage interface method
    if (typeof this.storage.exec === 'function') {
      await this.storage.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          name TEXT,
          tool_call_id TEXT,
          tool_calls TEXT,
          tokens INTEGER,
          created_at TEXT NOT NULL
        )
      `);
      
      await this.storage.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id)
      `);
      
      await this.storage.exec(`
        CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at)
      `);
    }
    
    this.initialized = true;
  }

  /**
   * Start a new conversation session
   */
  async startSession(sessionId = null) {
    await this.initialize();
    this.sessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.messages = [];
    
    if (!sessionId) {
      // Load existing if sessionId provided
      await this.loadSession(this.sessionId);
    }
    
    return this.sessionId;
  }

  /**
   * Load conversation from storage
   */
  async loadSession(sessionId) {
    await this.initialize();
    
    if (typeof this.storage.all === 'function') {
      const rows = await this.storage.all(
        'SELECT * FROM conversations WHERE session_id = ? ORDER BY created_at ASC',
        [sessionId]
      );
      
      this.messages = rows.map(row => ({
        role: row.role,
        content: row.content,
        name: row.name,
        tool_call_id: row.tool_call_id,
        tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
        timestamp: row.created_at,
      }));
    }
    
    return this.messages;
  }

  /**
   * Add a message to conversation
   */
  async addMessage(message) {
    await this.initialize();
    
    const msg = {
      role: message.role,
      content: message.content,
      name: message.name,
      tool_call_id: message.tool_call_id,
      tool_calls: message.tool_calls,
      timestamp: message.timestamp || new Date().toISOString(),
    };
    
    this.messages.push(msg);
    
    // Persist to storage
    if (typeof this.storage.run === 'function' && this.sessionId) {
      const tokens = this.tokenCounter 
        ? await this.tokenCounter.estimateTokens([msg], { provider: 'openai', model: 'gpt-4o-mini' })
        : 0;
      
      await this.storage.run(
        `INSERT INTO conversations (id, session_id, role, content, name, tool_call_id, tool_calls, tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          this.sessionId,
          msg.role,
          msg.content,
          msg.name || null,
          msg.tool_call_id || null,
          msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
          tokens,
          msg.timestamp,
        ]
      );
    }
    
    // Trim if needed
    await this.trimIfNeeded();
    
    return msg;
  }

  /**
   * Add multiple messages
   */
  async addMessages(messages) {
    for (const msg of messages) {
      await this.addMessage(msg);
    }
  }

  /**
   * Get all messages
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * Get messages for LLM (with token limit)
   */
  async getMessagesForLLM(maxTokens = null) {
    const limit = maxTokens || this.maxTokens;
    let totalTokens = 0;
    const result = [];
    
    // Add messages from newest to oldest until token limit
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      const msgTokens = this.tokenCounter
        ? await this.tokenCounter.estimateTokens([msg], { provider: 'openai', model: 'gpt-4o-mini' })
        : Math.ceil(msg.content.length / 4);
      
      if (totalTokens + msgTokens > limit && result.length > 0) {
        break;
      }
      
      totalTokens += msgTokens;
      result.unshift(msg);
    }
    
    return result;
  }

  /**
   * Trim old messages if over token limit
   */
  async trimIfNeeded() {
    if (!this.tokenCounter) return;
    
    const tokens = await this.tokenCounter.estimateTokens(
      this.messages, 
      { provider: 'openai', model: 'gpt-4o-mini' }
    );
    
    if (tokens > this.maxTokens) {
      // Remove oldest messages (but keep system message)
      const systemMessages = this.messages.filter(m => m.role === 'system');
      const otherMessages = this.messages.filter(m => m.role !== 'system');
      
      // Keep removing oldest non-system messages until under limit
      while (otherMessages.length > 0) {
        otherMessages.shift();
        const remainingTokens = await this.tokenCounter.estimateTokens(
          [...systemMessages, ...otherMessages],
          { provider: 'openai', model: 'gpt-4o-mini' }
        );
        if (remainingTokens <= this.maxTokens) break;
      }
      
      this.messages = [...systemMessages, ...otherMessages];
    }
  }

  /**
   * Clear conversation
   */
  async clear() {
    this.messages = [];
    
    if (typeof this.storage.run === 'function' && this.sessionId) {
      await this.storage.run(
        'DELETE FROM conversations WHERE session_id = ?',
        [this.sessionId]
      );
    }
  }

  /**
   * Get conversation summary
   */
  getSummary() {
    return {
      sessionId: this.sessionId,
      messageCount: this.messages.length,
      roles: this.messages.reduce((acc, m) => {
        acc[m.role] = (acc[m.role] || 0) + 1;
        return acc;
      }, {}),
      firstMessage: this.messages[0]?.timestamp,
      lastMessage: this.messages[this.messages.length - 1]?.timestamp,
    };
  }
}

/**
 * Create conversation memory from config
 */
export async function createConversationMemory(config = {}) {
  const storage = await createStorage(
    config.storage?.type || 'sqlite',
    config.storage?.options || {}
  );
  
  return new ConversationMemory({
    storage,
    maxTokens: config.maxTokens || 100000,
    tokenCounter: config.tokenCounter,
  });
}
