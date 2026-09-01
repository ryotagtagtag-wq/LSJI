# Language Service JavaScript Interface (LSJI)

> **Antigravity-level agentic autonomy meets the ultimate simplicity of self-hosting.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/lsji.svg)](https://www.npmjs.com/package/lsji)

## Overview

**LSJI** (Language Service JavaScript Interface) is a production-grade framework for hosting AI agents with **zero infrastructure complexity**. Simply provide a Gemini API key (or OpenAI/Anthropic/local) and deploy autonomous agents with:

- 🧠 **LLM Agent Runtime** — ReAct pattern with tools, memory, and streaming
- 🛡️ **HITL (Human-in-the-Loop)** — Approval gates for sends, charges, code execution
- 🔄 **Durability** — Checkpointing & recovery from any failure
- ♻️ **Idempotency** — Duplicate prevention on retries
- 💰 **Budget Controls** — Token/cost limits with circuit breaker
- 🌐 **Web Control Panel** — Real-time thought logs, approval queue, budget monitoring
- 🔌 **Plugin System** — Drop-in custom tools via `lsji-plugins/`
- 💾 **Pluggable Storage** — `node:sqlite` (built-in), `better-sqlite3`, or in-memory

**Perfect for:** Self-hosted AI assistants, autonomous coding agents, research agents, workflow automation.

## Quick Start (30 seconds)

```bash
# Install
npm install lsji

# Set your API key (Gemini, OpenAI, or Anthropic)
export GEMINI_API_KEY="your-gemini-key"
# or: export OPENAI_API_KEY="your-openai-key"

# Start the runtime server with web UI
npx lsji serve

# Open http://localhost:3456 — create runs, watch thought logs, approve actions
```

## CLI Usage

```bash
# Runtime server with control panel
lsji serve --port 3456              # Start server + UI
lsji serve --no-ui                  # Headless mode

# Agent operations
lsji agent run --task "Write a report on AI trends" --provider gemini --model gemini-1.5-flash
lsji agent run-durable --task "Analyze codebase" --workflow-id my-analysis

# Budget & approvals
lsji budget status --budgetId my-project
lsji hitl list                       # Pending approvals
lsji hitl approve --id <id> --reason "Approved"

# Plugins
lsji plugin list
lsji plugin create --name my-tools   # Generate template

# RL (legacy)
lsji train --episodes 500
lsji play --hand 0
```

## Programmatic Usage

```javascript
import { createLLMAgent, startServer } from 'lsji';

// Create an agent with full production features
const agent = await createLLMAgent({
  llm: { provider: 'gemini', model: 'gemini-1.5-flash', apiKey: process.env.GEMINI_API_KEY },
  budget: { maxCostPerRun: 5, maxCostPerDay: 50 },
  hitl: { enabled: true, defaultTimeout: 300000 }, // 5 min approval timeout
  memory: { conversation: true, episodic: true, semantic: true },
});

const result = await agent.run("Research TypeScript best practices and create a summary");
console.log(result.answer);

// Or start the full runtime server
const server = await startServer({ port: 3456 });
// Visit http://localhost:3456 for the web control panel
```

## Web Control Panel

When you run `lsji serve`, you get a real-time dashboard at **http://localhost:3456**:

| Panel | Features |
|-------|----------|
| **Runs** | List active/completed runs, start new ones |
| **Thought Log** | Stream agent's reasoning (💭 thoughts, ⚡ actions, 👁 observations) |
| **Approval Queue** | One-click approve/reject for file writes, API calls, emails, code exec |
| **Budget** | Real-time cost tracking with progress bars & circuit breaker status |
| **Plugins** | View loaded custom tools |

## Tool Plugin System

Drop `.js` files in `lsji-plugins/` to extend agent capabilities:

```javascript
// lsji-plugins/my-tools.js
export default {
  name: 'my-tools',
  version: '1.0.0',
  tools: {
    my_custom_action: {
      name: 'my_custom_action',
      description: 'Do something custom',
      parameters: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] },
      requiresApproval: false,
      async execute({ input }) { return { result: `Processed: ${input}` }; }
    }
  }
};
```

```bash
lsji plugin list  # Shows: my-tools (1 tools)
```

## Architecture

```
src/
├── core/              # RL foundations (Env, QLearning, Agent)
├── storage/           # Pluggable backends (sqlite, better-sqlite3, memory)
├── execution/         # Production systems
│   ├── budget/        # TokenCounter, CostTracker, CircuitBreaker
│   ├── hitl/          # ApprovalGate, ApprovalStore, Notifier
│   ├── idempotency.js # Duplicate prevention
│   └── engine.js      # Durable execution with checkpoints
├── llm/               # LLM Agent Framework
│   ├── providers/     # OpenAI, Anthropic, Local (Ollama), Gemini
│   ├── llm-agent.js   # ReAct agent with tools & memory
│   ├── tools/         # Built-in: web_search, file_read, file_write, code_exec, api_call, send_email, db_query
│   ├── memory/        # Conversation, Semantic, Episodic
│   ├── plugins/       # Dynamic plugin system
│   └── prompt-manager.js
├── server/            # Runtime server + Web UI
│   ├── index.js       # Express + Socket.io
│   └── ui/            # React + Vite control panel
└── cli.js             # All commands
```

## LLM Providers

| Provider | Models | Setup |
|----------|--------|-------|
| **Gemini** | gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash | `GEMINI_API_KEY` |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo | `OPENAI_API_KEY` |
| **Anthropic** | claude-3-5-sonnet, claude-3-opus, claude-3-haiku | `ANTHROPIC_API_KEY` |
| **Local** | Any Ollama model | `OLLAMA_HOST` (default: http://localhost:11434) |

## Configuration

Environment variables:
- `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — API keys
- `LSJI_STORAGE` — Storage backend (`sqlite`, `better-sqlite`, `memory`, default: `sqlite`)
- `LSJI_DB_PATH` — Database file path (default: `./lsji.db`)
- `LSJI_SERVER_PORT` — Server port (default: `3456`)

## Why LSJI for AI Agents?

| Feature | Typical Agent Frameworks | LSJI |
|---------|-------------------------|------|
| Self-hosted | ❌ Often cloud-only | ✅ Single binary, zero deps |
| HITL approvals | ❌ Manual or none | ✅ Built-in with web UI |
| Durability | ❌ Lose state on crash | ✅ Checkpoint & resume |
| Cost control | ❌ Unlimited spend | ✅ Budget + circuit breaker |
| Idempotency | ❌ Your problem | ✅ Automatic |
| Web UI | ❌ Separate project | ✅ Embedded, zero config |
| Plugins | ❌ Complex SDK | ✅ Drop `.js` files |
| Gemini support | ⚠️ Often missing | ✅ First-class |

## Roadmap

- [ ] **v0.4** — Multi-agent orchestration, A2A protocol
- [ ] **v0.5** — WASM sandbox for code_exec, vector memory
- [ ] **v1.0** — ASF incubation, stability guarantees

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

Copyright 2026 ryopc org

---

**Built for engineers who want agentic autonomy without the infrastructure burden.**  
If you find LSJI useful, ⭐ the repo and consider sponsoring!
