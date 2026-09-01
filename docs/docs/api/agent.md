---
title: Agent API
description: High-level agent orchestration
---

# Agent API

The `Agent` class provides high-level orchestration of Q-Learning, Storage, and Environment.

## Import

```typescript
import { Agent } from 'lsji';
```

## Constructor

```typescript
const agent = new Agent({
  qlearning: QLearning,    // Required: Q-Learning engine
  storage: Storage,        // Required: Storage backend
  env: Env                 // Optional: Environment for train/play
});
```

## Methods

### `start()`
Enable the system for training and play.

```typescript
await agent.start();
// Returns: { status: 'success', message: 'System STARTED' }
```

### `stop()`
Disable the system (pauses training and play).

```typescript
await agent.stop();
// Returns: { status: 'success', message: 'System STOPPED' }
```

### `status()`
Get current system status and statistics.

```typescript
const status = await agent.status();
// Returns:
{
  status: 'running' | 'stopped',
  todayTotal: number,      // Battles today
  limit: 90000,            // Daily limit
  performance: [           // Per-mode statistics
    { mode: 'train', total: 100, win_rate: 65.5 },
    { mode: 'test', total: 50, win_rate: 72.0 }
  ],
  aiBrain: [               // Full Q-table
    { state: '0', action: 0, q_value: 0.45 },
    { state: '0', action: 1, q_value: 0.12 },
    ...
  ]
}
```

### `train(options)`
Train the agent.

```typescript
const result = await agent.train({
  episodes: 200,           // Number of episodes (default: 200)
  actionSelector: (episode, lastAction) => number,  // Custom pattern (optional)
  batchSize: 200           // DB batch size (default: 200)
});

// Returns:
{
  episodes: 200,
  wins: 85,
  losses: 62,
  draws: 53
}
```

**Built-in Training Patterns:**
```typescript
import { TrainingPattern, getTrainingAction } from 'lsji';

// Pattern 0: Random (default)
await agent.train({ episodes: 500 });

// Pattern 1: Always Rock
await agent.train({ 
  episodes: 500, 
  actionSelector: (ep, last) => getTrainingAction(TrainingPattern.ALWAYS_ROCK, ep, last) 
});

// Pattern 2: Counter
await agent.train({ 
  episodes: 500, 
  actionSelector: (ep, last) => getTrainingAction(TrainingPattern.COUNTER, ep, last) 
});

// Pattern 3: Sequential
await agent.train({ 
  episodes: 500, 
  actionSelector: (ep, last) => getTrainingAction(TrainingPattern.SEQUENTIAL, ep, last) 
});
```

### `play(options)`
Play a single step against the agent.

```typescript
const result = await agent.play({
  userAction: 0  // Optional: user action for envs that need it
});

// Returns:
{
  action: 1,              // Agent's chosen action
  reward: 1,              // Reward received
  done: false,            // Episode ended
  info: { opponentAction: 0 }  // Environment-specific info
}
```

### `setEnvironment(env)`
Inject or change the environment at runtime.

```typescript
agent.setEnvironment(new MyCustomEnv());
```

## Example

```typescript
import { Agent, QLearning, createStorage, RockPaperScissorsEnv } from 'lsji';

const storage = await createStorage('sqlite', { path: './agent.db' });
const qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });
const env = new RockPaperScissorsEnv({ opponent: 'random' });

const agent = new Agent({ qlearning, storage, env });

await agent.train({ episodes: 1000 });
const result = await agent.play(0); // Play Rock
console.log(`AI played: ${result.action}, Result: ${result.reward > 0 ? 'WIN' : result.reward < 0 ? 'LOSE' : 'DRAW'}`);

await storage.close();
```
