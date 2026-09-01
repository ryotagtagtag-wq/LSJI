/**
 * QLearning Tests
 * 
 * Verifies the TD learning logic matches original worker.js behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QLearning } from '../../src/core/qlearning.js';
import { MemoryStorage } from '../../src/storage/memory.js';

describe('QLearning', () => {
  let storage;
  let qlearning;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.initialize();
    qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });
  });

  it('should initialize with default config', () => {
    expect(qlearning.alpha).toBe(0.1);
    expect(qlearning.gamma).toBe(0.9);
    expect(qlearning.epsilon).toBe(0.1);
  });

  it('should clamp alpha, gamma, epsilon to [0, 1]', () => {
    const ql = new QLearning({ alpha: 1.5, gamma: -0.5, epsilon: 2, storage });
    expect(ql.alpha).toBe(1);
    expect(ql.gamma).toBe(0);
    expect(ql.epsilon).toBe(1);
  });

  it('should return 0 for unseen state-action pairs', async () => {
    await qlearning.initialize();
    const value = qlearning.getQValue('state1', 0);
    expect(value).toBe(0);
  });

  it('should store and retrieve Q-values', async () => {
    await qlearning.initialize();
    await qlearning.setQValue('state1', 0, 0.5);
    expect(qlearning.getQValue('state1', 0)).toBe(0.5);
  });

  it('should perform simple TD update (worker.js style)', async () => {
    await qlearning.initialize();
    
    // Original worker.js: oldQ + 0.1 * (reward - oldQ)
    // Initial Q = 0, reward = 1 (win)
    // New Q = 0 + 0.1 * (1 - 0) = 0.1
    await qlearning.learnSimple('state1', 0, 1);
    expect(qlearning.getQValue('state1', 0)).toBeCloseTo(0.1);
    
    // Second update: oldQ = 0.1, reward = 1
    // New Q = 0.1 + 0.1 * (1 - 0.1) = 0.19
    await qlearning.learnSimple('state1', 0, 1);
    expect(qlearning.getQValue('state1', 0)).toBeCloseTo(0.19);
  });

  it('should handle negative rewards (loss)', async () => {
    await qlearning.initialize();
    
    // reward = -1 (loss)
    // New Q = 0 + 0.1 * (-1 - 0) = -0.1
    await qlearning.learnSimple('state1', 0, -1);
    expect(qlearning.getQValue('state1', 0)).toBeCloseTo(-0.1);
  });

  it('should handle zero rewards (draw)', async () => {
    await qlearning.initialize();
    
    // reward = 0 (draw)
    // New Q = 0 + 0.1 * (0 - 0) = 0
    await qlearning.learnSimple('state1', 0, 0);
    expect(qlearning.getQValue('state1', 0)).toBe(0);
  });

  it('should select random action during exploration', async () => {
    await qlearning.initialize();
    
    // With epsilon=1, should always explore
    const ql = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 1, storage });
    await ql.initialize();
    
    const actions = new Set();
    for (let i = 0; i < 100; i++) {
      actions.add(await ql.act('state1', 3));
    }
    
    // Should have tried multiple actions
    expect(actions.size).toBeGreaterThan(1);
  });

  it('should select best action during exploitation', async () => {
    await qlearning.initialize();
    
    // Set up Q-values: action 1 is best
    await qlearning.setQValue('state1', 0, 0.1);
    await qlearning.setQValue('state1', 1, 0.9);
    await qlearning.setQValue('state1', 2, 0.3);
    
    // With epsilon=0, should always exploit
    const ql = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0, storage });
    await ql.initialize();
    
    const action = await ql.act('state1', 3);
    expect(action).toBe(1);
  });

  it('should perform full TD update with next state', async () => {
    await qlearning.initialize();
    
    // Set up next state with known values
    await qlearning.setQValue('nextState', 0, 0.5);
    await qlearning.setQValue('nextState', 1, 0.8);
    
    // Current: state1, action 0, Q=0
    // Reward = 1, gamma = 0.9, max next Q = 0.8
    // Target = 1 + 0.9 * 0.8 = 1.72
    // New Q = 0 + 0.1 * (1.72 - 0) = 0.172
    await qlearning.learn('state1', 0, 1, 'nextState', 2);
    
    expect(qlearning.getQValue('state1', 0)).toBeCloseTo(0.172, 2);
  });

  it('should persist Q-values to storage', async () => {
    await qlearning.initialize();
    await qlearning.setQValue('state1', 0, 0.5);
    
    // Create new QLearning instance with same storage
    const ql2 = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });
    await ql2.initialize();
    
    expect(ql2.getQValue('state1', 0)).toBe(0.5);
  });

  it('should return full Q-table', async () => {
    await qlearning.initialize();
    await qlearning.setQValue('stateA', 0, 0.1);
    await qlearning.setQValue('stateA', 1, 0.2);
    await qlearning.setQValue('stateB', 0, 0.3);
    
    const table = await qlearning.getFullQTable();
    expect(table.length).toBe(3);
    expect(table[0]).toEqual({ state: 'stateA', action: 0, q_value: 0.1 });
    expect(table[1]).toEqual({ state: 'stateA', action: 1, q_value: 0.2 });
    expect(table[2]).toEqual({ state: 'stateB', action: 0, q_value: 0.3 });
  });
});
