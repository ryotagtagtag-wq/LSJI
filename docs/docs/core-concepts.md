---
title: Core Concepts
description: Understand the core architecture of LSJI
---

# Core Concepts

LSJI is built around four core abstractions that work together to create a flexible reinforcement learning framework.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ QLearning   │  │  Storage    │  │      Env            │  │
│  │ (Engine)    │◄─┤ (Backend)   │  │ (Environment)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1. Environment (`Env`)

The `Env` interface defines the problem domain. Any RL environment must implement:

```typescript
abstract class Env {
  getState(): string;                    // Current state representation
  step(action: number): Promise<StepResult>;  // Execute action
  actionSize(): number;                  // Number of possible actions
  reset(): Promise<string>;              // Reset to initial state
}
```

**StepResult** contains:
- `state` — New state after action
- `reward` — Reward received (-1, 0, 1)
- `done` — Whether episode ended
- `info` — Additional diagnostic info

### 2. Q-Learning Engine (`QLearning`)

Tabular Q-Learning with Temporal Difference (TD) updates:

```typescript
class QLearning {
  constructor({ alpha, gamma, epsilon, storage });
  
  // Epsilon-greedy action selection
  async act(state: string, actionSize: number): Promise<number>;
  
  // Full TD update: Q(s,a) ← Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]
  async learn(state, action, reward, nextState, nextActionSize);
  
  // Simplified update (terminal states): Q(s,a) ← Q(s,a) + α[r - Q(s,a)]
  async learnSimple(state, action, reward);
  
  // Get all Q-values for inspection
  async getFullQTable(): Promise<QTableRecord[]>;
}
```

**Hyperparameters:**
- `alpha` (0.1) — Learning rate
- `gamma` (0.9) — Discount factor  
- `epsilon` (0.1) — Exploration rate

### 3. Storage Backend (`Storage`)

Pluggable persistence layer with three implementations:

| Backend | Package | Use Case |
|---------|---------|----------|
| `SqliteStorage` | `node:sqlite` (built-in) | **Recommended** — Zero dependencies |
| `BetterSqliteStorage` | `better-sqlite3` | High-performance synchronous access |
| `MemoryStorage` | Built-in | Testing, CI, ephemeral workloads |

All implement the same interface:
```typescript
interface Storage {
  initialize(): Promise<void>;
  close(): Promise<void>;
  getSetting(key): Promise<Setting>;
  setSetting(key, value): Promise<void>;
  getQTable(): Promise<QTableRecord[]>;
  updateQ(state, action, qValue): Promise<void>;
  addBattle(record): Promise<void>;
  getTodayBattleCount(): Promise<number>;
  getPerformanceStats(): Promise<PerformanceStat[]>;
}
```

### 4. Agent (`Agent`)

High-level orchestration combining all components:

```typescript
class Agent {
  constructor({ qlearning, storage, env });
  
  async train({ episodes, actionSelector, batchSize });
  async play(options?): Promise<PlayResult>;
  async status(): Promise<StatusInfo>;
  async start(): Promise<{status, message}>;
  async stop(): Promise<{status, message}>;
  setEnvironment(env): void;
}
```

## Data Flow

### Training Loop
```
for each episode:
  1. Get current state from Env
  2. Select action via QLearning.act() (ε-greedy)
  3. Execute action in Env → StepResult
  4. Update Q-table via QLearning.learnSimple()
  5. Persist battle record to Storage
  6. Batch DB writes for performance
```

### Play Loop
```
1. Get current state from Env
2. Select best action via QLearning.act() (ε=0 for exploitation)
3. Execute action in Env
4. Update Q-table with result
5. Record battle to Storage
6. Return result
```

## Reward System (RPS Example)

| Outcome | Judge Formula | Reward |
|---------|---------------|--------|
| Win     | (ai - user + 3) % 3 = 2 | +1 |
| Lose    | (ai - user + 3) % 3 = 1 | -1 |
| Draw    | (ai - user + 3) % 3 = 0 | 0 |

## Training Patterns

Built-in patterns for the RPS environment:

| Pattern | ID | Description |
|---------|-----|-------------|
| Random | 0 | Uniform random actions |
| Always Rock | 1 | Always play action 0 |
| Counter | 2 | Play counter to previous action |
| Sequential | 3 | Cycle through 0,1,2,0,1,2... |

Custom patterns can be implemented via `actionSelector` function.
