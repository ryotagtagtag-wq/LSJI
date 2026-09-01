---
title: CLI Reference
description: Complete command-line interface for LSJI
---

# CLI Reference

LSJI includes a comprehensive CLI for RL agents, LLM agents, runtime server, and plugins.

## Installation

```bash
# Global install
npm install -g @game_ryo/lsji

# Or use npx
npx @game_ryo/lsji --help
```

---

## RL Agent Commands (Legacy)

### `lsji train`

Train the RL agent.

```bash
lsji train [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--episodes <n>` | Number of training episodes | 200 |
| `--pattern <0-3>` | Training pattern | 0 |
| `--batch-size <n>` | Database batch size | 200 |
| `--opponent <type>` | Opponent strategy | random |
| `--storage <type>` | Storage backend | sqlite |
| `--db-path <path>` | Database file path | ./lsji.db |
| `--alpha <n>` | Learning rate | 0.1 |
| `--gamma <n>` | Discount factor | 0.9 |
| `--epsilon <n>` | Exploration rate | 0.1 |
| `--json` | Output as JSON | false |

**Training Patterns:** `0`=Random, `1`=Always Rock, `2`=Counter, `3`=Sequential

### `lsji play`

Play a single game against the RL agent.

```bash
lsji play --hand <0|1|2> [options]
```

| Option | Description |
|--------|-------------|
| `--hand <0\|1\|2>` | Your hand: 0=Rock, 1=Scissors, 2=Paper |
| `--opponent <type>` | Opponent strategy |
| `--storage <type>` | Storage backend |
| `--db-path <path>` | Database file path |
| `--json` | Output as JSON |

### `lsji status`

Show RL system status.

```bash
lsji status [options]
```

### `lsji start` / `lsji stop`

Enable/disable RL training loop.

```bash
lsji start
lsji stop
```

---

## LLM Agent Commands (v0.3+)

### `lsji agent run`

Run an LLM agent on a task.

```bash
lsji agent run --task "Your task description" [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--task <string>` | Task description | (required) |
| `--provider <name>` | LLM provider: gemini, openai, anthropic, local | openai |
| `--model <name>` | Model name | gpt-4o-mini |
| `--api-key <key>` | API key (or use env var) | - |
| `--max-cost <n>` | Max cost per run (USD) | 10 |
| `--max-tokens <n>` | Max tokens per run | 100000 |
| `--hitl <true\|false>` | Enable HITL approvals | true |
| `--hitl-timeout <ms>` | Approval timeout | 300000 |
| `--conversation <tf>` | Enable conversation memory | true |
| `--semantic <tf>` | Enable semantic memory | false |
| `--episodic <tf>` | Enable episodic memory | true |
| `--hitl-required <list>` | Comma-separated tools needing approval | file_write,api_call,send_email,code_exec |
| `--max-steps <n>` | Max agent steps | 50 |
| `--json` | Output as JSON | false |

**Examples:**
```bash
# Simple task with Gemini
lsji agent run --task "Summarize TypeScript best practices" --provider gemini --model gemini-1.5-flash

# With budget limits
lsji agent run --task "Research AI trends" --max-cost 5 --max-tokens 50000

# Disable HITL for automation
lsji agent run --task "Read config file" --hitl false
```

### `lsji agent run-durable`

Run with checkpointing (resumable after crash).

```bash
lsji agent run-durable --task "Your task" [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--workflow-id <id>` | Workflow identifier | auto-generated |
| `--checkpoint-every <n>` | Checkpoint every N steps | 3 |
| `--resume-from <id>` | Resume from checkpoint ID | - |

**Example:**
```bash
# Durable run
lsji agent run-durable --task "Analyze codebase" --workflow-id my-analysis

# Resume after crash
lsji agent run-durable --task "Analyze codebase" --resume-from checkpoint_abc123
```

### `lsji agent status`

Show agent configuration status.

```bash
lsji agent status [--json]
```

---

## Budget Commands

### `lsji budget status`

```bash
lsji budget status [--budgetId <id>] [--json]
```

### `lsji budget check`

Check if operation is within budget.

```bash
lsji budget check --cost <n> --tokens <n> [--budgetId <id>] [--json]
```

### `lsji budget reset`

Reset run budget.

```bash
lsji budget reset [--budgetId <id>]
```

---

## HITL Commands

### `lsji hitl list`

List pending approvals.

```bash
lsji hitl list [--limit <n>] [--json]
```

### `lsji hitl approve`

Approve a pending request.

```bash
lsji hitl approve --id <approval-id> [--reason <string>] [--decider <name>] [--json]
```

### `lsji hitl reject`

Reject a pending request.

```bash
lsji hitl reject --id <approval-id> --reason <string> [--decider <name>] [--json]
```

### `lsji hitl status`

Show approval status.

```bash
lsji hitl status --id <approval-id> [--json]
```

---

## Checkpoint Commands

### `lsji checkpoint list`

List workflows with checkpoints.

```bash
lsji checkpoint list [--json]
```

### `lsji checkpoint show`

Show checkpoints for a workflow.

```bash
lsji checkpoint show --workflowId <id> [--json]
```

### `lsji checkpoint recover`

Recover from latest checkpoint.

```bash
lsji checkpoint recover --workflowId <id> [--json]
```

---

## Idempotency Commands

### `lsji idempotency cleanup`

Clean expired keys.

```bash
lsji idempotency cleanup
```

### `lsji idempotency list`

List keys for an operation.

```bash
lsji idempotency list --operation <name> [--limit <n>] [--json]
```

---

## Server Commands

### `lsji serve`

Start the runtime server with web control panel.

```bash
lsji serve [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--port <n>` | Server port | 3456 |
| `--no-ui` | Disable web UI, API only | false |
| `--storage <type>` | Storage backend | sqlite |
| `--db-path <path>` | Database file path | ./lsji.db |

**Examples:**
```bash
lsji serve                    # Start with UI on :3456
lsji serve --port 8080        # Custom port
lsji serve --no-ui            # Headless API only
```

---

## Plugin Commands

### `lsji plugin list`

List loaded plugins.

```bash
lsji plugin list [--json]
```

### `lsji plugin create`

Generate plugin template.

```bash
lsji plugin create --name <plugin-name>
```

### `lsji plugin load`

Load plugins from directory.

```bash
lsji plugin load --path <directory>
```

---

## Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--storage <type>` | Storage: sqlite, better-sqlite, memory | sqlite |
| `--db-path <path>` | Database file path | ./lsji.db |
| `--json` | Output as JSON | false |
| `--help` / `-h` | Show help | - |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `OLLAMA_HOST` | Ollama host URL | http://localhost:11434 |
| `LSJI_STORAGE` | Default storage backend | sqlite |
| `LSJI_DB_PATH` | Default database path | ./lsji.db |
| `LSJI_SERVER_PORT` | Server port | 3456 |

---

## Quick Reference Card

```bash
# RL (Legacy)
lsji train --episodes 500
lsji play --hand 0
lsji status --json

# LLM Agent
lsji agent run --task "Research topic" --provider gemini
lsji agent run-durable --task "Analyze" --workflow-id my-job

# Budget
lsji budget status
lsji budget check --cost 1 --tokens 5000

# HITL
lsji hitl list
lsji hitl approve --id abc --reason "OK"

# Server + UI
lsji serve
lsji serve --port 8080 --no-ui

# Plugins
lsji plugin list
lsji plugin create --name my-tools
```
