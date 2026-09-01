# LSJI

A general-purpose reinforcement learning agent framework implemented in Node.js.

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green.svg)](https://nodejs.org/)

## Overview

LSJI (Learning System for Just-In-time Intelligence) is a lightweight, dependency-minimal reinforcement learning framework designed to run on Node.js. It provides:

- **Q-Learning Engine** with configurable learning rate, discount factor, and exploration rate
- **Pluggable Storage** abstraction supporting `node:sqlite` (built-in), `better-sqlite3`, and in-memory JSON
- **Environment Interface** for defining custom RL environments
- **CLI** for training, playing, and inspecting agents

Originally developed as a Cloudflare Workers-based Rock-Paper-Scissors AI, LSJI has been completely rearchitected as a platform-agnostic Node.js library suitable for ASF incubation.

## Installation

```bash
npm install lsji
# or for local development
npm link
```

## Quick Start

```bash
# Train an agent (200 episodes)
lsji train --episodes 200

# Play against the agent (0=Rock, 1=Scissors, 2=Paper)
lsji play --hand 0

# Check status
lsji status

# Start/stop the training loop
lsji start
lsji stop
```

## Programmatic Usage

```javascript
import { Agent, QLearning, MemoryStorage } from 'lsji';
import { RockPaperScissorsEnv } from 'lsji/envs'; // Next phase

const storage = new MemoryStorage();
const qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });
const agent = new Agent(qlearning, storage);

// Train
await agent.train({ episodes: 200 });

// Play
const result = await agent.play(0); // 0 = Rock
console.log(result); // { aiHand: 1, outcome: 'AI_WIN', ... }
```

## Architecture

```
src/
├── core/
│   ├── env.js          # Environment interface
│   ├── qlearning.js    # Q-Learning (TD) engine
│   └── agent.js        # High-level agent orchestration
├── storage/
│   ├── index.js        # Storage interface
│   ├── sqlite.js       # node:sqlite implementation
│   ├── better-sqlite.js # better-sqlite3 implementation
│   └── memory.js       # In-memory JSON implementation
├── cli.js              # CLI commands
└── index.js            # Public API exports
```

## Storage Backends

| Backend | Package | Description |
|---------|---------|-------------|
| `sqlite` | `node:sqlite` | Built-in Node.js 22+, zero dependencies (recommended) |
| `better-sqlite` | `better-sqlite3` | High-performance synchronous API |
| `memory` | (built-in) | In-memory JSON, ideal for testing |

```javascript
import { SqliteStorage } from 'lsji/storage';
const storage = new SqliteStorage('./data.db');
```

## Configuration

Environment variables:
- `LSJI_STORAGE` - Storage backend (`sqlite`, `better-sqlite`, `memory`, default: `sqlite`)
- `LSJI_DB_PATH` - Database file path (default: `./lsji.db`)

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

Copyright 2026 ryopc org
