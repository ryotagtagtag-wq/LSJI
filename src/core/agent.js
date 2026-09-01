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
 * @property {Env} [env] - Environment (optional, for play mode)
 */

/**
 * Training result
 * @typedef {Object} TrainResult
 * @property {number} episodes - Number of episodes completed
 * @property {number} wins - Number of wins
 * @property {number} losses - Number of losses
 * @property {number} draws - Number of draws
 */

/**
 * Play result
 * @typedef {Object} PlayResult
 * @property {number} aiHand - AI's chosen action
 * @property {number} userHand - User's action
 * @property {'AI_WIN'|'USER_WIN'|'DRAW'} outcome - Game outcome
 * @property {string} aiHandName - Human-readable AI hand
 * @property {string} userHandName - Human-readable user hand
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
   * Migrated from worker.js /train endpoint.
   * Supports different training patterns:
   * - pattern 0: Random actions
   * - pattern 1: Always action 0 (Rock)
   * - pattern 2: Counter previous action
   * - pattern 3: Sequential actions
   * 
   * @param {Object} options
   * @param {number} [options.episodes=200] - Number of training episodes
   * @param {number} [options.pattern=0] - Training pattern (0-3)
   * @param {number} [options.batchSize=200] - Batch size for DB operations
   * @returns {Promise<TrainResult>}
   */
  async train({ episodes = 200, pattern = 0, batchSize = 200 } = {}) {
    await this.checkActive();
    if (!this.isActive) {
      throw new Error('System is paused. Use start() first.');
    }
    if (!this.env) {
      throw new Error('Environment is required for training');
    }

    let wins = 0, losses = 0, draws = 0;
    const batchOperations = [];

    for (let i = 0; i < episodes; i++) {
      // Determine action based on pattern (from original worker.js)
      let action;
      switch (pattern) {
        case 1: action = 0; break; // Always Rock
        case 2: // Counter previous
          action = i === 0 ? 0 : (this.lastAction + 2) % 3;
          break;
        case 3: // Sequential
          action = i % 3;
          break;
        case 0: // Random
        default:
          action = Math.floor(Math.random() * 3);
      }
      this.lastAction = action;

      // Get current state (opponent's last action in test mode)
      const state = await this.env.getState() || '0';
      
      // Execute action in environment
      const result = await this.env.step(action);
      
      // Calculate reward (win=1, lose=-1, draw=0)
      // Original worker.js: judge = (aiHand - userHand + 3) % 3
      // judge 2 = win (1), judge 1 = lose (-1), judge 0 = draw (0)
      const reward = result.reward;
      
      if (reward > 0) wins++;
      else if (reward < 0) losses++;
      else draws++;

      // Q-learning update (original uses simple update for terminal states)
      await this.qlearning.learnSimple(state, action, reward);

      // Batch database operations
      batchOperations.push(this.storage.addBattle({
        mode: 'train',
        handA: action,
        handB: result.userAction ?? 0,
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
   * Play a single game against the agent
   * 
   * Migrated from worker.js /play endpoint.
   * Uses epsilon-greedy policy (10% exploration).
   * 
   * @param {number} userHand - User's action (0=Rock, 1=Scissors, 2=Paper)
   * @returns {Promise<PlayResult>}
   */
  async play(userHand) {
    await this.checkActive();
    if (!this.isActive) {
      throw new Error('System is paused. Use start() first.');
    }
    if (!this.env) {
      throw new Error('Environment is required for play mode');
    }

    // Get current state (opponent's last test action)
    const state = await this.env.getState() || '0';
    const actionSize = this.env.actionSize();

    // Epsilon-greedy action selection (10% random)
    const aiHand = await this.qlearning.act(state, actionSize);

    // Execute in environment
    const result = await this.env.step(aiHand);
    
    // Calculate reward
    // judge = (aiHand - userHand + 3) % 3
    // 2 = win, 1 = lose, 0 = draw
    const judge = (aiHand - userHand + 3) % 3;
    const reward = judge === 2 ? 1 : judge === 1 ? -1 : 0;

    // Update Q-table (original worker.js style)
    await this.qlearning.learnSimple(state, aiHand, reward);

    // Record battle
    await this.storage.addBattle({
      mode: 'test',
      handA: aiHand,
      handB: userHand,
      reward,
      createdAt: new Date().toISOString()
    });

    // Human-readable names
    const handNames = ['Rock', 'Scissors', 'Paper'];
    const outcome = judge === 2 ? 'AI_WIN' : judge === 1 ? 'USER_WIN' : 'DRAW';

    return {
      aiHand,
      userHand,
      outcome,
      aiHandName: handNames[aiHand],
      userHandName: handNames[userHand]
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
