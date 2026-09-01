/**
 * Approval Store
 * 
 * Persistent storage for approval requests and decisions.
 * Uses the existing storage abstraction.
 */

import { createStorage } from '../../index.js';

/**
 * Approval request record
 * @typedef {Object} ApprovalRecord
 * @property {string} id - Unique approval ID
 * @property {string} action - Action requiring approval
 * @property {Object} context - Context data for the action
 * @property {string} requester - Who requested the approval
 * @property {string} status - 'pending' | 'approved' | 'rejected' | 'expired'
 * @property {Date} createdAt - When request was created
 * @property {Date} [expiresAt] - When request expires
 * @property {Date} [decidedAt] - When decision was made
 * @property {string} [decider] - Who made the decision
 * @property {string} [reason] - Reason for approval/rejection
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Approval Store - Manages approval requests in storage
 */
export class ApprovalStore {
  constructor(storage) {
    this.storage = storage;
    this.initialized = false;
  }

  /**
   * Check if storage is SQL-based (has db with all method)
   */
  isSqlStorage() {
    return this.storage.db && typeof this.storage.db.all === 'function';
  }

  /**
   * Initialize the approval table
   */
  async initialize() {
    if (this.initialized) return;
    
    // Create approvals table if using SQL storage
    if (this.isSqlStorage()) {
      await this.storage.db.exec(`
        CREATE TABLE IF NOT EXISTS approvals (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          context TEXT NOT NULL,
          requester TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          expires_at TEXT,
          decided_at TEXT,
          decider TEXT,
          reason TEXT,
          metadata TEXT
        )
      `);
      
      // Create index for pending approvals
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status)
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at)
      `);
    }
    
    this.initialized = true;
  }

  /**
   * Create a new approval request
   */
  async createApproval(approval) {
    await this.initialize();
    
    const record = {
      id: approval.id,
      action: approval.action,
      context: JSON.stringify(approval.context),
      requester: approval.requester,
      status: 'pending',
      createdAt: approval.createdAt || new Date().toISOString(),
      expiresAt: approval.expiresAt?.toISOString() || null,
      decidedAt: null,
      decider: null,
      reason: null,
      metadata: approval.metadata ? JSON.stringify(approval.metadata) : null,
    };
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `INSERT INTO approvals (id, action, context, requester, status, created_at, expires_at, decided_at, decider, reason, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [record.id, record.action, record.context, record.requester, record.status,
         record.createdAt, record.expiresAt, record.decidedAt, record.decider, record.reason, record.metadata]
      );
    } else {
      // Fallback for memory storage
      if (!this.memoryApprovals) this.memoryApprovals = new Map();
      this.memoryApprovals.set(record.id, record);
    }
    
    return record;
  }

  /**
   * Get approval by ID
   */
  async getApproval(id) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const row = await this.storage.db.get('SELECT * FROM approvals WHERE id = ?', [id]);
      if (!row) return null;
      return this.rowToRecord(row);
    } else {
      return this.memoryApprovals?.get(id) || null;
    }
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(limit = 100) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const rows = await this.storage.db.all(
        'SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC LIMIT ?',
        ['pending', limit]
      );
      return rows.map(r => this.rowToRecord(r));
    } else {
      const approvals = [];
      for (const record of this.memoryApprovals?.values() || []) {
        if (record.status === 'pending') {
          approvals.push(record);
        }
      }
      return approvals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }
  }

  /**
   * Get approvals by requester
   */
  async getApprovalsByRequester(requester, limit = 100) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const rows = await this.storage.db.all(
        'SELECT * FROM approvals WHERE requester = ? ORDER BY created_at DESC LIMIT ?',
        [requester, limit]
      );
      return rows.map(r => this.rowToRecord(r));
    } else {
      const approvals = [];
      for (const record of this.memoryApprovals?.values() || []) {
        if (record.requester === requester) {
          approvals.push(record);
        }
      }
      return approvals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    }
  }

  /**
   * Update approval status (approve/reject)
   */
  async decideApproval(id, { status, decider, reason }) {
    await this.initialize();
    
    const validStatuses = ['approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be 'approved' or 'rejected'`);
    }
    
    const record = await this.getApproval(id);
    if (!record) {
      throw new Error(`Approval not found: ${id}`);
    }
    
    if (record.status !== 'pending') {
      throw new Error(`Approval already decided: ${record.status}`);
    }
    
    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      await this.updateStatus(id, 'expired', null, 'Expired');
      throw new Error('Approval request has expired');
    }
    
    const decidedAt = new Date().toISOString();
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `UPDATE approvals SET status = ?, decided_at = ?, decider = ?, reason = ? WHERE id = ?`,
        [status, decidedAt, decider, reason, id]
      );
    } else {
      record.status = status;
      record.decidedAt = decidedAt;
      record.decider = decider;
      record.reason = reason;
      this.memoryApprovals.set(id, record);
    }
    
    return { ...record, status, decidedAt, decider, reason };
  }

  /**
   * Approve a request
   */
  async approve(id, { decider, reason } = {}) {
    return this.decideApproval(id, { status: 'approved', decider, reason });
  }

  /**
   * Reject a request
   */
  async reject(id, { decider, reason } = {}) {
    return this.decideApproval(id, { status: 'rejected', decider, reason });
  }

  /**
   * Update status (internal)
   */
  async updateStatus(id, status, decider = null, reason = null) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `UPDATE approvals SET status = ?, decided_at = ?, decider = ?, reason = ? WHERE id = ?`,
        [status, new Date().toISOString(), decider, reason, id]
      );
    } else {
      const record = this.memoryApprovals?.get(id);
      if (record) {
        record.status = status;
        record.decidedAt = new Date().toISOString();
        record.decider = decider;
        record.reason = reason;
        this.memoryApprovals.set(id, record);
      }
    }
  }

  /**
   * Clean up expired approvals
   */
  async cleanupExpired() {
    await this.initialize();
    
    const now = new Date().toISOString();
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `UPDATE approvals SET status = 'expired' WHERE status = 'pending' AND expires_at < ?`,
        [now]
      );
    } else {
      for (const record of this.memoryApprovals?.values() || []) {
        if (record.status === 'pending' && record.expiresAt && new Date(record.expiresAt) < new Date()) {
          record.status = 'expired';
          this.memoryApprovals.set(record.id, record);
        }
      }
    }
  }

  /**
   * Convert database row to record
   */
  rowToRecord(row) {
    return {
      id: row.id,
      action: row.action,
      context: JSON.parse(row.context),
      requester: row.requester,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      decidedAt: row.decided_at,
      decider: row.decider,
      reason: row.reason,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }
}

/**
 * Create approval store from storage config
 */
export async function createApprovalStore(storageConfig = {}) {
  const storage = await createStorage(
    storageConfig.type || 'sqlite',
    storageConfig.options || {}
  );
  const store = new ApprovalStore(storage);
  await store.initialize();
  return store;
}
