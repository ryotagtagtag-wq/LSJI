/**
 * Cost Tracker
 * 
 * Tracks API costs with provider-specific pricing and budget limits.
 */

import { globalTokenCounter } from './token-counter.js';

/**
 * Cost record
 * @typedef {Object} CostRecord
 * @property {number} cost - Cost in USD
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {string} model
 * @property {string} provider
 * @property {Date} timestamp
 * @property {string} [operation] - Operation identifier
 * @property {string} [budgetId] - Budget identifier
 */

/**
 * Budget configuration
 * @typedef {Object} BudgetConfig
 * @property {number} [maxCostPerRun] - Maximum cost per run (USD)
 * @property {number} [maxCostPerDay] - Maximum cost per day (USD)
 * @property {number} [maxCostPerMonth] - Maximum cost per month (USD)
 * @property {number} [maxTokensPerRun] - Maximum tokens per run
 * @property {number} [alertThreshold] - Alert threshold (0-1), default 0.8
 */

/**
 * Cost Tracker - Tracks costs and enforces budgets
 */
export class CostTracker {
  constructor(config = {}) {
    this.config = {
      maxCostPerRun: config.maxCostPerRun || 10.00,
      maxCostPerDay: config.maxCostPerDay || 50.00,
      maxCostPerMonth: config.maxCostPerMonth || 500.00,
      maxTokensPerRun: config.maxTokensPerRun || 100000,
      alertThreshold: config.alertThreshold || 0.8,
    };
    
    this.costHistory = [];
    this.runCosts = new Map(); // budgetId -> accumulated cost
    this.runTokens = new Map(); // budgetId -> accumulated tokens
    this.alerts = [];
    this.listeners = new Map(); // event -> callbacks
  }

  /**
   * Record cost from LLM usage
   */
  recordCost(record) {
    const costRecord = {
      ...record,
      timestamp: record.timestamp || new Date(),
    };
    this.costHistory.push(costRecord);
    
    // Track per budget
    if (record.budgetId) {
      const currentCost = this.runCosts.get(record.budgetId) || 0;
      this.runCosts.set(record.budgetId, currentCost + costRecord.cost);
      
      const currentTokens = this.runTokens.get(record.budgetId) || 0;
      this.runTokens.set(record.budgetId, currentTokens + (record.totalTokens || 0));
    }
    
    // Check alerts
    this.checkAlerts(costRecord);
    
    return costRecord;
  }

  /**
   * Check and trigger alerts
   */
  checkAlerts(record) {
    if (!record.budgetId) return;
    
    const runCost = this.runCosts.get(record.budgetId) || 0;
    const runTokens = this.runTokens.get(record.budgetId) || 0;
    
    // Check run cost limit
    if (this.config.maxCostPerRun > 0) {
      const ratio = runCost / this.config.maxCostPerRun;
      if (ratio >= 1.0) {
        this.triggerAlert('run_cost_exceeded', {
          budgetId: record.budgetId,
          current: runCost,
          limit: this.config.maxCostPerRun,
          ratio,
        });
      } else if (ratio >= this.config.alertThreshold) {
        this.triggerAlert('run_cost_warning', {
          budgetId: record.budgetId,
          current: runCost,
          limit: this.config.maxCostPerRun,
          ratio,
        });
      }
    }
    
    // Check run token limit
    if (this.config.maxTokensPerRun > 0) {
      const ratio = runTokens / this.config.maxTokensPerRun;
      if (ratio >= 1.0) {
        this.triggerAlert('run_tokens_exceeded', {
          budgetId: record.budgetId,
          current: runTokens,
          limit: this.config.maxTokensPerRun,
          ratio,
        });
      } else if (ratio >= this.config.alertThreshold) {
        this.triggerAlert('run_tokens_warning', {
          budgetId: record.budgetId,
          current: runTokens,
          limit: this.config.maxTokensPerRun,
          ratio,
        });
      }
    }
    
    // Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCost = this.getCostSince(todayStart);
    if (this.config.maxCostPerDay > 0) {
      const ratio = todayCost / this.config.maxCostPerDay;
      if (ratio >= 1.0) {
        this.triggerAlert('daily_cost_exceeded', { current: todayCost, limit: this.config.maxCostPerDay, ratio });
      } else if (ratio >= this.config.alertThreshold) {
        this.triggerAlert('daily_cost_warning', { current: todayCost, limit: this.config.maxCostPerDay, ratio });
      }
    }
    
    // Check monthly limit
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCost = this.getCostSince(monthStart);
    if (this.config.maxCostPerMonth > 0) {
      const ratio = monthCost / this.config.maxCostPerMonth;
      if (ratio >= 1.0) {
        this.triggerAlert('monthly_cost_exceeded', { current: monthCost, limit: this.config.maxCostPerMonth, ratio });
      } else if (ratio >= this.config.alertThreshold) {
        this.triggerAlert('monthly_cost_warning', { current: monthCost, limit: this.config.maxCostPerMonth, ratio });
      }
    }
  }

