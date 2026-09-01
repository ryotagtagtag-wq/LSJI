/**
 * HITL (Human-in-the-Loop) System
 * 
 * Exports all HITL components:
 * - ApprovalStore: Persistent storage for approvals
 * - Notifier: Multi-channel notifications
 * - ApprovalGate: Approval workflow management
 */

export { ApprovalStore, createApprovalStore } from './store.js';
export { Notifier, NotificationChannel, createNotifier } from './notifier.js';
export { ApprovalGate, createApprovalGate } from './approval-gate.js';
