---
title: Getting Started
description: Install LSJI and run your first AI agent
---

# Getting Started

## Prerequisites

- **Node.js 22+** (required for built-in `node:sqlite`)
- npm, yarn, or pnpm
- **API Key** (Gemini, OpenAI, or Anthropic) for LLM agents

## Installation

```bash
# Install as a library
npm install @game_ryo/lsji

# Or use CLI directly with npx
npx @game_ryo/lsji --help
```

## Quick Start: AI Agent (New in v0.3+)

### 1. Set Your API Key

```bash
# Option 1: Gemini (recommended - free tier available)
export GEMINI_API_KEY="your-gemini-key"

# Option 2: OpenAI
export OPENAI_API_KEY="your-openai-key"

# Option 3: Anthropic
export ANTHROPIC_API_KEY="your-anthropic-key"

# Option 4: Local (Ollama)
# No API key needed, just run: ollama serve
```

### 2. Start the Runtime Server with Web UI

```bash
npx @game_ryo/lsji serve
```

Open **http://localhost:3456** — you'll see the web control panel where you can:
- Create new agent runs with a task description
- Watch real-time thought logs (💭 thinking, ⚡ actions, 👁 observations)
- Approve/reject sensitive operations (file writes, API calls, code execution)
- Monitor budget/cost in real-time

### 3. Run an Agent Task via CLI

```bash
# Simple task with Gemini
npx @game_ryo/lsji agent run --task "Research TypeScript best practices and create a summary" --provider gemini --model gemini-1.5-flash

# Durable run with checkpointing (resumable after crash)
npx @game_ryo/lsji agent run-durable --task "Analyze codebase and create report" --workflow-id my-analysis

# With budget limits
npx @game_ryo/lsji agent run --task "Write a report" --max-cost 5 --max-tokens 50000
```

### 4. Manage Approvals

```bash
# List pending approvals
npx @game_ryo/lsji hitl list

# Approve via CLI
npx @game_ryo/lsji hitl approve --id <approval-id> --reason "Approved by human"
```

## Quick Start: RL Agent (Legacy)

### 1. Train an Agent

```bash
# Train with default settings (200 episodes, random pattern)
npx @game_ryo/lsji train --episodes 500

# Train against specific opponent
npx @game_ryo/lsji train --episodes 1000 --opponent counter
```

### 2. Play Against the Agent

```bash
# Play Rock (0)
npx @game_ryo/lsji play --hand 0

# Play Paper (2)
npx @game_ryo/lsji play --hand 2
```

### 3. Check Status

```bash
npx @game_ryo/lsji status --json
```

## Using as a Library

### AI Agent (v0.3+)

```javascript
import { createLLMAgent, startServer } from '@game_ryo/lsji';

async function main() {
  // Create agent with full production features
  const agent = await createLLMAgent({
    llm: { 
      provider: 'gemini', 
      model: 'gemini-1.5-flash', 
      apiKey: process.env.GEMINI_API_KEY 
    },
    budget: { maxCostPerRun: 5, maxCostPerDay: 50 },
    hitl: { enabled: true, defaultTimeout: 300000 },
    memory: { conversation: true, episodic: true, semantic: true },
  });

  const result = await agent.run("Research TypeScript best practices and create a summary");
  console.log(result.answer);

  await agent.shutdown();
}

// Or start the full runtime server
const server = await startServer({ port: 3456 });
// Visit http://localhost:3456 for the web control panel
```

### RL Agent (Legacy)

```javascript
import { Agent, QLearning, createStorage, RockPaperScissorsEnv } from '@game_ryo/lsji';

async function main() {
  const storage = await createStorage('sqlite', { path: './my-agent.db' });
  const qlearning = new QLearning({
    alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage
  });
  const env = new RockPaperScissorsEnv({ opponent: 'random' });
  const agent = new Agent({ qlearning, storage, env });

  await agent.train({ episodes: 1000 });
  const result = await agent.play(0);
  console.log(result);

  await storage.close();
}

main().catch(console.error);
```

## Next Steps

- Read [Core Concepts](/docs/core-concepts) to understand the architecture
- Explore [Runtime Server](/docs/runtime-server) for web control panel details
- Learn about [Plugins](/docs/plugins) to extend agent capabilities
- Check [API Reference](/docs/api/agent) for detailed class documentation
- Try [CLI Reference](/docs/cli) for all available commands
