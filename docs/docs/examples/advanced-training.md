---
title: Advanced Training
description: Custom training patterns and techniques
---

# Advanced Training

Learn advanced training techniques for better agent performance.

## Custom Action Selectors

The `train()` method accepts an `actionSelector` function for custom training patterns.

```typescript
const result = await agent.train({
  episodes: 1000,
  actionSelector: (episode, lastAction) => {
    // Your custom logic here
    return action;
  }
});
```

### Epsilon-Greedy with Decay

```typescript
let epsilon = 1.0;
const minEpsilon = 0.01;
const decayRate = 0.9995;

const result = await agent.train({
  episodes: 10000,
  actionSelector: (episode, lastAction) => {
    epsilon = Math.max(minEpsilon, epsilon * decayRate);
    
    if (Math.random() < epsilon) {
      return Math.floor(Math.random() * 3); // Explore
    }
    
    // Exploit: use agent's Q-learning
    const state = await agent.env.getState();
    return agent.qlearning.act(state, 3);
  }
});
```

### Curriculum Learning

Start with easy opponents, progress to harder ones.

```typescript
const opponents = ['always_rock', 'sequential', 'counter', 'random'];
const episodesPerStage = 250;

for (const opponent of opponents) {
  const env = new RockPaperScissorsEnv({ opponent });
  agent.setEnvironment(env);
  
  console.log(`Training against ${opponent}...`);
  await agent.train({ episodes: episodesPerStage });
  
  const status = await agent.status();
  console.log(`Win rate: ${status.performance.find(p => p.mode === 'train')?.win_rate}%`);
}
```

### Self-Play Training

Train agent against itself.

```typescript
// Create two agents sharing the same Q-table
const storage = await createStorage('sqlite', { path: './selfplay.db' });
const qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });

const env1 = new RockPaperScissorsEnv({ opponent: 'random' });
const env2 = new RockPaperScissorsEnv({ opponent: 'random' });

const agent1 = new Agent({ qlearning, storage, env: env1 });
const agent2 = new Agent({ qlearning, storage, env: env2 });

// Alternate training
for (let i = 0; i < 100; i++) {
  await agent1.train({ episodes: 50 });
  await agent2.train({ episodes: 50 });
  
  if (i % 10 === 0) {
    const status = await agent1.status();
    console.log(`Iteration ${i}: ${status.performance[0].win_rate}% win rate`);
  }
}
```

## Hyperparameter Tuning

### Grid Search

```typescript
const configs = [
  { alpha: 0.05, gamma: 0.9, epsilon: 0.1 },
  { alpha: 0.1, gamma: 0.9, epsilon: 0.1 },
  { alpha: 0.2, gamma: 0.9, epsilon: 0.1 },
  { alpha: 0.1, gamma: 0.95, epsilon: 0.1 },
  { alpha: 0.1, gamma: 0.9, epsilon: 0.2 },
];

for (const config of configs) {
  const storage = await createStorage('memory');
  const qlearning = new QLearning({ ...config, storage });
  const env = new RockPaperScissorsEnv({ opponent: 'random' });
  const agent = new Agent({ qlearning, storage, env });
  
  await agent.train({ episodes: 2000 });
  const status = await agent.status();
  const winRate = status.performance.find(p => p.mode === 'train')?.win_rate || 0;
  
  console.log(`${JSON.stringify(config)} => ${winRate}%`);
  await storage.close();
}
```

### Bayesian Optimization

Use libraries like `bayes-opt` for efficient hyperparameter search.

## Evaluation Techniques

### Fixed Opponent Evaluation

```typescript
async function evaluate(agent, opponent, games = 100) {
  const env = new RockPaperScissorsEnv({ opponent });
  agent.setEnvironment(env);
  
  let wins = 0, losses = 0, draws = 0;
  
  for (let i = 0; i < games; i++) {
    const result = await agent.play(Math.floor(Math.random() * 3));
    if (result.reward > 0) wins++;
    else if (result.reward < 0) losses++;
    else draws++;
  }
  
  return { wins, losses, draws, winRate: wins / games };
}

const agents = {
  random: await evaluate(agent, 'random'),
  alwaysRock: await evaluate(agent, 'always_rock'),
  counter: await evaluate(agent, 'counter'),
  sequential: await evaluate(agent, 'sequential'),
};

console.table(agents);
```

### Cross-Validation

```typescript
async function crossValidate(config, folds = 5, episodesPerFold = 1000) {
  const results = [];
  
  for (let fold = 0; fold < folds; fold++) {
    const storage = await createStorage('memory');
    const qlearning = new QLearning({ ...config, storage });
    const env = new RockPaperScissorsEnv({ opponent: 'random' });
    const agent = new Agent({ qlearning, storage, env });
    
    await agent.train({ episodes: episodesPerFold });
    const evalResult = await evaluate(agent, 'random', 200);
    results.push(evalResult.winRate);
    
    await storage.close();
  }
  
  const mean = results.reduce((a, b) => a + b, 0) / results.length;
  const std = Math.sqrt(results.reduce((a, b) => a + (b - mean) ** 2, 0) / results.length);
  
  return { mean, std, results };
}
```

## Checkpointing and Resuming

```typescript
// Save Q-table periodically
async function trainWithCheckpoints(agent, episodes, checkpointEvery = 100) {
  for (let i = 0; i < episodes; i += checkpointEvery) {
    const batch = Math.min(checkpointEvery, episodes - i);
    await agent.train({ episodes: batch });
    
    // Q-table automatically persisted to storage
    const status = await agent.status();
    console.log(`Checkpoint ${i + batch}: ${status.aiBrain.length} Q-values`);
  }
}

// Resume from existing Q-table
const storage = await createStorage('sqlite', { path: './existing.db' });
const qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });
// Q-table loads automatically on first use
```

## Distributed Training

Run multiple training processes with shared storage.

```bash
# Terminal 1
lsji train --episodes 500 --db-path ./shared.db --storage sqlite

# Terminal 2 (same database)
lsji train --episodes 500 --db-path ./shared.db --storage sqlite

# Terminal 3
lsji train --episodes 500 --db-path ./shared.db --storage sqlite
```

All processes read/write to the same SQLite database, enabling parallel training.

## Monitoring Training Progress

```typescript
async function trainWithLogging(agent, episodes) {
  const history = [];
  
  for (let i = 0; i < episodes; i += 100) {
    await agent.train({ episodes: 100 });
    
    const status = await agent.status();
    const trainStat = status.performance.find(p => p.mode === 'train');
    
    history.push({
      episode: i + 100,
      winRate: trainStat?.win_rate || 0,
      qTableSize: status.aiBrain.length
    });
    
    console.log(`Episode ${i + 100}: ${history[history.length - 1].winRate}% win rate`);
  }
  
  return history;
}
```
