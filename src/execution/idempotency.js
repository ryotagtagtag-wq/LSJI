/**
 * Idempotency System
 * 
 * Prevents duplicate operations on retries using idempotency keys.
 * Integrates with existing storage abstraction.
 */

import { createStorage } from '../index.js';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

/**
 * Idempotency record
 * @typedef {Object} IdempotencyRecord
 * @property {string} key - Idempotency key
 * @property {string} operation - Operation identifier
 * @property {Object} request - Request payload (hashed)
 * @property {Object} response - Response payload
 * @property {string} status - 'pending' | 'completed' | 'failed'
 * @property {Date} createdAt
 * @property {Date} completedAt
 * @property {Date} expiresAt
 */

/**
 * Idempotency Store - Manages idempotency keys
 */
export class IdempotencyStore {
  constructor(storage, options = {}) {
    this.storage = storage;
    this.ttl = options.ttl || 86400000; // 24 hours default
    this.initialized = false;
  }

  /**
   * Check if storage is SQL-based
   */
  isSqlStorage() {
    return this.storage.db && typeof this.storage.db.all === 'function';
  }

  /**
   * Initialize the idempotency table
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.isSqlStorage()) {
      await this.storage.db.exec(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          key TEXT PRIMARY KEY,
          operation TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          request_data TEXT,
          response_data TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          completed_at TEXT,
          expires_at TEXT NOT NULL
        )
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at)
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_idempotency_operation ON idempotency_keys(operation)
      `);
    }
    
    this.initialized = true;
  }

  /**
   * Generate a new idempotency key
   */
  generateKey(prefix = 'idem') {
    return `${prefix}_${uuidv4()}`;
  }

  /**
   * Create hash of request for deduplication
   * BUG FIX: Use native Web Crypto API instead of require('crypto')
   */
  hashRequest(request) {
    const data = JSON.stringify(request);
    const hashBuffer = createHash('sha256').update(data).digest();
    return Buffer.from(hashBuffer).toString('hex');
  }

  /**
   * Transform database row or memory record to standard format
   */
  _transformRecord(record) {
    return {
      key: record.key,
      operation: record.operation,
      requestHash: record.request_hash || record.requestHash,
      request: (record.request_data || record.requestData) ? JSON.parse(record.request_data || record.requestData) : null,
      response: (record.response_data || record.responseData) ? JSON.parse(record.response_data || record.responseData) : null,
      status: record.status,
      createdAt: record.created_at || record.createdAt,
      completedAt: record.completed_at || record.completedAt,
      expiresAt: record.expires_at || record.expiresAt,
    };
  }

  /**
   * Check if key exists and return cached response
   * BUG FIX: Added request parameter to verify hash matches
   * @param {string} key - Idempotency key
   * @param {Object} [request] - Optional request to verify hash against stored hash
   * @returns {Promise<Object|null>} Cached record or null
   */
  async check(key, request = null) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const row = await this.storage.db.get(
        'SELECT * FROM idempotency_keys WHERE key = ? AND expires_at > ?',
        [key, new Date().toISOString()]
      );
      
