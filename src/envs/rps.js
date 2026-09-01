/**
 * Rock-Paper-Scissors Environment
 * 
 * Implements the Env interface for the classic RPS game.
 * Migrated from the original Cloudflare Workers implementation.
 * 
 * State: The opponent's last action (0=Rock, 1=Scissors, 2=Paper)
 * Actions: 0=Rock, 1=Scissors, 2=Paper
 * Rewards: Win=1, Lose=-1, Draw=0
 */

import { Env } from '../core/env.js';

const HAND_NAMES = ['Rock', 'Scissors', 'Paper'];

/**
 * Opponent strategy type
 * @typedef {'random'|'always_rock'|'counter'|'sequential'} OpponentStrategy
 */

/**
 * RockPaperScissorsEnv - Classic RPS environment
 */
export class RockPaperScissorsEnv extends Env {
  /**
   * @param {Object} options
   * @param {OpponentStrategy} [options.opponent='random'] - Opponent strategy
   */
  constructor({ opponent = 'random' } = {}) {
    super();
    this.opponent = opponent;
    this.lastOpponentAction = 0;
    this.episodeCount = 0;
  }

  /**
   * Get current state (opponent's last action)
   * @returns {string} State key
   */
  getState() {
    return String(this.lastOpponentAction);
  }

  /**
   * Execute action against opponent
   * @param {number} action - Agent's action (0, 1, 2)
   * @returns {Promise<StepResult>} Step result
   */
  async step(action) {
    // Determine opponent action based on strategy
    let opponentAction;
    switch (this.opponent) {
      case 'always_rock':
        opponentAction = 0;
        break;
      case 'counter':
        // Counter agent's previous action
        opponentAction = this.episodeCount === 0 ? 0 : (action + 2) % 3;
        break;
      case 'sequential':
        opponentAction = this.episodeCount % 3;
        break;
      case 'random':
      default:
        opponentAction = Math.floor(Math.random() * 3);
    }

    // Calculate reward from agent's perspective
    // judge = (agent - opponent + 3) % 3
    // 2 = agent wins, 1 = agent loses, 0 = draw
    const judge = (action - opponentAction + 3) % 3;
    const reward = judge === 2 ? 1 : judge === 1 ? -1 : 0;

    // Update state for next step
    this.lastOpponentAction = opponentAction;
    this.episodeCount++;

    return {
      state: String(opponentAction),
      reward,
      done: false,
      info: { opponentAction, judge }
    };
  }

  /**
   * Number of possible actions (Rock, Paper, Scissors)
   * @returns {number} 3
   */
  actionSize() {
    return 3;
  }

  /**
   * Reset environment to initial state
   * @returns {Promise<string>} Initial state
   */
  async reset() {
    this.lastOpponentAction = 0;
    this.episodeCount = 0;
    return '0';
  }

  /**
   * Render current state
   * @returns {string} Human-readable representation
   */
  render() {
    return `RPS Env | Last opponent: ${HAND_NAMES[this.lastOpponentAction]} | Episodes: ${this.episodeCount}`;
  }

  /**
   * Get human-readable hand name
   * @param {number} hand - Hand index (0, 1, 2)
   * @returns {string} Hand name
   */
  static getHandName(hand) {
    return HAND_NAMES[hand] || 'Unknown';
  }

  /**
   * Calculate outcome between two hands
   * @param {number} agentHand - Agent's hand
   * @param {number} opponentHand - Opponent's hand
   * @returns {{judge: number, reward: number, outcome: string}} Result
   */
  static calculateOutcome(agentHand, opponentHand) {
    const judge = (agentHand - opponentHand + 3) % 3;
    const reward = judge === 2 ? 1 : judge === 1 ? -1 : 0;
    const outcome = judge === 2 ? 'WIN' : judge === 1 ? 'LOSE' : 'DRAW';
    return { judge, reward, outcome };
  }
}

/**
 * Training pattern definitions (matching original worker.js)
 * @readonly
 * @enum {number}
 */
export const TrainingPattern = {
  RANDOM: 0,        // Random actions
  ALWAYS_ROCK: 1,   // Always play Rock
  COUNTER: 2,       // Counter previous action
  SEQUENTIAL: 3     // Sequential 0,1,2,0,1,2...
};

/**
 * Get action for training pattern
 * @param {number} pattern - Training pattern (0-3)
 * @param {number} episode - Current episode number
 * @param {number} lastAction - Last action taken
 * @returns {number} Action to take
 */
export function getTrainingAction(pattern, episode, lastAction = 0) {
  switch (pattern) {
    case TrainingPattern.ALWAYS_ROCK:
      return 0;
    case TrainingPattern.COUNTER:
      return episode === 0 ? 0 : (lastAction + 2) % 3;
    case TrainingPattern.SEQUENTIAL:
      return episode % 3;
    case TrainingPattern.RANDOM:
    default:
      return Math.floor(Math.random() * 3);
  }
}

export default RockPaperScissorsEnv;
