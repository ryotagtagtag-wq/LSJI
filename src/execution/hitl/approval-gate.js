/**
 * HITL Approval Gate
 * 
 * Human-in-the-Loop approval workflow for sensitive operations.
 * Integrates with storage, notifier, and provides timeout/escalation.
 */

import { v4 as uuidv4 } from 'uuid';
import { ApprovalStore, createApprovalStore } from './store.js';
import { Notifier } from './notifier.js';

/**
 * Approval request options
 * @typedef {Object} ApprovalRequest
 * @property {string} action - Action identifier (e.g., 'send_email', 'charge_payment')
 * @property {Object} context - Context data for human review
 * @property {string} requester - Who is requesting approval
 * @property {number} [timeout] - Timeout in ms (default: 5 min)
 * @property {Array<string>} [channels] - Notification channels
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * Approval result
 * @typedef {Object} ApprovalResult
 * @property {string} id - Approval ID
 * @property {string} status - 'approved' | 'rejected' | 'expired'
 * @property {string} [decider] - Who decided
 * @property {string} [reason] - Reason for decision
 * @property {Date} decidedAt - When decision was made
 */

/**
 * Approval Gate - Manages human approval workflows
 */
export class ApprovalGate {
  constructor({ store, notifier, defaultTimeout = 300000 } = {}) {
    this.store = store;
    this.notifier = notifier;
    this.defaultTimeout = defaultTimeout;
    this.pendingApprovals = new Map(); // id -> { resolve, reject, timeout }
  }

  /**
   * Request approval for an action
   * Returns a promise that resolves when approved, rejects when rejected/expired
   */
  async requestApproval(request) {
    const id = uuidv4();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + (request.timeout || this.defaultTimeout));
    
    const approval = {
      id,
      action: request.action,
      context: request.context,
      requester: request.requester,
      status: 'pending',
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: request.metadata,
    };
    
    // Store in database
    await this.store.createApproval(approval);
    
    // Notify via configured channels
    await this.notifier.notify(approval, request.channels);
    
    // Return promise that resolves when decision is made
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(async () => {
        // Check if still pending (not decided yet)
        const current = await this.store.getApproval(id);
        if (current && current.status === 'pending') {
          await this.store.updateStatus(id, 'expired', null, 'Timeout');
          this.pendingApprovals.delete(id);
          reject(new Error(`Approval timeout: ${id}`));
        }
      }, request.timeout || this.defaultTimeout);
      
      this.pendingApprovals.set(id, { resolve, reject, timeout: timeoutHandle });
    });
  }

  /**
   * Approve a pending request
   */
  async approve(id, { decider, reason } = {}) {
    const result = await this.store.approve(id, { decider, reason });
    
    // Resolve pending promise
    const pending = this.pendingApprovals.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(result);
      this.pendingApprovals.delete(id);
    }
    
    // Notify
    await this.notifier.notify({ ...result, status: 'approved' });
    
    return result;
  }

  /**
   * Reject a pending request
   */
  async reject(id, { decider, reason } = {}) {
    const result = await this.store.reject(id, { decider, reason });
    
    // Reject pending promise
    const pending = this.pendingApprovals.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Approval rejected: ${reason || 'No reason provided'}`));
      this.pendingApprovals.delete(id);
    }
    
    // Notify
    await this.notifier.notify({ ...result, status: 'rejected' });
    
    return result;
  }

  /**
   * Get approval status
   */
  async getApproval(id) {
    return this.store.getApproval(id);
  }

  /**
   * Get all pending approvals
   */
  async getPendingApprovals(limit = 100) {
    return this.store.getPendingApprovals(limit);
  }

  /**
   * Get approvals by requester
   */
  async getApprovalsByRequester(requester, limit = 100) {
    return this.store.getApprovalsByRequester(requester, limit);
  }

  /**
   * Clean up expired approvals
   */
  async cleanup() {
    await this.store.cleanupExpired();
  }

  /**
   * Check if action requires approval
   * Override this to define custom approval rules
   */
  requiresApproval(action, context = {}) {
    // Default: require approval for sensitive actions
    const sensitiveActions = [
      'send_email',
      'charge_payment',
      'delete_data',
      'modify_user',
      'deploy_code',
      'run_sql',
      'api_call',
      'file_write',
      'ssh_command',
    ];
    
    return sensitiveActions.includes(action);
  }

  /**
   * Execute action with automatic approval if needed
   */
  async executeWithApproval(action, context, executor, requester = 'agent') {
    if (!this.requiresApproval(action, context)) {
      return executor();
    }
    
    // Request approval
    const approval = await this.requestApproval({
      action,
      context,
      requester,
    });
    
    if (approval.status === 'approved') {
      return executor();
    } else {
      throw new Error(`Action ${action} was ${approval.status}`);
    }
  }
}

/**
 * Create approval gate from config
 */
export async function createApprovalGate(config = {}) {
  const store = await createApprovalStore(config.store || {});
  const notifier = new Notifier(config.notifier || {});
  
  return new ApprovalGate({
    store,
    notifier,
    defaultTimeout: config.defaultTimeout,
  });
}
