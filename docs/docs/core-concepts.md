---
title: Core Concepts
description: Understand the core architecture of LSJI
---

# Core Concepts

LSJI is built around **two complementary paradigms**:

1. **RL Agent Framework** — Classical reinforcement learning (Q-Learning, environments)
2. **LLM Agent Framework** — Production-grade LLM-based agents with HITL, durability, budget controls

---

## RL Agent Framework (Legacy)

### Architecture Overview

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

The `Env` interface defines the problem domain:

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

Pluggable persistence layer:

| Backend | Package | Use Case |
|---------|---------|----------|
| `SqliteStorage` | `node:sqlite` (built-in) | **Recommended** — Zero dependencies |
| `BetterSqliteStorage` | `better-sqlite3` | High-performance synchronous access |
| `MemoryStorage` | Built-in | Testing, CI, ephemeral workloads |

### 4. Agent (`Agent`)

High-level orchestration:

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

---

## LLM Agent Framework (v0.3+)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      LLMAgent                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │   LLM       │ │   Tools     │ │   Memory    │ │  Prompt     │   │
│  │ Providers   │ │  Registry   │ │  Systems    │ │  Manager    │   │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘   │
│         │               │               │               │          │
│         ▼               ▼               ▼               ▼          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Execution Engine (Durability)                  │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │  │
│  │  │ Checkpoint │ │  Budget    │ │   HITL     │ │Idempotent│ │  │
│  │  │   Store    │ │  Control   │ │ (Approvals)│ │  Store   │ │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. LLM Providers

Unified interface for multiple providers:

| Provider | Models | Config |
|----------|--------|--------|
| **Gemini** | gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash | `GEMINI_API_KEY` |
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo | `OPENAI_API_KEY` |
| **Anthropic** | claude-3-5-sonnet, claude-3-opus, claude-3-haiku | `ANTHROPIC_API_KEY` |
| **Local (Ollama)** | Any local model | `OLLAMA_HOST` |

### 2. Tool Registry

Manages available tools with built-in HITL & idempotency:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;      // Parameters schema for LLM
  requiresApproval: boolean;   // Pause for human approval
  idempotent: boolean;         // Deduplicate on retry
  execute(params, context): Promise<any>;
}
```

**Built-in Tools:**
| Tool | Category | Approval | Description |
|------|----------|----------|-------------|
| `web_search` | research | No | Search the web |
| `file_read` | filesystem | No | Read a file |
| `file_write` | filesystem | **Yes** | Write a file |
| `code_exec` | code | **Yes** | Execute code (sandboxed) |
| `api_call` | network | **Yes** | HTTP API call |
| `send_email` | communication | **Yes** | Send email |
| `db_query` | data | **Yes** | Execute SQL query |

### 3. Memory Systems

Three complementary memory types:

| Memory | Purpose | Persistence |
|--------|---------|-------------|
| **Conversation** | Chat history for context | Session + optional DB |
| **Episodic** | Task execution traces (steps, tools, results) | DB, queryable |
| **Semantic** | Long-term knowledge, facts | Vector DB (future) |

### 4. Production Systems

#### Budget Control
- **TokenCounter** — Accurate token counting per provider
- **CostTracker** — Per-run, daily, monthly limits with USD costs
- **CircuitBreaker** — Auto-stops on repeated failures

#### HITL (Human-in-the-Loop)
- **ApprovalGate** — Request/approve/reject/expire workflows
- **ApprovalStore** — Persistent storage with TTL
- **Notifier** — Console, webhook, email channels

#### Durability
- **ExecutionEngine** — Checkpoint every N steps
- **Recovery** — Resume from latest checkpoint after crash
- **Workflow ID** — Track multi-step executions

#### Idempotency
- **IdempotencyStore** — Key-based deduplication
- **TTL** — Auto-expire after 24h (configurable)
- **Auto-generate** — `executeAuto()` for convenience

---

## Data Flow

### RL Training Loop
```
for each episode:
  1. Get current state from Env
  2. Select action via QLearning.act() (ε-greedy)
  3. Execute action in Env → StepResult
  4. Update Q-table via QLearning.learnSimple()
  5. Persist battle record to Storage
  6. Batch DB writes for performance
```

### LLM Agent Execution (ReAct Pattern)
```
1. Build system prompt with tool definitions
2. LLM generates response (thought + optional tool calls)
3. For each tool call:
   a. Check HITL approval if required
   b. Check idempotency key
   c. Execute tool
   d. Record in episodic memory
   e. Return result to LLM
4. Loop until final answer (no tool calls)
5. Track tokens/cost in budget controller
6. Checkpoint state periodically
```

---

## Reward System (RPS Example)

| Outcome | Judge Formula | Reward |
|---------|---------------|--------|
| Win     | (ai - user + 3) % 3 = 2 | +1 |
| Lose    | (ai - user + 3) % 3 = 1 | -1 |
| Draw    | (ai - user + 3) % 3 = 0 | 0 |

---

## Training Patterns (RL)

| Pattern | ID | Description |
|---------|-----|-------------|
| Random | 0 | Uniform random actions |
| Always Rock | 1 | Always play action 0 |
| Counter | 2 | Play counter to previous action |
| Sequential | 3 | Cycle through 0,1,2,0,1,2... |

Custom patterns via `actionSelector` function.

---

## Key Differences: RL vs LLM Agents

| Aspect | RL Agent | LLM Agent |
|--------|----------|-----------|
| **Learning** | Q-table updates via TD | In-context (no weight updates) |
| **State** | Discrete string states | Conversation + memory |
| **Actions** | Fixed discrete set | Dynamic tool calls |
| **Exploration** | ε-greedy | Temperature + prompt |
| **Persistence** | Q-table in SQLite | Checkpoints + episodic memory |
| **Human Control** | Start/stop training | HITL per sensitive action |
| **Cost Control** | N/A | Budget + circuit breaker |
