/**
 * Environment Interface for Reinforcement Learning
 * 
 * All RL environments must implement this interface.
 * The agent interacts with the environment through this contract.
 */

/**
 * Result of a single environment step
 * @typedef {Object} StepResult
 * @property {string} state - The new state after taking the action
 * @property {number} reward - The reward received for the action
 * @property {boolean} done - Whether the episode has ended
 * @property {Object} [info] - Additional diagnostic information
 */

/**
 * Base Environment Class
 * 
 * @abstract
 */
export class Env {
  /**
   * Get the current state representation
   * @returns {string} Current state identifier
   */
  getState() {
    throw new Error('getState() must be implemented by subclass');
  }

  /**
   * Execute an action in the environment
   * @param {number} action - Action to execute
   * @returns {Promise<StepResult>} Result of the step
   */
  async step(action) {
    throw new Error('step() must be implemented by subclass');
  }

  /**
   * Get the number of possible actions
   * @returns {number} Action space size
   */
  actionSize() {
    throw new Error('actionSize() must be implemented by subclass');
  }

  /**
   * Reset the environment to initial state
   * @returns {Promise<string>} Initial state
   */
  async reset() {
    throw new Error('reset() must be implemented by subclass');
  }

  /**
   * Render the environment (optional, for debugging/visualization)
   * @returns {string} Human-readable representation
   */
  render() {
    return '';
  }
}

/**
 * State encoder/decoder utilities for tabular Q-learning
 */
export const StateEncoder = {
  /**
   * Encode a state object to string key
   * @param {Object} state - State object
   * @returns {string} Encoded state key
   */
  encode(state) {
    return JSON.stringify(state);
  },

  /**
   * Decode a state key to object
   * @param {string} key - Encoded state key
   * @returns {Object} Decoded state
   */
  decode(key) {
    return JSON.parse(key);
  }
};
