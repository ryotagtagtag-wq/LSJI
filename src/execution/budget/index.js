/**
 * Budget Control System
 * 
 * Exports all budget-related components:
 * - TokenCounter: Tracks token usage
 * - CostTracker: Tracks costs with limits and alerts
 * - CircuitBreaker: Prevents runaway costs
 */

import { TokenCounter } from './token-counter.js';
import { CostTracker } from './cost-tracker.js';
import { CircuitBreaker } from './circuit-breaker.js';

export { TokenCounter, globalTokenCounter } from './token-counter.js';
export { CostTracker, globalCostTracker } from './cost-tracker.js';
export { CircuitBreaker, CircuitState, globalCircuitBreaker } from './circuit-breaker.js';

/**
 * Create a complete budget controller with all components
 */
export function createBudgetController(config = {}) {
  return {
    tokenCounter: new TokenCounter(),
    costTracker: new CostTracker(config),
    circuitBreaker: new CircuitBreaker(config),
    
    /**
     * Check budget before operation
     */
    async checkBudget(budgetId, estimatedCost = 0, estimatedTokens = 0) {
      return this.circuitBreaker.checkBudget(budgetId, estimatedCost, estimatedTokens);
    },
    
    /**
     * Record usage after operation
     */
    recordUsage(budgetId, usage) {
      // usage: { inputTokens, outputTokens, totalTokens, model, provider, cost }
      this.tokenCounter.recordUsage({ ...usage, budgetId });
      if (usage.cost !== undefined) {
        this.costTracker.recordCost({ ...usage, budgetId });
      }
    },
    
    /**
     * Get status
     */
    getStatus(budgetId = null) {
      return {
        tokens: this.tokenCounter.getSummary(),
        costs: this.costTracker.getStatus(budgetId),
        circuit: this.circuitBreaker.getState(),
      };
    },
    
    /**
     * Reset run budget
     */
    resetRunBudget(budgetId) {
      this.costTracker.resetRunBudget(budgetId);
    },
  };
}
