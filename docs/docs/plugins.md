---
title: Tool Plugin System
description: Extend LSJI agents with custom tools via drop-in plugins
---

# Tool Plugin System

LSJI v0.3+ includes a dynamic plugin system that lets you extend agent capabilities by simply dropping `.js` files into a directory.

## Quick Start

```bash
# 1. Generate a plugin template
npx @game_ryo/lsji plugin create --name my-tools

# 2. Edit the generated file in lsji-plugins/my-tools.js

# 3. Restart the server or agent — plugin loads automatically
```

## Plugin Structure

A plugin is a JavaScript module that exports a default object:

```javascript
// lsji-plugins/my-tools.js
export default {
  name: 'my-tools',
  version: '1.0.0',
  
  tools: {
    tool_name: {
      name: 'tool_name',
      description: 'What this tool does',
      category: 'plugin',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' },
        },
        required: ['input'],
      },
      requiresApproval: false,  // true = HITL required
      idempotent: true,         // true = deduplicate on retry
      async execute({ input }, context) {
        // Your tool logic here
        return { result: `Processed: ${input}` };
      },
    },
  },
  
  // Optional lifecycle hooks
  async init() { console.log('[my-tools] Initialized'); },
  async cleanup() { console.log('[my-tools] Cleaned up'); },
};
```

## Tool Definition Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique tool name (used by LLM) |
| `description` | Yes | Human-readable, shown to LLM |
| `category` | No | Grouping (default: 'plugin') |
| `parameters` | Yes | JSON Schema for arguments |
| `requiresApproval` | No | If true, pauses for human approval (default: false) |
| `idempotent` | No | If true, deduplicates on retry (default: true) |
| `execute` | Yes | Async function `(params, context) => result` |

## Plugin Discovery

Plugins are loaded from these directories (in order):

1. `./lsji-plugins/` (project root)
2. `~/.lsji/plugins/` (user home)
3. `src/llm/plugins/` (built-in)

The first plugin with a given tool name wins. Restart the server/agent to reload plugins.

## CLI Commands

```bash
# List loaded plugins
npx @game_ryo/lsji plugin list

# Generate template
npx @game_ryo/lsji plugin create --name my-awesome-tools

# Load from custom path
npx @game_ryo/lsji plugin load --path ./custom-plugins
```

## Built-in Tools (Reference)

LSJI includes these built-in tools that plugins can complement:

| Tool | Category | Approval | Description |
|------|----------|----------|-------------|
| `web_search` | research | No | Search the web |
| `file_read` | filesystem | No | Read a file |
| `file_write` | filesystem | Yes | Write a file |
| `code_exec` | code | Yes | Execute code (sandboxed) |
| `api_call` | network | Yes | HTTP API call |
| `send_email` | communication | Yes | Send email |
| `db_query` | data | Yes | Execute SQL query |

## Example Plugins

### File Operations Plugin

```javascript
// lsji-plugins/file-ops.js
import { promises as fs } from 'fs';
import { join } from 'path';

export default {
  name: 'file-ops',
  version: '1.0.0',
  tools: {
    file_list: {
      name: 'file_list',
      description: 'List files in a directory',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', default: '.' } },
      },
      requiresApproval: false,
      async execute({ path = '.' }) {
        const entries = await fs.readdir(path, { withFileTypes: true });
        return entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file',
          path: join(path, e.name),
        }));
      },
    },
    file_delete: {
      name: 'file_delete',
      description: 'Delete a file',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
      requiresApproval: true,
      async execute({ path }) {
        await fs.unlink(path);
        return { deleted: path };
      },
    },
  },
};
```

### GitHub Integration Plugin

```javascript
// lsji-plugins/github.js
export default {
  name: 'github',
  version: '1.0.0',
  tools: {
    github_create_issue: {
      name: 'github_create_issue',
      description: 'Create a GitHub issue',
      category: 'github',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } },
        },
        required: ['owner', 'repo', 'title'],
      },
      requiresApproval: true,
      async execute({ owner, repo, title, body, labels }, context) {
        const token = process.env.GITHUB_TOKEN;
        if (!token) throw new Error('GITHUB_TOKEN not set');
        
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
          },
          body: JSON.stringify({ title, body, labels }),
        });
        return res.json();
      },
    },
  },
};
```

## Advanced: Tool Context

The `context` parameter in `execute()` provides:

```typescript
interface ToolContext {
  runId: string;           // Current run ID
  budgetId: string;        // Budget identifier
  approvalGate: ApprovalGate;  // For nested approvals
  idempotencyStore: IdempotencyStore; // For nested idempotency
  // ... other runtime services
}
```

## Best Practices

1. **Keep tools focused** — One tool, one purpose
2. **Use JSON Schema** — Enables LLM to understand parameters
3. **Handle errors gracefully** — Return `{ error: "message" }` not throw
4. **Set `requiresApproval` wisely** — Protect destructive operations
5. **Make idempotent when possible** — Safe retries
6. **Document in description** — LLM reads this to decide when to use

## Debugging

```bash
# List all loaded plugins and their tools
npx @game_ryo/lsji plugin list --json

# Check if tool is registered
npx @game_ryo/lsji agent status --json
# Look for tool names in output
```

## Plugin API (Programmatic)

```javascript
import { loadPlugins, globalPluginRegistry, createPluginTemplate } from '@game_ryo/lsji';

// Load from custom paths
const tools = await loadPlugins(['./my-plugins', './other-plugins']);

// Use global registry
globalPluginRegistry.register({
  name: 'dynamic',
  version: '1.0.0',
  tools: { /* ... */ },
});

// Generate template as string
const template = createPluginTemplate('my-plugin');
console.log(template);
```
