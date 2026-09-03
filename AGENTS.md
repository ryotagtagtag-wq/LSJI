# AGENTS.md

## Project Overview

**LSJI** (Learning System for JavaScript Intelligence) is a general-purpose Reinforcement Learning agent framework for Node.js. It provides a clean abstraction for building RL agents with pluggable storage backends, environments, and learning algorithms.

Originally migrated from a Cloudflare Workers implementation (Rock-Paper-Scissors AI), now redesigned as a standalone npm package with MIT license, targeting MIT licensed.

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
├── execution/          # Production execution systems
│   ├── budget/         # TokenCounter, CostTracker, CircuitBreaker
│   ├── hitl/           # ApprovalGate, ApprovalStore, Notifier
│   ├── idempotency.js  # Duplicate prevention
│   └── engine.js       # Durable execution with checkpoints
├── llm/                # LLM Agent Framework
│   ├── providers/      # OpenAI, Anthropic, Gemini, Local (Ollama)
│   ├── llm-agent.js    # ReAct agent with tools & memory
│   ├── tools/          # Built-in tools (web_search, file_read, file_write, code_exec, api_call, send_email, db_query)
│   ├── memory/         # Conversation, Semantic, Episodic
│   ├── plugins/        # Dynamic plugin system
│   └── prompt-manager.js
├── server/             # Runtime server + Web UI
│   ├── index.js        # Express + Socket.io
│   └── ui/             # React + Vite control panel
├── envs/
│   └── rps.js          # Rock-Paper-Scissors environment
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

### As Library (RL)
```javascript
import { Agent, QLearning, createStorage, Env } from '@game_ryo/lsji';

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

### As Library (LLM Agent)
```javascript
import { createLLMAgent, startServer } from '@game_ryo/lsji';

// Create an agent with full production features
const agent = await createLLMAgent({
  llm: { provider: 'gemini', model: 'gemini-1.5-flash', apiKey: process.env.GEMINI_API_KEY },
  budget: { maxCostPerRun: 5, maxCostPerDay: 50 },
  hitl: { enabled: true, defaultTimeout: 300000 }, // 5 min approval timeout
  memory: { conversation: true, episodic: true, semantic: true },
  storage: { type: 'sqlite', options: { path: './lsji.db' } },
});

const result = await agent.run("Research TypeScript best practices and create a summary");
console.log(result.answer);

// Or start the full runtime server
const server = await startServer({ port: 3456 });
// Visit http://localhost:3456 for the web control panel
```

### CLI
```bash
# Install globally or use npx
npm link  # for local development

# RL Commands
npx @game_ryo/lsji train --episodes 500 --pattern 0
npx @game_ryo/lsji play --hand 0  # 0=Rock, 1=Scissors, 2=Paper
npx @game_ryo/lsji status --json
npx @game_ryo/lsji start
npx @game_ryo/lsji stop

# LLM Agent Commands
npx @game_ryo/lsji agent run --task "Search for latest AI news and summarize" --provider gemini --model gemini-1.5-flash
npx @game_ryo/lsji agent run-durable --task "Analyze codebase and create report" --workflow-id my-analysis
npx @game_ryo/lsji agent status

# Budget & Approvals
npx @game_ryo/lsji budget status --budgetId my-project
npx @game_ryo/lsji hitl list                       # Pending approvals
npx @game_ryo/lsji hitl approve --id <id> --reason "Approved"

# Durability
npx @game_ryo/lsji checkpoint list
npx @game_ryo/lsji checkpoint show --workflowId my-analysis
npx @game_ryo/lsji checkpoint recover --workflowId my-analysis

# Plugins
npx @game_ryo/lsji plugin list
npx @game_ryo/lsji plugin create --name my-tools

# Server
npx @game_ryo/lsji serve --port 3456
```

## Development

### Commands
```bash
npm test        # Run tests (vitest)
npm run build   # No build step (ESM)
npm run build:ui # Build web UI
npm run serve   # Start runtime server
```

### Testing
- Tests use `vitest` with `Memo## Key Design Decisions

1. **ESM only** - Uses `"type": "module"` in package.json
2. **Node 22+** - Requires Node 22 for built-in `node:sqlite`
3. **MIT** - License compatible with open source
4. **Single package** - All core functionality in one npm package
5. **Storage abstraction** - Easy to swap backends
6. **Worker.js compatibility** - Training patterns and reward logic match original
7. **Production-grade** - HITL, durability, budget controls, idempotency built-in

## Common Tasks

### Adding a New Environment
1. Create `src/envs/my-env.js` extending `Env`
2. Implement required methods
3. Use with `Agent`

### Adding a New Storage Backend
1. Create `src/storage/new-backend.js` extending `Storage`
2. Implement all abstract methods
3. Add to `createStorage` factory

### Adding a New LLM Tool
1. Create tool definition in `src/llm/tools/registry.js` or plugin
2. Implement `execute` function
3. Add to tool registry

### Modifying Learning Algorithm
- Extend `QLearning` class or create new algorithm in `src/core/`

## Git Workflow

- Commit messages in English
- Format: `<type>: <subject>` (e.g., `feat: add new environment base class`)
- Types: feat, fix, docs, refactor, test, chore

## License

MIT - see LICENSE file

## Git Workflow

- Commit messages in English
- Format: `<type>: <subject>` (e.g., `feat: add new environment base class`)
- Types: feat, fix, docs, refactor, test, chore

## License

MIT - see LICENSE file
