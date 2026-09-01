/**
 * High-Level Agent Orchestration
 * 
 * Combines Q-Learning engine with environment and storage.
 * Provides train/play/status/start/stop operations.
 * Migrated from the original Cloudflare Workers routes.
 */

import { QLearning } from './qlearning.js';

/**
 * Agent configuration
 * @typedef {Object} AgentConfig
 * @property {QLearning} qlearning - Q-Learning engine
 * @property {Storage} storage - Storage backend
 * @property {Env} [env] - Environment (optional, for play/train modes)
 */

/**
 * Training result
 * @typedef {Object} TrainResult
 * @property {number} episodes - Number of episodes completed
 * @property {number} wins - Number of wins (reward > 0)
 * @property {number} losses - Number of losses (reward < 0)
 * @property {number} draws - Number of draws (reward = 0)
 */

/**
 * Play result
 * @typedef {Object} PlayResult
 * @property {number} action - Agent's chosen action
 * @property {number} reward - Reward received
 * @property {boolean} done - Whether episode ended
 * @property {Object} info - Additional info from environment
 */

/**
 * Status information
 * @typedef {Object} StatusInfo
 * @property {'running'|'stopped'} status - System status
 * @property {number} todayTotal - Battles today
 * @property {number} limit - Daily limit
 * @property {Array} performance - Performance by mode
 * @property {Array} aiBrain - Full Q-table
 */

/**
 * Agent - Main orchestration class for RL agent
 */
export class Agent {
  /**
   * @param {AgentConfig} config
   */
  constructor({ qlearning, storage, env = null } = {}) {
    if (!qlearning || !storage) {
      throw new Error('QLearning and Storage are required');
    }
    this.qlearning = qlearning;
    this.storage = storage;
    this.env = env;
    this.isActive = true;
  }

  /**
   * Check if system is active
   * @returns {Promise<boolean>}
   */
  async checkActive() {
    const config = await this.storage.getSetting('is_active');
    this.isActive = config ? config.value === '1' : true;
    return this.isActive;
  }

  /**
   * Start the system (enable training/play)
   * @returns {Promise<{status: string, message: string}>}
   */
  async start() {
    await this.storage.setSetting('is_active', 1);
    this.isActive = true;
    return { status: 'success', message: 'System STARTED' };
  }

  /**
   * Stop the system (disable training/play)
   * @returns {Promise<{status: string, message: string}>}
   */
  async stop() {
    await this.storage.setSetting('is_active', 0);
    this.isActive = false;
    return { status: 'success', message: 'System STOPPED' };
  }

  /**
   * Get current status and statistics
   * @returns {Promise<StatusInfo>}
   */
  async status() {
    await this.checkActive();
    
    const todayCount = await this.storage.getTodayBattleCount();
    const stats = await this.storage.getPerformanceStats();
    const brain = await this.qlearning.getFullQTable();
    
    return {
      status: this.isActive ? 'running' : 'stopped',
      todayTotal: todayCount,
      limit: 90000,
      performance: stats,
      aiBrain: brain
    };
  }

  /**
   * Train the agent with specified episodes
   * 
   * @param {Object} options
   * @param {number} [options.episodes=200] - Number of training episodes
   * @param {Function} [options.actionSelector] - Function(episode, lastAction) -> action
   * @param {number} [options.batchSize=200] - Batch size for DB operations
   * @returns {Promise<TrainResult>}
   */
  async train({ episodes = 200, actionSelector = null, batchSize = 200 } = {}) {
    await this.checkActive();
    if (!this.isActive) {
      throw new Error('System is paused. Use start() first.');
    }
    if (!this.env) {
      throw new Error('Environment is required for training');
    }

    let wins = 0, losses = 0, draws = 0;
    const batchOperations = [];
    let lastAction = 0;

    for (let i = 0; i < episodes; i++) {
      // Determine action - use custom selector or default to random
      let action;
      if (actionSelector) {
        action = actionSelector(i, lastAction);
      } else {
        action = Math.floor(Math.random() * this.env.actionSize());
      }
      lastAction = action;

      // Get current state
      const state = await this.env.getState() || '0';
      
      // Execute action in environment
      const result = await this.env.step(action);
      
      // Track reward
      const reward = result.reward;
      if (reward > 0) wins++;
      else if (reward < 0) losses++;
      else draws++;

      // Q-learning update
      await this.qlearning.learnSimple(state, action, reward);

      // Batch database operations
      batchOperations.push(this.storage.addBattle({
        mode: 'train',
        handA: action,
        handB: result.info?.opponentAction ?? 0,
        reward,
        createdAt: new Date().toISOString()
      }));

      // Flush batch
      if (batchOperations.length >= batchSize) {
        await Promise.all(batchOperations);
        batchOperations.length = 0;
      }
    }

    // Flush remaining
    if (batchOperations.length > 0) {
      await Promise.all(batchOperations);
    }

    return { episodes, wins, losses, draws };
  }

  /**
   * Play a single step against the agent
   * Uses epsilon-greedy policy for action selection.
   * 
   * @param {Object} [options] - Play options
   * @param {number} [options.userAction] - Optional user action (for envs that need it)
   * @returns {Promise<PlayResult>}
   */
  async play(options = {}) {
    await this.checkActive();
    if (!this.isActive) {
      throw new Error('System is paused. Use start() first.');
    }
    if (!this.env) {
      throw new Error('Environment is required for play mode');
    }

    // Get current state
    const state = await this.env.getState() || '0';
    const actionSize = this.env.actionSize();

    // Epsilon-greedy action selection
    const action = await this.qlearning.act(state, actionSize);

    // Execute in environment
    const result = await this.env.step(action);

    // Update Q-table
    await this.qlearning.learnSimple(state, action, result.reward);

    // Record battle
    await this.storage.addBattle({
      mode: 'test',
      handA: action,
      handB: result.info?.opponentAction ?? options.userAction ?? 0,
      reward: result.reward,
      createdAt: new Date().toISOString()
    });

    return {
      action,
      reward: result.reward,
      done: result.done,
      info: result.info
    };
  }

  /**
   * Set the environment (for dependency injection)
   * @param {Env} env
   */
  setEnvironment(env) {
    this.env = env;
  }
}
