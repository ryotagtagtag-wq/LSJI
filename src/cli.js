/**
 * LSJI CLI - Command Line Interface
 * 
 * Provides train/play/status/start/stop commands for RL,
 * plus agent/budget/hitl/checkpoint commands for LLM agents.
 */

import { Agent } from './core/agent.js';
import { QLearning } from './core/qlearning.js';
import { createStorage } from './storage/index.js';
import { RockPaperScissorsEnv, TrainingPattern, getTrainingAction } from './envs/rps.js';
import { 
  createLLMAgent, 
  createBudgetController, 
  createApprovalGate,
  createExecutionEngine,
  createIdempotencyStore,
  startServer,
  stopServer,
  loadPlugins,
  globalPluginRegistry
} from './index.js';

// Hand names for display
const HAND_NAMES = ['Rock', 'Scissors', 'Paper'];

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = { _: [] };
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      options._.push(arg);
    }
  }
  
  return { command, options };
}

/**
 * Format output as JSON or table
 */
function output(data, json = false) {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (Array.isArray(data)) {
    console.table(data);
  } else {
    console.log(data);
  }
}

/**
 * Main CLI entry point
 */
export async function main() {
  const { command, options } = parseArgs();
  const jsonOutput = options.json === true || options.json === '';
  
  // Determine storage type
  const storageType = options.storage || process.env.LSJI_STORAGE || 'sqlite';
  const dbPath = options.dbPath || process.env.LSJI_DB_PATH || './lsji.db';
  
  let storage;
  try {
    storage = await createStorage(storageType, { path: dbPath });
  } catch (e) {
    console.error(`Failed to initialize storage (${storageType}):`, e.message);
    if (storageType !== 'memory') {
      console.error('Falling back to memory storage...');
      storage = await createStorage('memory');
    } else {
      process.exit(1);
    }
  }
  
  try {
    switch (command) {
      // ===== RL Commands (existing) =====
      case 'train': {
        const qlearning = new QLearning({
          alpha: parseFloat(options.alpha) || 0.1,
          gamma: parseFloat(options.gamma) || 0.9,
          epsilon: parseFloat(options.epsilon) || 0.1,
          storage
        });
        
        const opponent = options.opponent || 'random';
        const env = new RockPaperScissorsEnv({ opponent });
        const agent = new Agent({ qlearning, storage, env });
        
        const episodes = parseInt(options.episodes) || 200;
        const pattern = parseInt(options.pattern) || 0;
        const batchSize = parseInt(options.batchSize) || 200;
        
        let actionSelector = null;
        if (pattern > 0) {
          actionSelector = (episode, lastAction) => getTrainingAction(pattern, episode, lastAction);
        }
        
        console.log(`Training: ${episodes} episodes, pattern=${pattern}, opponent=${opponent}...`);
        const result = await agent.train({ episodes, actionSelector, batchSize });
        console.log('Training complete:', result);
        break;
      }
      
      case 'play': {
        const qlearning = new QLearning({
          alpha: parseFloat(options.alpha) || 0.1,
          gamma: parseFloat(options.gamma) || 0.9,
          epsilon: parseFloat(options.epsilon) || 0.1,
          storage
        });
        
        const opponent = options.opponent || 'random';
        const env = new RockPaperScissorsEnv({ opponent });
        const agent = new Agent({ qlearning, storage, env });
        
        const hand = parseInt(options.hand);
        if (isNaN(hand) || hand < 0 || hand > 2) {
          console.error('Error: --hand must be 0 (Rock), 1 (Scissors), or 2 (Paper)');
          process.exit(1);
        }
        
        const state = await env.getState() || '0';
        const actionSize = env.actionSize();
        const aiHand = await qlearning.act(state, actionSize);
        
        const { judge, reward, outcome } = RockPaperScissorsEnv.calculateOutcome(aiHand, hand);
        const result = await env.step(aiHand);
        await qlearning.learnSimple(state, aiHand, result.reward);
        
        await storage.addBattle({
          mode: 'test',
          handA: aiHand,
          handB: hand,
          reward: result.reward,
          createdAt: new Date().toISOString()
        });
        
        const playResult = {
          aiHand,
          userHand: hand,
          outcome,
          aiHandName: RockPaperScissorsEnv.getHandName(aiHand),
          userHandName: RockPaperScissorsEnv.getHandName(hand)
        };
        
        if (jsonOutput) {
          output(playResult, true);
        } else {
          console.log(`You: ${playResult.userHandName} | AI: ${playResult.aiHandName} => ${playResult.outcome}`);
        }
        break;
      }
      
      case 'status': {
        const qlearning = new QLearning({
          alpha: parseFloat(options.alpha) || 0.1,
          gamma: parseFloat(options.gamma) || 0.9,
          epsilon: parseFloat(options.epsilon) || 0.1,
          storage
        });
        
        const opponent = options.opponent || 'random';
        const env = new RockPaperScissorsEnv({ opponent });
        const agent = new Agent({ qlearning, storage, env });
        
        const result = await agent.status();
        output(result, jsonOutput);
        break;
      }
      
      case 'start': {
        const qlearning = new QLearning({ storage });
        const agent = new Agent({ qlearning, storage });
        const result = await agent.start();
        output(result, jsonOutput);
        break;
      }
      
      case 'stop': {
        const qlearning = new QLearning({ storage });
        const agent = new Agent({ qlearning, storage });
        const result = await agent.stop();
        output(result, jsonOutput);
        break;
      }
      
      // ===== LLM Agent Commands (NEW) =====
      case 'agent': {
        const subcommand = options._[0] || 'help';
        
        switch (subcommand) {
          case 'run': {
            const task = options.task || options._[1];
            if (!task) {
              console.error('Error: Task required. Use --task "your task here"');
              process.exit(1);
            }
            
            console.log(`Running agent on task: ${task}`);
            
            const agent = await createLLMAgent({
              llm: {
                provider: options.provider || 'openai',
                model: options.model || 'gpt-4o-mini',
                apiKey: options.apiKey || process.env.OPENAI_API_KEY,
              },
              budget: {
                maxCostPerRun: parseFloat(options.maxCost) || 10,
                maxTokensPerRun: parseInt(options.maxTokens) || 100000,
              },
              hitl: {
                enabled: options.hitl !== 'false',
                defaultTimeout: parseInt(options.hitlTimeout) || 300000,
              },
              memory: {
                conversation: options.conversation !== 'false',
                semantic: options.semantic === 'true',
                episodic: options.episodic !== 'false',
              },
            });
            
            const result = await agent.run(task, {
              runId: options.runId,
              budgetId: options.budgetId,
              hitlRequired: options.hitlRequired ? options.hitlRequired.split(',') : ['file_write', 'api_call', 'send_email', 'code_exec'],
              maxSteps: parseInt(options.maxSteps) || 50,
            });
            
            console.log('Agent run complete:', result);
            await agent.shutdown();
            break;
          }
          
          case 'run-durable': {
            const task = options.task || options._[1];
            if (!task) {
              console.error('Error: Task required. Use --task "your task here"');
              process.exit(1);
            }
            
            console.log(`Running durable agent on task: ${task}`);
            
            const agent = await createLLMAgent({
              llm: {
                provider: options.provider || 'openai',
                model: options.model || 'gpt-4o-mini',
                apiKey: options.apiKey || process.env.OPENAI_API_KEY,
              },
              execution: {
                checkpointInterval: parseInt(options.checkpointInterval) || 3,
              },
            });
            
            const result = await agent.runDurable(task, {
              workflowId: options.workflowId,
              checkpointEvery: parseInt(options.checkpointEvery) || 3,
              resumeFrom: options.resumeFrom,
            });
            
            console.log('Durable agent run complete:', result);
            await agent.shutdown();
            break;
          }
          
          case 'status': {
            const agent = await createLLMAgent({
              llm: { provider: 'openai', model: 'gpt-4o-mini' },
            });
            
            const status = agent.getStatus();
            output(status, jsonOutput);
            await agent.shutdown();
            break;
          }
          
          default:
            console.log(`
Agent Commands:
  agent run --task "task description"     Run agent on a task
  agent run-durable --task "task"         Run with checkpointing
  agent status                            Show agent status
            `);
        }
        break;
      }
      
      case 'budget': {
        const subcommand = options._[0] || 'status';
        const budget = createBudgetController({
          maxCostPerRun: parseFloat(options.maxCost) || 10,
          maxCostPerDay: parseFloat(options.maxDaily) || 50,
          maxCostPerMonth: parseFloat(options.maxMonthly) || 500,
        });
        
        switch (subcommand) {
          case 'status': {
            const budgetId = options.budgetId || 'default';
            const status = budget.getStatus(budgetId);
            output(status, jsonOutput);
            break;
          }
          
          case 'reset': {
            const budgetId = options.budgetId || 'default';
            budget.resetRunBudget(budgetId);
            console.log(`Budget ${budgetId} reset`);
            break;
          }
          
          case 'check': {
            const budgetId = options.budgetId || 'default';
            const estimatedCost = parseFloat(options.cost) || 0;
            const estimatedTokens = parseInt(options.tokens) || 0;
            const result = budget.checkBudget(budgetId, estimatedCost, estimatedTokens);
            output(result, jsonOutput);
            break;
          }
        }
        break;
      }
      
      case 'hitl': {
        const subcommand = options._[0] || 'help';
        
        switch (subcommand) {
          case 'approve': {
            const approvalId = options.id || options._[1];
            if (!approvalId) {
              console.error('Error: Approval ID required');
              process.exit(1);
            }
            
            const hitl = await createApprovalGate({});
            const result = await hitl.approve(approvalId, {
              decider: options.decider || 'cli-user',
              reason: options.reason || 'Approved via CLI',
            });
            
            console.log('Approved:', result);
            break;
          }
          
          case 'reject': {
            const approvalId = options.id || options._[1];
            if (!approvalId) {
              console.error('Error: Approval ID required');
              process.exit(1);
            }
            
            const hitl = await createApprovalGate({});
            const result = await hitl.reject(approvalId, {
              decider: options.decider || 'cli-user',
              reason: options.reason || 'Rejected via CLI',
            });
            
            console.log('Rejected:', result);
            break;
          }
          
          case 'list': {
            const hitl = await createApprovalGate({});
            const approvals = await hitl.getPendingApprovals(parseInt(options.limit) || 20);
            output(approvals, jsonOutput);
            break;
          }
          
          case 'status': {
            const approvalId = options.id || options._[1];
            if (!approvalId) {
              console.error('Error: Approval ID required');
              process.exit(1);
            }
            
            const hitl = await createApprovalGate({});
            const approval = await hitl.getApproval(approvalId);
            output(approval, jsonOutput);
            break;
          }
        }
        break;
      }
      
      case 'checkpoint': {
        const subcommand = options._[0] || 'help';
        
        switch (subcommand) {
          case 'list': {
            const engine = await createExecutionEngine({});
            const workflows = await engine.listWorkflows();
            output(workflows, jsonOutput);
            break;
          }
          
          case 'show': {
            const workflowId = options.workflowId || options._[1];
            if (!workflowId) {
              console.error('Error: Workflow ID required');
              process.exit(1);
            }
            
            const engine = await createExecutionEngine({});
            const checkpoints = await engine.getCheckpoints(workflowId);
            output(checkpoints, jsonOutput);
            break;
          }
          
          case 'recover': {
            const workflowId = options.workflowId || options._[1];
            if (!workflowId) {
              console.error('Error: Workflow ID required');
              process.exit(1);
            }
            
            const engine = await createExecutionEngine({});
            const recovery = await engine.recover(workflowId);
            output(recovery, jsonOutput);
            break;
          }
        }
        break;
      }
      
      case 'idempotency': {
        const subcommand = options._[0] || 'help';
        
        switch (subcommand) {
          case 'cleanup': {
            const store = await createIdempotencyStore({});
            await store.cleanup();
            console.log('Expired idempotency keys cleaned up');
            break;
          }
          
          case 'list': {
            const store = await createIdempotencyStore({});
            const operation = options.operation || options._[1];
            const keys = await store.getByOperation(operation, parseInt(options.limit) || 50);
            output(keys, jsonOutput);
            break;
          }
        }
        break;
      }
      
      case 'plugin': {
        const subcommand = options._[0] || 'list';
        
        switch (subcommand) {
          case 'list': {
            const plugins = globalPluginRegistry.listPlugins();
            output(plugins, jsonOutput);
            break;
          }
          
          case 'load': {
            const pluginPath = options.path || options._[1];
            if (!pluginPath) {
              console.error('Error: Plugin path required');
              process.exit(1);
            }
            const tools = await loadPlugins([pluginPath]);
            console.log('Loaded tools:', Object.keys(tools));
            break;
          }
          
          case 'create': {
            const name = options.name || options._[1];
            if (!name) {
              console.error('Error: Plugin name required');
              process.exit(1);
            }
            const template = (await import('./llm/plugins/index.js')).createPluginTemplate(name);
            console.log(template);
            break;
          }
        }
        break;
      }

      case 'serve': {
        const port = parseInt(options.port) || 3456;
        const dbPath = options.dbPath || process.env.LSJI_DB_PATH || './lsji.db';
        const noUi = options.noui === true || options.noui === '';
        
        console.log(`Starting LSJI server on port ${port}...`);
        if (noUi) {
          console.log('UI disabled (--no-ui flag)');
        }
        
        const config = {
          port,
          storage: { type: options.storage || 'sqlite', options: { path: dbPath } },
        };
        
        const server = await startServer(config);
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\nShutting down...');
          await stopServer(server);
          process.exit(0);
        });
        
        // Keep process alive
        await new Promise(() => {});
        break;
      }

      case 'help':
      case '--help':
      case '-h':
      default: {
        console.log(`
LSJI CLI - Reinforcement Learning & LLM Agent Framework

Usage: lsji <command> [options]

=== RL Commands ===
  train       Train the RL agent
  play        Play against the RL agent
  status      Show RL system status
  start       Enable RL training/play
  stop        Disable RL training/play

=== Server Commands ===
  serve [--port] [--no-ui]           Start runtime server with control panel

=== Plugin Commands ===
  plugin list                        List loaded plugins
  plugin load --path <path>          Load plugin from directory
  plugin create --name <name>        Generate plugin template

=== LLM Agent Commands ===
  agent run --task "task"              Run LLM agent on task
  agent run-durable --task "task"      Run with checkpointing
  agent status                         Show agent status

  budget status [--budgetId]           Show budget status
  budget check --cost --tokens         Check if operation allowed
  budget reset [--budgetId]            Reset run budget

  hitl approve --id <id>               Approve pending request
  hitl reject --id <id>                Reject pending request
  hitl list [--limit]                  List pending approvals
  hitl status --id <id>                Show approval status

  checkpoint list                      List workflows with checkpoints
  checkpoint show --workflowId <id>    Show checkpoints for workflow
  checkpoint recover --workflowId <id> Recover from latest checkpoint

  idempotency cleanup                  Clean expired keys
  idempotency list --operation <op>    List keys for operation

=== Common Options ===
  --storage <type>        Storage: sqlite, better-sqlite, memory (default: sqlite)
  --db-path <path>        Database path (default: ./lsji.db)
  --json                  Output as JSON

=== Server Options ===
  --port <num>            Server port (default: 3456)
  --no-ui                 Disable web UI

=== Plugin Options ===
  --name <name>           Plugin name (for create)
  --path <path>           Plugin directory path (for load)

=== RL Options ===
  --alpha <num>           Learning rate (default: 0.1)
  --gamma <num>           Discount factor (default: 0.9)
  --epsilon <num>         Exploration rate (default: 0.1)
  --opponent <type>       Opponent: random, always_rock, counter, sequential
  --episodes <num>        Training episodes (default: 200)
  --pattern <num>         Training pattern 0-3 (default: 0)
  --hand <num>            Your hand: 0=Rock, 1=Scissors, 2=Paper

=== LLM Agent Options ===
  --provider <name>       LLM provider: openai, anthropic, gemini, local (default: openai)
  --model <name>          Model name (default: gpt-4o-mini, gemini: gemini-1.5-flash)
  --api-key <key>         API key (or use OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY env)
  --max-cost <num>        Max cost per run USD (default: 10)
  --max-tokens <num>      Max tokens per run (default: 100000)
  --hitl <true|false>     Enable HITL (default: true)
  --hitl-timeout <ms>     Approval timeout (default: 300000)
  --conversation <tf>     Enable conversation memory (default: true)
  --semantic <tf>         Enable semantic memory (default: false)
  --episodic <tf>         Enable episodic memory (default: true)
  --hitl-required <list>  Comma-separated tools requiring approval
  --max-steps <num>       Max agent steps (default: 50)
  --checkpoint-interval   Checkpoint every N steps (default: 3)
  --workflow-id <id>      Workflow ID for durable runs
  --resume-from <id>      Resume from checkpoint ID

=== Budget Options ===
  --budget-id <id>        Budget identifier
  --max-daily <num>       Max daily cost (default: 50)
  --max-monthly <num>     Max monthly cost (default: 500)

Examples:
  # RL Training
  lsji train --episodes 500
  lsji play --hand 0
  lsji status --json

  # LLM Agent
  lsji agent run --task "Search for latest AI news and summarize"
  lsji agent run-durable --task "Analyze codebase and create report" --workflow-id my-analysis
  lsji budget status --budgetId project-1
  lsji hitl list
  lsji checkpoint show --workflowId my-analysis
        `);
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await storage.close();
  }
}

// Auto-run main if this file is executed directly
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch(console.error);
}

