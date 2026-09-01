---
title: Architecture
description: Design decisions and internals
---

# Architecture

## Design Principles

1. **Single Package** — All core functionality in one npm package
2. **Zero Dependencies** — Core runs on Node.js 22+ built-ins only
3. **Storage Abstraction** — Easy to swap backends
4. **ESM Only** — Modern JavaScript modules
5. **Apache 2.0** — License compatible with Apache Incubator

## Project Structure

```
src/
├── core/
│   ├── env.ts          # Environment interface
│   ├── qlearning.ts    # Q-Learning engine
│   └── agent.ts        # Agent orchestration
├── storage/
│   ├── index.ts        # Storage interface + factory
│   ├── sqlite.ts       # node:sqlite implementation
│   ├── better-sqlite.ts # better-sqlite3 implementation
│   └── memory.ts       # In-memory implementation
├── envs/
│   └── rps.ts          # Rock-Paper-Scissors environment
├── cli.ts              # Command-line interface
└── index.ts            # Public API exports
```

## Core Components

### Q-Learning Engine

**Algorithm:** Tabular Q-Learning with Temporal Difference updates

**Update Rules:**
- Full TD: `Q(s,a) ← Q(s,a) + α[r + γ·maxₐ' Q(s',a') - Q(s,a)]`
- Simple: `Q(s,a) ← Q(s,a) + α[r - Q(s,a)]` (terminal states)

**Exploration:** Epsilon-greedy with configurable ε

**State Representation:** String keys for Q-table indexing

### Storage Layer

**Interface:** Abstract `Storage` class with 9 required methods

**Implementations:**
1. `SqliteStorage` — Node.js built-in `node:sqlite` (sync API)
2. `BetterSqliteStorage` — `better-sqlite3` (faster, more features)
3. `MemoryStorage` — Pure JS Maps/Arrays (testing)

**Schema:**
- `settings` — Key-value configuration
- `battle_history` — Training/play records with timestamps
- `q_table` — State-action values with composite primary key

**Indexes:** Date and mode indexes on battle_history for fast queries

### Agent Orchestration

**Responsibilities:**
- System lifecycle (start/stop)
- Training loop with batching
- Play/evaluation loop
- Statistics aggregation

**Training Loop:**
```
for episode in episodes:
  state = env.getState()
  action = qlearning.act(state, actionSize)  // ε-greedy
  result = env.step(action)
  qlearning.learnSimple(state, action, result.reward)
  storage.addBattle(record)
  batch.flush()
```

### Environment Interface

**Contract:**
```typescript
abstract class Env {
  abstract getState(): string;
  abstract step(action: number): Promise<StepResult>;
  abstract actionSize(): number;
  abstract reset(): Promise<string>;
  render(): string;  // Optional
}
```

**Built-in:** `RockPaperScissorsEnv` with 4 opponent strategies

## Data Flow

```
┌─────────┐     ┌──────────────┐     ┌─────────┐
│  Env    │────▶│   Agent      │────▶│ Storage │
│ (State) │     │  Orchestrates│     │(Persist)│
└─────────┘     └──────┬───────┘     └─────────┘
                       │
                       ▼
                ┌──────────────┐
                │  QLearning   │
                │  (Updates)   │
                └──────────────┘
```

## Concurrency Model

- **Single-threaded** Node.js event loop
- **Synchronous SQLite** — No async/await for DB operations
- **Batch writes** — Reduce I/O overhead
- **In-memory Q-table cache** — Fast reads, periodic persistence

## Migration from Cloudflare Workers

**Original:** Worker.js with D1 database, cron triggers, HTTP endpoints

**Changes:**
| Before | After |
|--------|-------|
| `env.DB` (D1) | `Storage` abstraction |
| Cron triggers | Manual/CLI training |
| HTTP endpoints | Library API + CLI |
| Global state | Instance-based |
| `Request/Response` | Function parameters |

**Preserved:**
- Q-Learning algorithm (α=0.1, γ=0.9, ε=0.1)
- Reward calculation: `(ai - user + 3) % 3`
- Training patterns (0-3)
- Battle history schema

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `act()` | O(actions) | Scans all actions for max Q |
| `learnSimple()` | O(1) | Single Q-value update |
| `learn()` | O(actions) | Finds max next Q |
| `getFullQTable()` | O(states×actions) | Full table scan |
| Batch insert | O(batch) | Single transaction |

## Future Extensibility

- **New algorithms:** Extend `QLearning` or add `SARSA`, `DQN` classes
- **New environments:** Implement `Env` interface
- **New storage:** Implement `Storage` interface
- **Function approximation:** Replace tabular Q-table with neural networks