      if (row) {
        // BUG FIX: Verify request hash matches if request provided
        if (request !== null) {
          const currentHash = this.hashRequest(request);
          if (row.request_hash !== currentHash) {
            // Hash mismatch - different request with same key, treat as new
            return null;
          }
        }
        
        return this._transformRecord(row);
      }
    } else {
      // Memory fallback
      if (!this.memoryKeys) this.memoryKeys = new Map();
      const record = this.memoryKeys.get(key);
      if (record && new Date(record.expiresAt) > new Date()) {
        // BUG FIX: Verify request hash matches if request provided
        if (request !== null) {
          const currentHash = this.hashRequest(request);
          if (record.requestHash !== currentHash) {
            return null;
          }
        }
        return this._transformRecord(record);
      }
    }
    
    return null;
  }

  /**
   * Reserve an idempotency key (mark as pending)
   */
  async reserve(key, operation, request) {
    await this.initialize();
    
    const requestHash = this.hashRequest(request);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.ttl).toISOString();
    
    const record = {
      key,
      operation,
      requestHash,
      requestData: JSON.stringify(request),
      responseData: null,
      status: 'pending',
      createdAt,
      completedAt: null,
      expiresAt,
    };
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `INSERT INTO idempotency_keys (key, operation, request_hash, request_data, response_data, status, created_at, completed_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [key, operation, requestHash, record.requestData, null, 'pending', createdAt, null, expiresAt]
      );
    } else {
      if (!this.memoryKeys) this.memoryKeys = new Map();
      this.memoryKeys.set(key, record);
    }
    
    return record;
  }

  /**
   * Complete an idempotency key with response
   */
  async complete(key, response) {
    await this.initialize();
    
    const completedAt = new Date().toISOString();
    const responseData = JSON.stringify(response);
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `UPDATE idempotency_keys SET status = ?, response_data = ?, completed_at = ? WHERE key = ?`,
        ['completed', responseData, completedAt, key]
      );
    } else {
      const record = this.memoryKeys?.get(key);
      if (record) {
        record.status = 'completed';
        record.responseData = responseData;
        record.completedAt = completedAt;
        this.memoryKeys.set(key, record);
      }
    }
  }

  /**
   * Mark key as failed
   */
  async fail(key, error) {
    await this.initialize();
    
    const completedAt = new Date().toISOString();
    const errorData = JSON.stringify({ error: error.message || String(error) });
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `UPDATE idempotency_keys SET status = ?, response_data = ?, completed_at = ? WHERE key = ?`,
        ['failed', errorData, completedAt, key]
      );
    } else {
      const record = this.memoryKeys?.get(key);
      if (record) {
        record.status = 'failed';
        record.responseData = errorData;
        record.completedAt = completedAt;
        this.memoryKeys.set(key, record);
      }
    }
  }

  /**
   * Execute operation with idempotency
   * BUG FIX: Pass request to check() for hash verification
   */
  async execute(key, operation, request, executor) {
    // Check for existing - BUG FIX: Pass request for hash verification
    const existing = await this.check(key, request);
    if (existing) {
      if (existing.status === 'completed') {
        return { ...existing.response, idempotent: true };
      }
      if (existing.status === 'failed') {
        throw new Error(`Previous execution failed: ${existing.response?.error}`);
      }
      if (existing.status === 'pending') {
        throw new Error(`Operation already in progress: ${key}`);
      }
    }
    
    // Reserve key
    await this.reserve(key, operation, request);
    
    try {
      const response = await executor();
      await this.complete(key, response);
      return { ...response, idempotent: false };
    } catch (error) {
      await this.fail(key, error);
      throw error;
    }
  }

  /**
   * Execute with auto-generated key
   */
  async executeAuto(operation, request, executor, prefix = 'auto') {
    const key = this.generateKey(prefix);
    return this.execute(key, operation, request, executor);
  }

  /**
   * Clean up expired keys
   */
  async cleanup() {
    await this.initialize();
    
    const now = new Date().toISOString();
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        'DELETE FROM idempotency_keys WHERE expires_at < ?',
        [now]
      );
    } else {
      for (const [key, record] of this.memoryKeys?.entries() || []) {
        if (new Date(record.expiresAt) < new Date()) {
          this.memoryKeys.delete(key);
        }
      }
    }
  }

  /**
   * Get all keys for an operation
   */
  async getByOperation(operation, limit = 100) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const rows = await this.storage.db.all(
        'SELECT * FROM idempotency_keys WHERE operation = ? ORDER BY created_at DESC LIMIT ?',
        [operation, limit]
      );
      return rows.map(r => this._transformRecord(r));
    }
    
    return [];
  }
}

/**
 * Create idempotency store from config
 */
export async function createIdempotencyStore(config = {}) {
  const storage = await createStorage(
    config.type || 'sqlite',
    config.options || {}
  );
  const store = new IdempotencyStore(storage, { ttl: config.ttl });
  await store.initialize();
  return store;
}
