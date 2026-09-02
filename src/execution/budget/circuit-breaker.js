/**
 * Circuit Breaker
 * 
 * Prevents runaway costs by automatically stopping execution when thresholds are exceeded.
 * Implements the circuit breaker pattern for budget protection.
 */

import { globalCostTracker } from './cost-tracker.js';

/**
 * Circuit breaker states
 */
export const CircuitState = {
  CLOSED: 'closed',     // Normal operation
  OPEN: 'open',         // Blocking requests
  HALF_OPEN: 'half_open', // Testing if service recovered
};

/**
 * Circuit Breaker Configuration
 * @typedef {Object} CircuitBreakerConfig
 * @property {number} [costThreshold] - Cost threshold to open circuit (USD)
 * @property {number} [tokenThreshold] - Token threshold to open circuit
 * @property {number} [timeWindow] - Time window for threshold (ms), default 1 hour
 * @property {number} [resetTimeout] - Time before trying half-open (ms), default 5 min
 * @property {number} [failureThreshold] - Number of failures before opening
 * @property {CostTracker} [costTracker] - Cost tracker instance (optional, uses global if not provided)
 */

/**
 * Circuit Breaker for budget protection
 */
export class CircuitBreaker {
  constructor(config = {}) {
    this.config = {
      costThreshold: config.costThreshold || 50.00, // $50 per hour
      tokenThreshold: config.tokenThreshold || 500000, // 500k tokens per hour
      timeWindow: config.timeWindow || 3600000, // 1 hour
      resetTimeout: config.resetTimeout || 300000, // 5 minutes
      failureThreshold: config.failureThreshold || 5,
    };
    
    // BUG FIX: Allow injecting costTracker instead of hardcoding global
    this.costTracker = config.costTracker || globalCostTracker;
    
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.listeners = new Map(); // event -> callbacks
  }

  /**
   * Check if circuit allows execution
   */
  async checkBudget(budgetId, estimatedCost = 0, estimatedTokens = 0) {
    // Check cost tracker budget
    const budgetCheck = this.costTracker.checkBudget(budgetId, estimatedCost, estimatedTokens);
    
    if (!budgetCheck.allowed) {
      this.recordFailure('budget_exceeded', budgetCheck.errors);
      return { allowed: false, reason: 'budget_exceeded', details: budgetCheck.errors };
    }
    
    // Check circuit breaker thresholds
    const now = Date.now();
    const windowStart = now - this.config.timeWindow;
    
    // Get recent costs
    const recentCost = this.costTracker.getCostSince(new Date(windowStart));
    const recentTokens = this.getRecentTokens(windowStart);
    
    if (recentCost >= this.config.costThreshold) {
      this.recordFailure('cost_threshold_exceeded', { 
        current: recentCost, 
        threshold: this.config.costThreshold 
      });
      return { allowed: false, reason: 'cost_threshold_exceeded', details: { current: recentCost, threshold: this.config.costThreshold } };
    }
    
    if (recentTokens >= this.config.tokenThreshold) {
      this.recordFailure('token_threshold_exceeded', { 
        current: recentTokens, 
        threshold: this.config.tokenThreshold 
      });
      return { allowed: false, reason: 'token_threshold_exceeded', details: { current: recentTokens, threshold: this.config.tokenThreshold } };
    }
    
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (now - this.lastStateChange >= this.config.resetTimeout) {
        this.transitionToHalfOpen();
      } else {
        return { allowed: false, reason: 'circuit_open', details: { resetIn: this.config.resetTimeout - (now - this.lastStateChange) } };
      }
    }
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Allow one request to test
      return { allowed: true, reason: 'half_open_test' };
    }
    
    return { allowed: true, reason: 'ok' };
  }

  /**
   * Record successful execution
   */
  recordSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }
    this.failureCount = 0;
  }

  /**
   * Record failure
   */
  recordFailure(reason, details = {}) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    this.emit('failure', { reason, details, failureCount: this.failureCount });
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.transitionToOpen(reason, details);
    }
  }

  /**
   * Transition to OPEN state
   */
  transitionToOpen(reason, details) {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.lastStateChange = Date.now();
      this.emit('open', { reason, details, timestamp: this.lastStateChange });
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  transitionToHalfOpen() {
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChange = Date.now();
    this.emit('half_open', { timestamp: this.lastStateChange });
  }

  /**
   * Transition to CLOSED state
   */
  transitionToClosed() {
    this.state = CircuitState.CLOSED;
    this.lastStateChange = Date.now();
    this.failureCount = 0;
    this.emit('closed', { timestamp: this.lastStateChange });
  }

  /**
   * Get recent token count
   */
  getRecentTokens(since) {
    const history = this.costTracker.costHistory || [];
    return history
      .filter(r => r.timestamp >= new Date(since))
      .reduce((sum, r) => sum + (r.totalTokens || 0), 0);
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      config: this.config,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.lastStateChange = Date.now();
    this.emit('reset', { timestamp: this.lastStateChange });
  }

  /**
   * Force open the circuit
   */
  forceOpen(reason = 'manual') {
    this.transitionToOpen(reason, { manual: true });
  }

  /**
   * Force close the circuit
   */
  forceClose() {
    this.transitionToClosed();
  }

  /**
   * Add event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index >= 0) callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(data);
        } catch (e) {
          console.error(`Circuit breaker listener error:`, e);
        }
      }
    }
  }
}

/**
 * Global circuit breaker instance
 */
export const globalCircuitBreaker = new CircuitBreaker();
