/**
 * SQLite Storage Implementation using node:sqlite (Node.js 22+ built-in)
 * 
 * Zero-dependency SQLite implementation using Node.js built-in module.
 * Recommended for most use cases.
 */

import { DatabaseSync } from 'node:sqlite';
import { Storage } from './index.js';

/**
 * SqliteStorage - Uses node:sqlite (synchronous API)
 */
export class SqliteStorage extends Storage {
  /**
   * @param {string} path - Database file path
   */
  constructor(path = './lsji.db') {
    super();
    this.path = path;
    this.db = null;
  }

  async initialize() {
    this.db = new DatabaseSync(this.path);
    
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS battle_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL CHECK (mode IN ('train', 'test')),
        hand_a INTEGER NOT NULL,
        hand_b INTEGER NOT NULL,
        reward INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS q_table (
        state TEXT NOT NULL,
        action INTEGER NOT NULL,
        q_value REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (state, action)
      );
      
      CREATE INDEX IF NOT EXISTS idx_battle_history_date 
        ON battle_history(created_at);
      CREATE INDEX IF NOT EXISTS idx_battle_history_mode 
        ON battle_history(mode);
    `);
    
    // Initialize default settings
    const stmt = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    stmt.run('is_active', '1');
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async getSetting(key) {
    const stmt = this.db.prepare('SELECT key, value FROM settings WHERE key = ?');
    const row = stmt.get(key);
    return row ? { key: row.key, value: row.value } : null;
  }

  async setSetting(key, value) {
    const stmt = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    );
    stmt.run(key, String(value), String(value));
  }

  async getQTable() {
    const stmt = this.db.prepare('SELECT state, action, q_value FROM q_table ORDER BY state, action');
    return stmt.all();
  }

  async updateQ(state, action, qValue) {
    const stmt = this.db.prepare(`
      INSERT INTO q_table (state, action, q_value) VALUES (?, ?, ?)
      ON CONFLICT(state, action) DO UPDATE SET q_value = ?
    `);
    stmt.run(state, action, qValue, qValue);
  }

  async addBattle(record) {
    const stmt = this.db.prepare(`
      INSERT INTO battle_history (mode, hand_a, hand_b, reward, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(record.mode, record.handA, record.handB, record.reward, record.createdAt);
  }

  async getTodayBattleCount() {
    const today = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM battle_history 
      WHERE date(created_at) = date(?)
    `);
    const row = stmt.get(today);
    return row ? row.count : 0;
  }

  async getPerformanceStats() {
    const stmt = this.db.prepare(`
      SELECT 
        mode,
        COUNT(*) as total,
        ROUND(AVG(CASE WHEN reward > 0 THEN 1.0 ELSE 0.0 END) * 100, 1) as win_rate
      FROM battle_history 
      GROUP BY mode
    `);
    return stmt.all();
  }

  // ===== Generic SQL methods =====

  async all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  async get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  async run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  async exec(sql) {
    this.db.exec(sql);
  }

  prepare(sql) {
    const stmt = this.db.prepare(sql);
    return {
      run: (...params) => stmt.run(...params),
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
    };
  }
}
