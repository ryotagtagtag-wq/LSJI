/**
 * In-Memory Storage Implementation
 * 
 * Pure JavaScript in-memory storage using Maps/Arrays.
 * Ideal for testing, CI, and ephemeral workloads.
 * No persistence - data lost on process exit.
 */

import { Storage } from './index.js';

/**
 * MemoryStorage - In-memory implementation
 */
export class MemoryStorage extends Storage {
  constructor() {
    super();
    this.settings = new Map();
    this.battleHistory = [];
    this.qTable = new Map(); // key: "state:action" -> q_value
    this.conversations = []; // For conversation memory
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.settings.set('is_active', '1');
    this.initialized = true;
  }

  async close() {
    // No-op for memory storage
  }

  async getSetting(key) {
    const value = this.settings.get(key);
    return value ? { key, value } : null;
  }

  async setSetting(key, value) {
    this.settings.set(key, String(value));
  }

  async getQTable() {
    const results = [];
    for (const [key, qValue] of this.qTable) {
      const [state, action] = key.split(':');
      results.push({ state, action: parseInt(action, 10), q_value: qValue });
    }
    return results.sort((a, b) => a.state.localeCompare(b.state) || a.action - b.action);
  }

  async updateQ(state, action, qValue) {
    this.qTable.set(`${state}:${action}`, qValue);
  }

  async addBattle(record) {
    this.battleHistory.push({
      id: this.battleHistory.length + 1,
      ...record
    });
  }

  async getTodayBattleCount() {
    const today = new Date().toISOString().split('T')[0];
    return this.battleHistory.filter(
      r => r.createdAt.startsWith(today)
    ).length;
  }

  async getPerformanceStats() {
    const stats = new Map();
    
    for (const record of this.battleHistory) {
      const mode = record.mode;
      if (!stats.has(mode)) {
        stats.set(mode, { total: 0, wins: 0 });
      }
      const stat = stats.get(mode);
      stat.total++;
      if (record.reward > 0) stat.wins++;
    }
    
    return Array.from(stats.entries()).map(([mode, stat]) => ({
      mode,
      total: stat.total,
      win_rate: stat.total > 0 ? Math.round((stat.wins / stat.total) * 1000) / 10 : 0
    }));
  }

  /**
   * Clear all data (useful for testing)
   */
  clear() {
    this.settings.clear();
    this.battleHistory = [];
    this.qTable.clear();
    this.conversations = [];
    this.settings.set('is_active', '1');
  }

  // ===== Generic SQL methods (in-memory implementation) =====

  async all(sql, params = []) {
    // Simple in-memory SQL-like query parser for basic SELECT queries
    // This is a simplified implementation for testing
    const lowerSql = sql.toLowerCase().trim();
    
    if (lowerSql.startsWith('select')) {
      if (lowerSql.includes('from conversations')) {
        let results = [...this.conversations];
        
        // Simple WHERE clause handling for session_id
        const whereMatch = lowerSql.match(/where\s+session_id\s*=\s*\?/i);
        if (whereMatch && params.length > 0) {
          const sessionId = params[0];
          results = results.filter(r => r.session_id === sessionId);
        }
        
        // ORDER BY created_at ASC
        results.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        return results;
      }
      
      if (lowerSql.includes('from idempotency_keys')) {
        // For idempotency store
        return [];
      }
      
      if (lowerSql.includes('from checkpoints')) {
        // For execution engine
        return [];
      }
      
      if (lowerSql.includes('from approvals')) {
        // For HITL
        return [];
      }
    }
    
    return [];
  }

  async get(sql, params = []) {
    const results = await this.all(sql, params);
    return results[0] || null;
  }

  async run(sql, params = []) {
    const lowerSql = sql.toLowerCase().trim();
    
    if (lowerSql.startsWith('insert')) {
      if (lowerSql.includes('into conversations')) {
        // INSERT INTO conversations (id, session_id, role, content, name, tool_call_id, tool_calls, tokens, created_at)
        const id = params[0];
        const sessionId = params[1];
        const role = params[2];
        const content = params[3];
        const name = params[4];
        const toolCallId = params[5];
        const toolCalls = params[6];
        const tokens = params[7];
        const createdAt = params[8];
        
        this.conversations.push({
          id,
          session_id: sessionId,
          role,
          content,
          name,
          tool_call_id: toolCallId,
          tool_calls: toolCalls,
          tokens,
          created_at: createdAt,
        });
      }
      
      if (lowerSql.includes('into idempotency_keys')) {
        // For idempotency store
      }
      
      if (lowerSql.includes('into checkpoints')) {
        // For execution engine
      }
      
      if (lowerSql.includes('into approvals')) {
        // For HITL
      }
      
      if (lowerSql.includes('into settings')) {
        // Handled by setSetting
      }
      
      if (lowerSql.includes('into battle_history')) {
        // Handled by addBattle
      }
      
      if (lowerSql.includes('into q_table')) {
        // Handled by updateQ
      }
      
      return { changes: 1, lastInsertRowid: Date.now() };
    }
    
    if (lowerSql.startsWith('update')) {
      if (lowerSql.includes('idempotency_keys')) {
        // For idempotency store
      }
      
      if (lowerSql.includes('approvals')) {
        // For HITL
      }
      
      return { changes: 1, lastInsertRowid: 0 };
    }
    
    if (lowerSql.startsWith('delete')) {
      if (lowerSql.includes('from conversations')) {
        if (params[0]) {
          this.conversations = this.conversations.filter(c => c.session_id !== params[0]);
        }
      }
      
      if (lowerSql.includes('from idempotency_keys')) {
        // For idempotency store
      }
      
      return { changes: 1, lastInsertRowid: 0 };
    }
    
    return { changes: 0, lastInsertRowid: 0 };
  }

  async exec(sql) {
    // No-op for memory storage
  }

  prepare(sql) {
    const self = this;
    return {
      run: async (...params) => (await self.run(sql, params)),
      get: async (...params) => (await self.get(sql, params)),
      all: async (...params) => (await self.all(sql, params)),
    };
  }

  // Helper methods for conversation memory
  _addConversation(message) {
    this.conversations.push(message);
  }

  _getConversations(sessionId) {
    return this.conversations.filter(c => c.session_id === sessionId);
  }

  _clearConversations(sessionId) {
    this.conversations = this.conversations.filter(c => c.session_id !== sessionId);
  }

  // For idempotency store
  _getIdempotencyKeys() {
    return this.idempotencyKeys || new Map();
  }

  _setIdempotencyKeys(keys) {
    this.idempotencyKeys = keys;
  }

  // For checkpoints
  _getCheckpoints() {
    return this.checkpoints || new Map();
  }

  _setCheckpoints(checkpoints) {
    this.checkpoints = checkpoints;
  }

  // For approvals
  _getApprovals() {
    return this.approvals || new Map();
  }

  _setApprovals(approvals) {
    this.approvals = approvals;
  }
}
