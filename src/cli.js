/**
 * LSJI CLI - Command Line Interface
 * 
 * Provides train/play/status/start/stop commands.
 * Migrated from the original Cloudflare Workers HTTP endpoints.
 */

import { Agent } from './core/agent.js';
import { QLearning } from './core/qlearning.js';
import { createStorage } from './storage/index.js';
import { Env } from './core/env.js';

// Hand names for display
const HAND_NAMES = ['Rock', 'Scissors', 'Paper'];

/**
 * Simple test environment for CLI (Rock-Paper-Scissors)
 * Uses a simple random opponent for demonstration
 */
class SimpleRPSEnv extends Env {
  constructor() {
    super();
    this.lastTestHand = 0;
  }

  getState() {
    return String(this.lastTestHand);
  }

  async step(action) {
    // Random opponent action
    const userAction = Math.floor(Math.random() * 3);
    
    // Calculate reward (from agent's perspective)
    const judge = (action - userAction + 3) % 3;
    const reward = judge === 2 ? 1 : judge === 1 ? -1 : 0;
    
    // Store for next state
    this.lastTestHand = userAction;
    
    return {
      state: String(userAction),
      reward,
      done: false,
      info: { userAction }
    };
  }

  actionSize() {
    return 3;
  }

  async reset() {
    this.lastTestHand = 0;
    return '0';
  }
}

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {};
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    }
  }
  
  return { command, options };
}

/**
 * Format output as JSON or table
 * @param {Object} data - Data to output
 * @param {boolean} json - Whether to output JSON
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
  
  // Create Q-learning engine
  const qlearning = new QLearning({
    alpha: parseFloat(options.alpha) || 0.1,
    gamma: parseFloat(options.gamma) || 0.9,
    epsilon: parseFloat(options.epsilon) || 0.1,
    storage
  });
  
  // Create environment (simple RPS for now)
  const env = new SimpleRPSEnv();
  
  // Create agent
  const agent = new Agent({ qlearning, storage, env });
  
  try {
    switch (command) {
      case 'train': {
        const episodes = parseInt(options.episodes) || 200;
        const pattern = parseInt(options.pattern) || 0;
        const batchSize = parseInt(options.batchSize) || 200;
        
        console.log(`Training: ${episodes} episodes, pattern=${pattern}...`);
        const result = await agent.train({ episodes, pattern, batchSize });
        console.log('Training complete:', result);
        break;
      }
      
      case 'play': {
        const hand = parseInt(options.hand);
        if (isNaN(hand) || hand < 0 || hand > 2) {
          console.error('Error: --hand must be 0 (Rock), 1 (Scissors), or 2 (Paper)');
          process.exit(1);
        }
        
        const result = await agent.play(hand);
        if (jsonOutput) {
          output(result, true);
        } else {
          console.log(`You: ${result.userHandName} | AI: ${result.aiHandName} => ${result.outcome}`);
        }
        break;
      }
      
      case 'status': {
        const result = await agent.status();
        output(result, jsonOutput);
        break;
      }
      
      case 'start': {
        const result = await agent.start();
        output(result, jsonOutput);
        break;
      }
      
      case 'stop': {
        const result = await agent.stop();
        output(result, jsonOutput);
        break;
      }
      
      case 'help':
      case '--help':
      case '-h':
      default: {
        console.log(`
LSJI CLI - Reinforcement Learning Agent Framework

Usage: lsji <command> [options]

Commands:
  train     Train the agent
  play      Play against the agent
  status    Show system status and statistics
  start     Enable training/play
  stop      Disable training/play
  help      Show this help

Options:
  --storage <type>     Storage backend: sqlite, better-sqlite, memory (default: sqlite)
  --db-path <path>     Database file path (default: ./lsji.db)
  --alpha <number>     Learning rate (default: 0.1)
  --gamma <number>     Discount factor (default: 0.9)
  --epsilon <number>   Exploration rate (default: 0.1)
  --json               Output as JSON

Train options:
  --episodes <number>  Number of episodes (default: 200)
  --pattern <number>   Training pattern 0-3 (default: 0)
  --batch-size <number> Batch size for DB (default: 200)

Play options:
  --hand <number>      Your hand: 0=Rock, 1=Scissors, 2=Paper

Examples:
  lsji train --episodes 500
  lsji play --hand 0
  lsji status --json
  lsji start
  lsji stop
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
