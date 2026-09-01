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
    this.settings.set('is_active', '1');
  }
}
