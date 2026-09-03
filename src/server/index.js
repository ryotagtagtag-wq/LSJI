/**
 * LSJI Runtime Server
 * 
 * HTTP + WebSocket server for agent control panel.
 * Provides real-time thought logs, approval queue, budget monitoring.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { createExecutionEngine } from '../execution/engine.js';
import { createApprovalGate } from '../execution/hitl/approval-gate.js';
import { createBudgetController } from '../execution/budget/index.js';
import { createLLMAgent } from '../llm/llm-agent.js';
import { createStorage } from '../storage/index.js';
import { createToolRegistry } from '../llm/tools/registry.js';
import { loadPlugins, globalPluginRegistry } from '../llm/plugins/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server state
const activeRuns = new Map(); // runId -> { agent, workflowId, status, startTime }
const connectedClients = new Set();

/**
 * Create and configure Express app
 */
export function createApp(config = {}) {
  const app = express();
  const httpServer = createServer(app);
  
  // Socket.io with CORS
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware
  app.use(cors({ origin: config.corsOrigin || '*', credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // API: List active runs
  app.get('/api/runs', (req, res) => {
    const runs = Array.from(activeRuns.entries()).map(([runId, data]) => ({
      runId,
      workflowId: data.workflowId,
      status: data.status,
      startTime: data.startTime,
      duration: Date.now() - data.startTime,
      task: data.task?.slice(0, 100),
    }));
    res.json({ runs });
  });

  // API: Get run details
  app.get('/api/runs/:runId', (req, res) => {
    const run = activeRuns.get(req.params.runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json({
      runId: req.params.runId,
      workflowId: run.workflowId,
      status: run.status,
      startTime: run.startTime,
      task: run.task,
      steps: run.steps,
      budget: run.budget,
      thoughts: run.thoughts || [],
      currentThought: run.currentThought,
    });
  });

  // API: Start new agent run
  app.post('/api/runs', async (req, res) => {
    try {
      const { 
        task, 
        workflowId, 
        llm = { provider: 'openai', model: 'gpt-4o-mini' },
        budget = { maxCostPerRun: 10 },
        hitl = { enabled: true },
        plugins = [],
      } = req.body;

      if (!task) {
        return res.status(400).json({ error: 'Task is required' });
      }

      const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const wfId = workflowId || `wf_${Date.now()}`;

      // Initialize storage
      const storage = await createStorage(config.storage?.type || 'sqlite', config.storage?.options || {});

      // Create execution engine
      const execution = await createExecutionEngine({
        storage: { type: config.storage?.type || 'sqlite', options: config.storage?.options || {} },
        checkpointInterval: 3,
        idempotency: {},
      });

      // Create approval gate
      const hitlGate = await createApprovalGate({
        store: { type: config.storage?.type || 'sqlite', options: config.storage?.options || {} },
        notifier: { console: true },
        defaultTimeout: 300000,
      });

      // Create budget controller
      const budgetCtrl = createBudgetController(budget);

      // Load plugins
      const pluginTools = await loadPlugins(plugins);

      // Create tool registry with plugins
      const toolRegistry = createToolRegistry({
        approvalGate: hitlGate,
      });
      
      // Register plugin tools
      for (const [name, tool] of Object.entries(pluginTools)) {
        toolRegistry.register({ ...tool, category: 'plugin' });
      }

      // Create LLM agent with API key from request
      const finalApiKey = llm.apiKey || process.env[llm.provider === 'gemini' ? 'GEMINI_API_KEY' : llm.provider === 'openai' ? 'OPENAI_API_KEY' : llm.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : ''];
      const storageConfig = { type: config.storage?.type || 'sqlite', options: config.storage?.options || {} };
      const agent = await createLLMAgent({
        llm: { ...llm, apiKey: finalApiKey },
        storage: storageConfig,
        execution: { storage: storageConfig },
        hitl: { enabled: hitl.enabled !== false, defaultTimeout: 300000, store: storageConfig },
        budget,
        memory: { conversation: true, episodic: true, semantic: true },
        tools: { custom: toolRegistry },
      });

      // Store run info
      const runData = {
        agent,
        workflowId: wfId,
        status: 'running',
        startTime: Date.now(),
        task,
        steps: [],
        thoughts: [],
        budget: budgetCtrl.getStatus(runId),
        currentThought: null,
        execution,
        hitl: hitlGate,
        budgetCtrl,
      };
      activeRuns.set(runId, runData);

      // Execute agent task
      runAgent(runId, task, hitlGate, budgetCtrl, wfId, io);

      res.json({ runId, workflowId: wfId, status: 'started' });
    } catch (error) {
      console.error('Failed to start run:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: Approve/reject pending approval
  app.post('/api/approvals/:approvalId', async (req, res) => {
    try {
      const { approvalId } = req.params;
      const { action, reason } = req.body; // action: 'approve' | 'reject'

      // Find the run with this approval
      let targetRun = null;
      for (const [runId, run] of activeRuns) {
        const approval = await run.hitl.getApproval(approvalId);
        if (approval) {
          targetRun = run;
          break;
        }
      }

      if (!targetRun) {
        return res.status(404).json({ error: 'Approval not found in any active run' });
      }

      let result;
      if (action === 'approve') {
        result = await targetRun.hitl.approve(approvalId, { decider: 'ui-user', reason });
      } else if (action === 'reject') {
        result = await targetRun.hitl.reject(approvalId, { decider: 'ui-user', reason });
      } else {
        return res.status(400).json({ error: 'Invalid action. Use approve or reject' });
      }

      // Broadcast to all clients
      io.emit('approval:updated', { approvalId, status: result.status });

      res.json(result);
    } catch (error) {
      console.error('Approval error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: List pending approvals
  app.get('/api/approvals', async (req, res) => {
    try {
      const allApprovals = [];
      for (const [runId, run] of activeRuns) {
        const approvals = await run.hitl.getPendingApprovals(50);
        allApprovals.push(...approvals.map(a => ({ ...a, runId })));
      }
      res.json({ approvals: allApprovals });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Budget status
  app.get('/api/budget/:budgetId?', (req, res) => {
    const budgetId = req.params.budgetId || 'default';
    for (const [runId, run] of activeRuns) {
      if (run.budgetCtrl) {
        return res.json(run.budgetCtrl.getStatus(budgetId));
      }
    }
    const budgetCtrl = createBudgetController({});
    res.json(budgetCtrl.getStatus(budgetId));
  });

  // API: Plugins
  app.get('/api/plugins', (req, res) => {
    const plugins = globalPluginRegistry.listPlugins();
    res.json({ plugins });
  });

  // API: Stop a run
  app.post('/api/runs/:runId/stop', async (req, res) => {
    const runId = req.params.runId;
    const run = activeRuns.get(runId);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    
    run.status = 'stopped';
    await run.agent?.shutdown();
    await run.execution?.storage?.close();
    
    io.emit('run:stopped', { runId });
    res.json({ success: true });
  });

  // Serve static UI files (production)
  const uiPath = resolve(__dirname, 'ui/dist');
  app.use(express.static(uiPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
      res.sendFile(join(uiPath, 'index.html'), (err) => {
        if (err) res.status(404).send('UI not built. Run `npm run build:ui` first.');
      });
    }
  });

  // Socket.io connection handling
  io.on('connection', (socket) => {
    connectedClients.add(socket.id);
    console.log(`Client connected: ${socket.id} (total: ${connectedClients.size})`);

    // Send current state
    Promise.all(
      Array.from(activeRuns.entries()).map(async ([runId, run]) => {
        const approvals = await run.hitl.getPendingApprovals(50);
        return approvals.map(a => ({ ...a, runId }));
      })
    ).then(allApprovalsArrays => {
      const currentApprovals = allApprovalsArrays.flat();
      
      socket.emit('init', {
        runs: Array.from(activeRuns.entries()).map(([runId, data]) => ({
          runId,
          workflowId: data.workflowId,
          status: data.status,
          startTime: data.startTime,
          task: data.task?.slice(0, 100),
        })),
        approvals: currentApprovals,
      });
    }).catch(console.error);

    // Subscribe to run updates
    socket.on('subscribe:run', (runId) => {
      socket.join(`run:${runId}`);
    });

    socket.on('unsubscribe:run', (runId) => {
      socket.leave(`run:${runId}`);
    });

    socket.on('disconnect', () => {
      connectedClients.delete(socket.id);
      console.log(`Client disconnected: ${socket.id} (total: ${connectedClients.size})`);
    });
  });

  return { app, httpServer, io, activeRuns };
}

/**
 * Run agent task with real-time updates
 */
async function runAgent(runId, task, hitlGate, budgetCtrl, workflowId, io) {
  const run = activeRuns.get(runId);
  if (!run) return;

  try {
    // Add initial thought
    run.thoughts.push({
      id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'thought',
      content: `Starting task: ${task.slice(0, 200)}`,
      timestamp: new Date().toISOString(),
    });
    io.to(`run:${runId}`).emit('thought:new', run.thoughts[run.thoughts.length - 1]);

    const result = await run.agent.run(task, {
      runId,
      budgetId: runId,
      hitlRequired: ['file_write', 'api_call', 'send_email', 'code_exec', 'db_query'],
      maxSteps: 50,
    });

    run.status = result.success ? 'completed' : 'failed';
    run.steps = result.steps;
    run.budget = run.budgetCtrl.getStatus(runId);
    
    // Add completion thought
    run.thoughts.push({
      id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: result.success ? 'observation' : 'error',
      content: result.success ? `Task completed successfully` : `Task failed: ${result.error || 'Unknown error'}`,
      timestamp: new Date().toISOString(),
    });
    io.to(`run:${runId}`).emit('thought:new', run.thoughts[run.thoughts.length - 1]);
    
    io.to(`run:${runId}`).emit('run:completed', { runId, result });
    io.emit('run:updated', { runId, status: run.status, result });
    
  } catch (error) {
    run.status = 'error';
    run.error = error.message;
    
    run.thoughts.push({
      id: `thought_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'error',
      content: `Error: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
    io.to(`run:${runId}`).emit('thought:new', run.thoughts[run.thoughts.length - 1]);
    
    io.to(`run:${runId}`).emit('run:error', { runId, error: error.message });
    io.emit('run:updated', { runId, status: 'error', error: error.message });
  }
}

/**
 * Start the server
 */
export async function startServer(config = {}) {
  const { app, httpServer, io, activeRuns: runs } = createApp(config);
  
  const port = config.port || process.env.LSJI_SERVER_PORT || 3456;
  const host = config.host || '0.0.0.0';

  return new Promise((resolve) => {
    httpServer.listen(port, host, () => {
      console.log(`LSJI Server running at http://${host}:${port}`);
      console.log(`WebSocket ready for connections`);
      resolve({ app, httpServer, io, activeRuns: runs, port, host });
    });
  });
}

/**
 * Stop the server
 */
export async function stopServer(server) {
  // Stop all active runs
  for (const [runId, run] of server.activeRuns) {
    run.status = 'stopped';
    await run.agent?.shutdown();
    await run.execution?.storage?.close();
  }
  
  // Close connections
  server.io.close();
  await new Promise(resolve => server.httpServer.close(resolve));
  console.log('LSJI Server stopped');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = {
    port: parseInt(process.argv[2]) || 3456,
    storage: { type: 'sqlite', options: { path: './lsji.db' } },
  };
  
  startServer(config).catch(console.error);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}

export { activeRuns, connectedClients };
