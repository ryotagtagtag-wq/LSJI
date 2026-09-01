# AGENTS.md

## Project Overview

**LSJI** (Learning System for JavaScript Intelligence) is a general-purpose Reinforcement Learning agent framework for Node.js. It provides a clean abstraction for building RL agents with pluggable storage backends, environments, and learning algorithms.

Originally migrated from a Cloudflare Workers implementation (Rock-Paper-Scissors AI), now redesigned as a standalone npm package with Apache 2.0 license, targeting Apache Incubator entry.

## Architecture

```
src/
├── core/
│   ├── env.js          # Environment interface (Env base class)
│   ├── qlearning.js    # Q-Learning engine (TD learning, epsilon-greedy)
│   └── agent.js        # High-level agent orchestration
├── storage/
│   ├── index.js        # Storage interface + factory
│   ├── sqlite.js       # node:sqlite implementation (Node 22+)
│   ├── better-sqlite.js # better-sqlite3 implementation
│   └── memory.js       # In-memory implementation
├── cli.js              # Command-line interface
└── index.js            # Public API exports
```

## Core Components

### Env (Environment Interface)
Base class that all environments must extend:
- `getState()` - Returns current state as string
- `step(action)` - Executes action, returns {state, reward, done, info}
- `actionSize()` - Number of possible actions
- `reset()` - Resets environment to initial state

### QLearning
Tabular Q-Learning with configurable:
- `alpha` (learning rate, default 0.1)
- `gamma` (discount factor, default 0.9)
- `epsilon` (exploration rate, default 0.1)

Methods:
- `act(state, actionSize)` - Epsilon-greedy action selection
- `learn(state, action, reward, nextState, nextActionSize)` - Full TD update
- `learnSimple(state, action, reward)` - Simplified update (worker.js style)
- `getFullQTable()` - Returns entire Q-table for inspection

### Agent
High-level orchestration combining QLearning + Storage + Env:
- `train({episodes, pattern, batchSize})` - Training with multiple patterns
- `play(userHand)` - Single play against agent
- `status()` - System status and statistics
- `start()` / `stop()` - Enable/disable system

### Storage Interface
Pluggable backends:
- **SqliteStorage** - Uses Node.js built-in `node:sqlite` (recommended, zero deps)
- **BetterSqliteStorage** - Uses `better-sqlite3` (faster, synchronous)
- **MemoryStorage** - In-memory (testing only, doesn't persist across processes)

## Usage

### As Library
```javascript
import { Agent, QLearning, createStorage, Env } from 'lsji';

// Create custom environment
class MyEnv extends Env {
  // implement getState, step, actionSize, reset
}

const storage = await createStorage('sqlite', { path: './my-agent.db' });
const qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });
const env = new MyEnv();
const agent = new Agent({ qlearning, storage, env });

await agent.train({ episodes: 1000 });
const result = await agent.play(userAction);
```

### CLI
```bash
# Install globally or use npx
npm link  # for local development

# Train
lsji train --episodes 500 --pattern 0

# Play
lsji play --hand 0  # 0=Rock, 1=Scissors, 2=Paper

# Status
lsji status --json

# Control
lsji start
lsji stop
```

## Development

### Commands
```bash
npm test        # Run tests (vitest)
npm run build   # No build step (ESM)
```

### Testing
- Tests use `vitest` with `MemoryStorage` for isolation
- Run `npm test` to verify all functionality

## Key Design Decisions

1. **ESM only** - Uses `"type": "module"` in package.json
2. **Node 22+** - Requires Node 22 for built-in `node:sqlite`
3. **Apache 2.0** - License compatible with Apache Incubator
4. **Single package** - All core functionality in one npm package
5. **Storage abstraction** - Easy to swap backends
6. **Worker.js compatibility** - Training patterns and reward logic match original

## Common Tasks

### Adding a New Environment
1. Create `src/envs/my-env.js` extending `Env`
2. Implement required methods
3. Use with `Agent`

### Adding a New Storage Backend
1. Create `src/storage/new-backend.js` extending `Storage`
2. Implement all abstract methods
3. Add to `createStorage` factory

### Modifying Learning Algorithm
- Extend `QLearning` class or create new algorithm in `src/core/`

## Git Workflow

- Commit messages in English
- Format: `<type>: <subject>` (e.g., `feat: add new environment base class`)
- Types: feat, fix, docs, refactor, test, chore

## License

Apache 2.0 - see LICENSE file
