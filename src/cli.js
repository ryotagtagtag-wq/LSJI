/**
 * LSJI CLI - Command Line Interface
 * 
 * Provides train/play/status/start/stop commands.
 * Migrated from the original Cloudflare Workers HTTP endpoints.
 */

import { Agent } from './core/agent.js';
import { QLearning } from './core/qlearning.js';
import { createStorage } from './storage/index.js';
import { RockPaperScissorsEnv, TrainingPattern, getTrainingAction } from './envs/rps.js';

// Hand names for display
const HAND_NAMES = ['Rock', 'Scissors', 'Paper'];

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
  
  // Create environment (Rock-Paper-Scissors)
  const opponent = options.opponent || 'random';
  const env = new RockPaperScissorsEnv({ opponent });
  
  // Create agent
  const agent = new Agent({ qlearning, storage, env });
  
  try {
    switch (command) {
      case 'train': {
        const episodes = parseInt(options.episodes) || 200;
        const pattern = parseInt(options.pattern) || 0;
        const batchSize = parseInt(options.batchSize) || 200;
        
        // Create action selector based on pattern
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
        const hand = parseInt(options.hand);
        if (isNaN(hand) || hand < 0 || hand > 2) {
          console.error('Error: --hand must be 0 (Rock), 1 (Scissors), or 2 (Paper)');
          process.exit(1);
        }
        
        // For play, we need to pass the user's hand to the environment
        // The RPS env uses its own opponent strategy, so we'll use a custom approach
        const state = await env.getState() || '0';
        const actionSize = env.actionSize();
        const aiHand = await qlearning.act(state, actionSize);
        
        // Calculate outcome manually for display
        const { judge, reward, outcome } = RockPaperScissorsEnv.calculateOutcome(aiHand, hand);
        
        // Step the environment with AI's action (to update state and Q-table)
        const result = await env.step(aiHand);
        
        // Update Q-table with actual result
        await qlearning.learnSimple(state, aiHand, result.reward);
        
        // Record battle
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
  --opponent <type>    Opponent strategy: random, always_rock, counter, sequential (default: random)
  --json               Output as JSON

Train options:
  --episodes <number>  Number of episodes (default: 200)
  --pattern <number>   Training pattern 0-3 (default: 0)
                       0=random, 1=always_rock, 2=counter, 3=sequential
  --batch-size <number> Batch size for DB (default: 200)

Play options:
  --hand <number>      Your hand: 0=Rock, 1=Scissors, 2=Paper

Examples:
  lsji train --episodes 500
  lsji train --episodes 100 --pattern 1 --opponent always_rock
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