  /**
   * Trigger alert - Node.js compatible event emitter pattern
   */
  triggerAlert(type, data) {
    const alert = { type, data, timestamp: new Date() };
    this.alerts.push(alert);
    
    // Emit event for external handlers (Node.js compatible)
    this.emit('alert', alert);
    
    return alert;
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
          console.error(`Cost tracker listener error:`, e);
        }
      }
    }
  }

  /**
   * Get alerts
   */
  getAlerts(since = null) {
    let filtered = this.alerts;
    if (since) {
      filtered = this.alerts.filter(a => a.timestamp >= since);
    }
    return filtered;
  }

  /**
   * Clear alerts
   */
  clearAlerts() {
    this.alerts = [];
  }

  /**
   * Get cost since a date
   */
  getCostSince(since) {
    return this.costHistory
      .filter(r => r.timestamp >= since)
      .reduce((sum, r) => sum + r.cost, 0);
  }

  /**
   * Get cost for a specific budget
   */
  getRunCost(budgetId) {
    return this.runCosts.get(budgetId) || 0;
  }

  /**
   * Get tokens for a specific budget
   */
  getRunTokens(budgetId) {
    return this.runTokens.get(budgetId) || 0;
  }

  /**
   * Check if budget allows an operation
   */
  checkBudget(budgetId, estimatedCost = 0, estimatedTokens = 0) {
    const currentCost = this.getRunCost(budgetId);
    const currentTokens = this.getRunTokens(budgetId);
    
    const projectedCost = currentCost + estimatedCost;
    const projectedTokens = currentTokens + estimatedTokens;
    
    const result = {
      allowed: true,
      warnings: [],
      errors: [],
    };
    
    if (this.config.maxCostPerRun > 0 && projectedCost > this.config.maxCostPerRun) {
      result.allowed = false;
      result.errors.push({
        type: 'max_cost_per_run_exceeded',
        current: currentCost,
        projected: projectedCost,
        limit: this.config.maxCostPerRun,
      });
    }
    
    if (this.config.maxTokensPerRun > 0 && projectedTokens > this.config.maxTokensPerRun) {
      result.allowed = false;
      result.errors.push({
        type: 'max_tokens_per_run_exceeded',
        current: currentTokens,
        projected: projectedTokens,
        limit: this.config.maxTokensPerRun,
      });
    }
    
    // Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCost = this.getCostSince(todayStart);
    if (this.config.maxCostPerDay > 0 && todayCost + estimatedCost > this.config.maxCostPerDay) {
      result.allowed = false;
      result.errors.push({
        type: 'max_daily_cost_exceeded',
        current: todayCost,
        projected: todayCost + estimatedCost,
        limit: this.config.maxCostPerDay,
      });
    }
    
    // Check monthly limit
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCost = this.getCostSince(monthStart);
    if (this.config.maxCostPerMonth > 0 && monthCost + estimatedCost > this.config.maxCostPerMonth) {
      result.allowed = false;
      result.errors.push({
        type: 'max_monthly_cost_exceeded',
        current: monthCost,
        projected: monthCost + estimatedCost,
        limit: this.config.maxCostPerMonth,
      });
    }
    
    // Warnings
    if (this.config.maxCostPerRun > 0) {
      const ratio = projectedCost / this.config.maxCostPerRun;
      if (ratio >= this.config.alertThreshold) {
        result.warnings.push({
          type: 'cost_warning',
          ratio,
          current: projectedCost,
          limit: this.config.maxCostPerRun,
        });
      }
    }
    
    return result;
  }

  /**
   * Reset run budget (for new run)
   */
  resetRunBudget(budgetId) {
    this.runCosts.delete(budgetId);
    this.runTokens.delete(budgetId);
  }

  /**
   * Get total cost
   */
  getTotalCost(since = null) {
    return this.getCostSince(since);
  }

  /**
   * Get cost breakdown by model
   */
  getCostByModel(since = null) {
    let filtered = this.costHistory;
    if (since) {
      filtered = this.costHistory.filter(r => r.timestamp >= since);
    }
    
    const byModel = {};
    for (const r of filtered) {
      const model = r.model || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
      }
      byModel[model].cost += r.cost || 0;
      byModel[model].requests += 1;
      byModel[model].inputTokens += r.inputTokens || 0;
      byModel[model].outputTokens += r.outputTokens || 0;
    }
    return byModel;
  }

  /**
   * Get cost breakdown by provider
   */
  getCostByProvider(since = null) {
    let filtered = this.costHistory;
    if (since) {
      filtered = this.costHistory.filter(r => r.timestamp >= since);
    }
    
    const byProvider = {};
    for (const r of filtered) {
      const provider = r.provider || 'unknown';
      if (!byProvider[provider]) {
        byProvider[provider] = { cost: 0, requests: 0, inputTokens: 0, outputTokens: 0 };
      }
      byProvider[provider].cost += r.cost || 0;
      byProvider[provider].requests += 1;
      byProvider[provider].inputTokens += r.inputTokens || 0;
      byProvider[provider].outputTokens += r.outputTokens || 0;
    }
    return byProvider;
  }

  /**
   * Get status summary
   */
  getStatus(budgetId = null) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    return {
      config: this.config,
      runCost: budgetId ? this.getRunCost(budgetId) : null,
      runTokens: budgetId ? this.getRunTokens(budgetId) : null,
      todayCost: this.getCostSince(todayStart),
      monthCost: this.getCostSince(monthStart),
      totalCost: this.getTotalCost(),
      recentAlerts: this.alerts.slice(-10),
      budgetStatus: budgetId ? this.checkBudget(budgetId) : null,
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.costHistory = [];
    this.runCosts.clear();
    this.runTokens.clear();
    this.alerts = [];
  }
}

/**
 * Global cost tracker instance
 */
export const globalCostTracker = new CostTracker();
