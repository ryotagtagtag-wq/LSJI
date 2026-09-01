/**
 * LSJI - Main Entry Point
 * 
 * Public API exports for the reinforcement learning framework.
 */

// Core
export { Env, StateEncoder } from './core/env.js';
export { QLearning } from './core/qlearning.js';
export { Agent } from './core/agent.js';

// Storage
export { Storage, createStorage } from './storage/index.js';
export { SqliteStorage } from './storage/sqlite.js';
export { BetterSqliteStorage } from './storage/better-sqlite.js';
export { MemoryStorage } from './storage/memory.js';

// Environments
export { RockPaperScissorsEnv, TrainingPattern, getTrainingAction } from './envs/rps.js';

// Version
export const VERSION = '0.1.0';
