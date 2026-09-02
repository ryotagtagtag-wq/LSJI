/**
 * Storage Abstraction Interface
 * 
 * Defines the contract for all storage backends.
 * Implementations: SqliteStorage, BetterSqliteStorage, MemoryStorage
 */

/**
 * Battle record
 * @typedef {Object} BattleRecord
 * @property {'train'|'test'} mode - Battle mode
 * @property {number} handA - AI's action
 * @property {number} handB - Opponent's action
 * @property {number} reward - Reward (-1, 0, 1)
 * @property {string} createdAt - ISO timestamp
 */

/**
 * Q-table record
 * @typedef {Object} QTableRecord
 * @property {string} state - State key
 * @property {number} action - Action
 * @property {number} qValue - Q-value
 */

/**
 * Performance stat by mode
 * @typedef {Object} PerformanceStat
 * @property {string} mode - 'train' or 'test'
 * @property {number} total - Total battles
 * @property {number} winRate - Win rate percentage
 */

/**
 * Abstract Storage Interface
 * All storage backends must implement these methods.
 */
export class Storage {
  /**
   * Initialize the storage (create tables, connections, etc.)
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented');
  }

  /**
   * Close the storage connection
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() must be implemented');
  }

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @returns {Promise<{key: string, value: string}|null>}
   */
  async getSetting(key) {
    throw new Error('getSetting() must be implemented');
  }

  /**
   * Set a setting value
   * @param {string} key - Setting key
   * @param {string|number} value - Setting value
   * @returns {Promise<void>}
   */
  async setSetting(key, value) {
    throw new Error('setSetting() must be implemented');
  }

  /**
   * Get all Q-table records
   * @returns {Promise<Array<QTableRecord>>}
   */
  async getQTable() {
    throw new Error('getQTable() must be implemented');
  }

  /**
   * Update Q-value for state-action pair
   * @param {string} state - State key
   * @param {number} action - Action
   * @param {number} qValue - Q-value
   * @returns {Promise<void>}
   */
  async updateQ(state, action, qValue) {
    throw new Error('updateQ() must be implemented');
  }

  /**
   * Add a battle record
   * @param {BattleRecord} record - Battle record
   * @returns {Promise<void>}
   */
  async addBattle(record) {
    throw new Error('addBattle() must be implemented');
  }

  /**
   * Get today's battle count
   * @returns {Promise<number>}
   */
  async getTodayBattleCount() {
    throw new Error('getTodayBattleCount() must be implemented');
  }

  /**
   * Get performance statistics by mode
   * @returns {Promise<Array<PerformanceStat>>}
   */
  async getPerformanceStats() {
    throw new Error('getPerformanceStats() must be implemented');
  }

  // ===== Generic SQL methods for custom queries =====

  /**
   * Execute a SELECT query returning all rows
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array<Object>>}
   */
  async all(sql, params = []) {
    throw new Error('all() must be implemented');
  }

  /**
   * Execute a SELECT query returning first row
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|null>}
   */
  async get(sql, params = []) {
    throw new Error('get() must be implemented');
  }

  /**
   * Execute an INSERT/UPDATE/DELETE query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<{changes: number, lastInsertRowid: number|bigint}>}
   */
  async run(sql, params = []) {
    throw new Error('run() must be implemented');
  }

  /**
   * Execute multiple SQL statements
   * @param {string} sql - SQL statements
   * @returns {Promise<void>}
   */
  async exec(sql) {
    throw new Error('exec() must be implemented');
  }

  /**
   * Prepare a statement for repeated execution
   * @param {string} sql - SQL query
   * @returns {Object} Prepared statement with run(), get(), all() methods
   */
  prepare(sql) {
    throw new Error('prepare() must be implemented');
  }
}

/**
 * Create storage instance by type
 * @param {'sqlite'|'better-sqlite'|'memory'} type - Storage type
 * @param {Object} options - Storage options
 * @returns {Promise<Storage>} Initialized storage instance
 */
export async function createStorage(type, options = {}) {
  let storage;
  
  switch (type) {
    case 'sqlite':
      const { SqliteStorage } = await import('./sqlite.js');
      storage = new SqliteStorage(options.path || './lsji.db');
      break;
    case 'better-sqlite':
      const { BetterSqliteStorage } = await import('./better-sqlite.js');
      storage = new BetterSqliteStorage(options.path || './lsji.db');
      break;
    case 'memory':
    default:
      const { MemoryStorage } = await import('./memory.js');
      storage = new MemoryStorage();
      break;
  }
  
  await storage.initialize();
  return storage;
}
