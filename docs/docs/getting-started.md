---
title: Getting Started
description: Install LSJI and run your first RL agent
---

# Getting Started

## Prerequisites

- **Node.js 22+** (required for built-in `node:sqlite`)
- npm, yarn, or pnpm

## Installation

```bash
# Install as a library
npm install lsji

# Or use CLI directly with npx
npx lsji --help
```

## Quick Start

### 1. Train an Agent

```bash
# Train with default settings (200 episodes, random pattern)
npx lsji train --episodes 500

# Train against specific opponent
npx lsji train --episodes 1000 --opponent counter
```

### 2. Play Against the Agent

```bash
# Play Rock (0)
npx lsji play --hand 0

# Play Paper (2)
npx lsji play --hand 2
```

### 3. Check Status

```bash
npx lsji status --json
```

## Using as a Library

```javascript
import { Agent, QLearning, createStorage, RockPaperScissorsEnv } from 'lsji';

async function main() {
  // Create storage (SQLite recommended for persistence)
  const storage = await createStorage('sqlite', { path: './my-agent.db' });

  // Create Q-Learning engine
  const qlearning = new QLearning({
    alpha: 0.1,    // learning rate
    gamma: 0.9,    // discount factor
    epsilon: 0.1,  // exploration rate
    storage
  });

  // Create environment
  const env = new RockPaperScissorsEnv({ opponent: 'random' });

  // Create agent
  const agent = new Agent({ qlearning, storage, env });

  // Train
  await agent.train({ episodes: 1000 });

  // Play
  const result = await agent.play(0); // 0 = Rock
  console.log(result);

  await storage.close();
}

main().catch(console.error);
```

## Next Steps

- Read [Core Concepts](/docs/core-concepts) to understand the architecture
- Explore [API Reference](/docs/api/agent) for detailed class documentation
- Try [Examples](/docs/examples/custom-environment) for custom environments
