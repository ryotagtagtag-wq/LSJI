/**
 * Q-Learning Engine (Temporal Difference Learning)
 * 
 * Migrated from the original Cloudflare Workers implementation.
 * Implements tabular Q-learning with epsilon-greedy exploration.
 */

import { StateEncoder } from './env.js';

/**
 * Q-Learning configuration
 * @typedef {Object} QLearningConfig
 * @property {number} [alpha=0.1] - Learning rate (0.0 to 1.0)
 * @property {number} [gamma=0.9] - Discount factor (0.0 to 1.0)
 * @property {number} [epsilon=0.1] - Exploration rate (0.0 to 1.0)
 * @property {Storage} storage - Storage backend for Q-table persistence
 */

/**
 * Q-Learning Engine for Tabular Reinforcement Learning
 */
export class QLearning {
  /**
   * @param {QLearningConfig} config
   */
  constructor({ alpha = 0.1, gamma = 0.9, epsilon = 0.1, storage } = {}) {
    if (!storage) {
      throw new Error('Storage is required for QLearning');
    }
    
    this.alpha = Math.max(0, Math.min(1, alpha));
    this.gamma = Math.max(0, Math.min(1, gamma));
    this.epsilon = Math.max(0, Math.min(1, epsilon));
    this.storage = storage;
    
    // In-memory Q-table cache for performance
    this.qTable = new Map();
    this.initialized = false;
  }

  /**
   * Initialize Q-table from storage
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;
    
    const records = await this.storage.getQTable();
    for (const record of records) {
      const key = `${record.state}:${record.action}`;
      this.qTable.set(key, record.q_value);
    }
    this.initialized = true;
  }

  /**
   * Get Q-value for state-action pair
   * @param {string} state - State key
   * @param {number} action - Action
   * @returns {number} Q-value (0 if unseen)
   */
  getQValue(state, action) {
    return this.qTable.get(`${state}:${action}`) ?? 0;
  }

  /**
   * Set Q-value for state-action pair
   * @param {string} state - State key
   * @param {number} action - Action
   * @param {number} value - Q-value
   * @returns {Promise<void>}
   */
  async setQValue(state, action, value) {
    const key = `${state}:${action}`;
    this.qTable.set(key, value);
    await this.storage.updateQ(state, action, value);
  }

  /**
   * Select action using epsilon-greedy policy
   * @param {string} state - Current state
   * @param {number} actionSize - Number of possible actions
   * @returns {Promise<number>} Selected action
   */
  async act(state, actionSize) {
    await this.initialize();
    
    // Exploration: random action
    if (Math.random() < this.epsilon) {
      return Math.floor(Math.random() * actionSize);
    }
    
    // Exploitation: best known action
    let bestAction = 0;
    let bestValue = -Infinity;
    
    for (let action = 0; action < actionSize; action++) {
      const value = this.getQValue(state, action);
      if (value > bestValue || (value === bestValue && Math.random() < 0.5)) {
        bestValue = value;
        bestAction = action;
      }
    }
    
    return bestAction;
  }

  /**
   * Update Q-value using TD learning rule
   * Q(s,a) <- Q(s,a) + alpha * (reward + gamma * max_a' Q(s',a') - Q(s,a))
   * 
   * @param {string} state - Current state
   * @param {number} action - Action taken
   * @param {number} reward - Reward received
   * @param {string} nextState - Next state
   * @param {number} nextActionSize - Number of actions in next state
   * @returns {Promise<number>} Updated Q-value
   */
  async learn(state, action, reward, nextState, nextActionSize) {
    await this.initialize();
    
    const currentQ = this.getQValue(state, action);
    
    // Find max Q-value for next state
    let maxNextQ = 0;
    for (let a = 0; a < nextActionSize; a++) {
      const q = this.getQValue(nextState, a);
      if (q > maxNextQ) maxNextQ = q;
    }
    
    // TD update: Q(s,a) = Q(s,a) + alpha * (reward + gamma * max Q(s',a') - Q(s,a))
    const target = reward + this.gamma * maxNextQ;
    const newQ = currentQ + this.alpha * (target - currentQ);
    
    await this.setQValue(state, action, newQ);
    return newQ;
  }

  /**
   * Simple Q-value update (original worker.js style)
   * Q(s,a) <- Q(s,a) + alpha * (reward - Q(s,a))
   * Used for terminal states or simplified updates
   * 
   * @param {string} state - State
   * @param {number} action - Action
   * @param {number} reward - Reward
   * @returns {Promise<number>} Updated Q-value
   */
  async learnSimple(state, action, reward) {
    await this.initialize();
    
    const currentQ = this.getQValue(state, action);
    // Original formula: oldQ + 0.1 * (reward - oldQ)
    const newQ = currentQ + this.alpha * (reward - currentQ);
    
    await this.setQValue(state, action, newQ);
    return newQ;
  }

  /**
   * Reset Q-table (clear all learned values)
   * @returns {Promise<void>}
   */
  async reset() {
    this.qTable.clear();
    // Note: storage reset would require a new method
    this.initialized = false;
  }

  /**
   * Get all Q-values for a state
   * @param {string} state - State key
   * @param {number} actionSize - Number of actions
   * @returns {Object<string, number>} Action -> Q-value mapping
   */
  getStateValues(state, actionSize) {
    const values = {};
    for (let action = 0; action < actionSize; action++) {
      values[action] = this.getQValue(state, action);
    }
    return values;
  }

  /**
   * Get entire Q-table (for inspection/debugging)
   * @returns {Promise<Array<{state: string, action: number, q_value: number}>>}
   */
  async getFullQTable() {
    await this.initialize();
    const results = [];
    for (const [key, value] of this.qTable) {
      const [state, action] = key.split(':');
      results.push({ state, action: parseInt(action, 10), q_value: value });
    }
    return results.sort((a, b) => a.state.localeCompare(b.state) || a.action - b.action);
  }
}
