---
title: Runtime Server & Web Control Panel
description: Start the LSJI runtime server with real-time web UI for agent management
---

# Runtime Server & Web Control Panel

LSJI v0.3+ includes a built-in runtime server with a React-based web control panel for managing AI agents in real-time.

## Starting the Server

```bash
# Start with web UI (default)
npx @game_ryo/lsji serve

# Start on custom port
npx @game_ryo/lsji serve --port 8080

# Headless mode (no UI, API only)
npx @game_ryo/lsji serve --no-ui

# With custom storage
npx @game_ryo/lsji serve --storage better-sqlite --db-path ./data.db
```

The server runs on **http://localhost:3456** by default.

## Web Control Panel

When running with UI enabled, visit http://localhost:3456 for the dashboard.

### Dashboard Panels

| Panel | Description |
|-------|-------------|
| **Runs** | List all active/completed runs, start new ones, stop running tasks |
| **Thought Log** | Real-time stream of agent reasoning: 💭 thoughts, ⚡ actions, 👁 observations, ❌ errors |
| **Approval Queue** | One-click approve/reject for HITL-protected operations |
| **Budget** | Live cost tracking with progress bars, circuit breaker status |
| **Plugins** | View loaded custom tool plugins |

### Thought Log

The thought log shows the agent's internal reasoning process in real-time:

- **💭 THOUGHT** — Agent's internal reasoning
- **⚡ ACTION** — Tool invocation (name, args)
- **👁 OBSERVATION** — Tool result returned to agent
- **❌ ERROR** — Any errors during execution

Entries appear instantly via WebSocket as the agent runs.

### Approval Queue

When the agent attempts a sensitive operation (file write, API call, code exec, email, DB query), it pauses and requests approval:

1. Approval appears in the queue with **PENDING** badge
2. Click **Show Details** to see the full context (tool, parameters)
3. Enter optional reason, click **✓ Approve** or **✗ Reject**
4. Agent resumes immediately upon decision

Approvals can also be managed via CLI:
```bash
npx @game_ryo/lsji hitl list
npx @game_ryo/lsji hitl approve --id <id> --reason "Approved"
npx @game_ryo/lsji hitl reject --id <id> --reason "Not safe"
```

### Budget Monitor

Real-time cost tracking per run, day, and month:

- **Run Cost** — Current run spending with progress bar
- **Daily Cost** — Today's total with daily limit
- **Monthly Cost** — Month-to-date with monthly limit
- **Circuit Breaker** — State (closed/half-open/open) and failure count

When limits are exceeded, the circuit breaker opens and blocks further LLM calls.

## API Endpoints

The server exposes a REST API for programmatic control:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/runs` | List all runs |
| GET | `/api/runs/:runId` | Get run details (thoughts, budget, status) |
| POST | `/api/runs` | Start new agent run |
| POST | `/api/runs/:runId/stop` | Stop a running task |
| GET | `/api/approvals` | List all pending approvals |
| POST | `/api/approvals/:id` | Approve/reject (`{action: "approve\|reject", reason: "..."}`) |
| GET | `/api/budget/:budgetId?` | Get budget status |
| GET | `/api/plugins` | List loaded plugins |

### Example: Start a Run via API

```bash
curl -X POST http://localhost:3456/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Research TypeScript best practices and create a summary",
    "llm": { "provider": "gemini", "model": "gemini-1.5-flash" },
    "budget": { "maxCostPerRun": 5 },
    "hitl": { "enabled": true }
  }'
```

### Example: Approve via API

```bash
curl -X POST http://localhost:3456/api/approvals/abc-123 \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "reason": "Approved via API"}'
```

## WebSocket Events

Real-time updates via Socket.io:

| Event | Payload | Description |
|-------|---------|-------------|
| `init` | `{runs, approvals}` | Initial state on connect |
| `run:updated` | `{runId, status, result?}` | Run status changed |
| `run:completed` | `{runId, result}` | Run finished |
| `run:error` | `{runId, error}` | Run failed |
| `run:stopped` | `{runId}` | Run manually stopped |
| `thought:new` | `{runId, thought}` | New thought log entry |
| `approval:new` | `{id, action, context, runId}` | New approval requested |
| `approval:updated` | `{approvalId, status}` | Approval decided |

### Connecting from JavaScript

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3456');

socket.on('thought:new', (thought) => {
  console.log(`[${thought.type}] ${thought.content}`);
});

socket.on('approval:new', (approval) => {
  console.log(`Approval needed: ${approval.action}`, approval.context);
});

// Subscribe to specific run
socket.emit('subscribe:run', 'run_123456');
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LSJI_SERVER_PORT` | `3456` | Server port |
| `LSJI_STORAGE` | `sqlite` | Storage backend |
| `LSJI_DB_PATH` | `./lsji.db` | Database file path |

## Programmatic Usage

```javascript
import { startServer, stopServer } from '@game_ryo/lsji';

async function main() {
  const server = await startServer({ 
    port: 3456,
    storage: { type: 'sqlite', options: { path: './data.db' } }
  });
  
  console.log(`Server running at http://localhost:${server.port}`);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await stopServer(server);
    process.exit(0);
  });
}

main();
```

## Architecture

The server integrates all LSJI production systems:

```
HTTP Request
    │
    ▼
Express Router
    │
    ├── /api/runs ──────────► LLMAgent.run() ──────► LLM Provider
    │                            │
    │                            ├── ToolRegistry.execute()
    │                            │       │
    │                            │       ├── HITL (ApprovalGate) ◄── WebSocket ◄── UI
    │                            │       ├── IdempotencyStore
    │                            │       └── BudgetController
    │                            │
    │                            ├── Memory (Conversation/Episodic/Semantic)
    │                            └── ExecutionEngine (Checkpoints)
    │
    ├── /api/approvals ──────► ApprovalGate.approve/reject()
    │
    └── WebSocket ──────────► Real-time events (Socket.io)
```

## Production Considerations

- **Authentication**: Add auth middleware for production (not built-in)
- **Reverse Proxy**: Run behind nginx/Traefik with TLS
- **Process Manager**: Use PM2 or systemd for auto-restart
- **Database**: Use `better-sqlite` for higher concurrency
- **Monitoring**: Health endpoint at `/health` for load balancers
