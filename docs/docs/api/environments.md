---
title: Built-in Environments
description: Pre-built environments for quick start
---

# Built-in Environments

LSJI includes a Rock-Paper-Scissors environment for demonstration and testing.

## Import

```typescript
import { 
  RockPaperScissorsEnv, 
  TrainingPattern, 
  getTrainingAction 
} from 'lsji';
```

## RockPaperScissorsEnv

Classic Rock-Paper-Scissors game environment.

### Constructor

```typescript
const env = new RockPaperScissorsEnv({
  opponent: 'random'  // 'random' | 'always_rock' | 'counter' | 'sequential'
});
```

### Opponent Strategies

| Strategy | Description |
|----------|-------------|
| `'random'` | Uniform random actions (default) |
| `'always_rock'` | Always plays Rock (0) |
| `'counter'` | Plays counter to agent's previous action |
| `'sequential'` | Cycles through Rock→Scissors→Paper |

### Methods

All standard `Env` methods plus:

```typescript
// Static helpers
RockPaperScissorsEnv.getHandName(0);     // 'Rock'
RockPaperScissorsEnv.getHandName(1);     // 'Scissors'
RockPaperScissorsEnv.getHandName(2);     // 'Paper'

const { judge, reward, outcome } = RockPaperScissorsEnv.calculateOutcome(0, 2);
// judge: 2, reward: 1, outcome: 'WIN'
```

### Training Patterns

```typescript
import { TrainingPattern, getTrainingAction } from 'lsji';

// Pattern IDs
TrainingPattern.RANDOM;        // 0
TrainingPattern.ALWAYS_ROCK;   // 1
TrainingPattern.COUNTER;       // 2
TrainingPattern.SEQUENTIAL;    // 3

// Get action for pattern
const action = getTrainingAction(TrainingPattern.COUNTER, episode, lastAction);
```

### Example

```typescript
import { 
  Agent, QLearning, createStorage, 
  RockPaperScissorsEnv, TrainingPattern, getTrainingAction 
} from 'lsji';

const storage = await createStorage('sqlite', { path: './rps.db' });
const qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });

// Train against counter opponent
const env = new RockPaperScissorsEnv({ opponent: 'counter' });
const agent = new Agent({ qlearning, storage, env });

await agent.train({ 
  episodes: 1000,
  actionSelector: (ep, last) => getTrainingAction(TrainingPattern.RANDOM, ep, last)
});

// Play against random opponent
const playEnv = new RockPaperScissorsEnv({ opponent: 'random' });
agent.setEnvironment(playEnv);

const result = await agent.play(0); // You play Rock
console.log(`AI: ${RockPaperScissorsEnv.getHandName(result.action)} | ${result.reward > 0 ? 'WIN' : 'LOSE'}`);

await storage.close();
```

## Creating Custom Environments

See [Custom Environment Example](/docs/examples/custom-environment) for a complete guide.
