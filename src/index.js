/**
 * LSJI - Main Entry Point
 * 
 * Public API exports for the reinforcement learning framework.
 * Now includes production-grade LLM agent framework with:
 * - HITL (Human-in-the-Loop) approval gates
 * - Durability with checkpointing and recovery
 * - Idempotency for duplicate prevention
 * - Budget controls with circuit breaker
 * - Runtime server with WebSocket control panel
 * - Tool plugin system
 */

// Core RL (existing)
export { Env, StateEncoder } from './core/env.js';
export { QLearning } from './core/qlearning.js';
export { Agent } from './core/agent.js';

// Storage (existing)
export { Storage, createStorage } from './storage/index.js';
export { SqliteStorage } from './storage/sqlite.js';
export { BetterSqliteStorage } from './storage/better-sqlite.js';
export { MemoryStorage } from './storage/memory.js';

// Environments (existing)
export { RockPaperScissorsEnv, TrainingPattern, getTrainingAction } from './envs/rps.js';

// Execution System (NEW)
export { 
  ExecutionEngine, 
  createExecutionEngine,
  IdempotencyStore,
  createIdempotencyStore 
} from './execution/index.js';

// Budget Control (NEW)
export {
  TokenCounter,
  globalTokenCounter,
  CostTracker,
  globalCostTracker,
  CircuitBreaker,
  CircuitState,
  globalCircuitBreaker,
  createBudgetController
} from './execution/budget/index.js';

// HITL (NEW)
export {
  ApprovalStore,
  createApprovalStore,
  Notifier,
  NotificationChannel,
  createNotifier,
  ApprovalGate,
  createApprovalGate
} from './execution/hitl/index.js';

// LLM Agent System (NEW)
export {
  LLMAgent,
  createLLMAgent,
  LLMProvider,
  createProvider,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  LocalProvider,
  ToolRegistry,
  createToolRegistry,
  ConversationMemory,
  createConversationMemory,
  SemanticMemory,
  createSemanticMemory,
  EpisodicMemory,
  createEpisodicMemory,
  PromptManager,
  createPromptManager,
  BUILTIN_PROMPTS
} from './llm/index.js';

// Runtime Server (NEW)
export {
  createApp,
  startServer,
  stopServer,
  activeRuns
} from './server/index.js';

// Tool Plugin System (NEW)
export {
  loadPlugins,
  createPluginTemplate,
  PluginRegistry,
  globalPluginRegistry
} from './llm/plugins/index.js';

// Version
export const VERSION = '1.2.4';
