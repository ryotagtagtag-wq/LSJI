---
title: QLearning API
description: Tabular Q-Learning engine with TD updates
---

# QLearning API

The `QLearning` class implements tabular Q-Learning with epsilon-greedy exploration.

## Import

```typescript
import { QLearning } from 'lsji';
```

## Constructor

```typescript
const qlearning = new QLearning({
  alpha: 0.1,     // Learning rate [0, 1] (default: 0.1)
  gamma: 0.9,     // Discount factor [0, 1] (default: 0.9)
  epsilon: 0.1,   // Exploration rate [0, 1] (default: 0.1)
  storage: Storage // Required: Storage backend
});
```

Values are automatically clamped to [0, 1] range.

## Methods

### `initialize()`
Load Q-table from storage. Called automatically by other methods.

```typescript
await qlearning.initialize();
```

### `getQValue(state, action)`
Get Q-value for a state-action pair.

```typescript
const value = qlearning.getQValue('state1', 0);
// Returns: number (0 if unseen)
```

### `setQValue(state, action, value)`
Set Q-value and persist to storage.

```typescript
await qlearning.setQValue('state1', 0, 0.5);
```

### `act(state, actionSize)`
Select action using epsilon-greedy policy.

```typescript
const action = await qlearning.act('state1', 3);
// Returns: number (0 to actionSize-1)
```

**Behavior:**
- With probability `epsilon`: random action
- With probability `1-epsilon`: best known action (ties broken randomly)

### `learn(state, action, reward, nextState, nextActionSize)`
Full TD update: Q(s,a) ← Q(s,a) + α[r + γ·maxₐ' Q(s',a') - Q(s,a)]

```typescript
const newQ = await qlearning.learn('state1', 0, 1, 'state2', 3);
// Returns: updated Q-value
```

### `learnSimple(state, action, reward)`
Simplified update for terminal states: Q(s,a) ← Q(s,a) + α[r - Q(s,a)]

```typescript
const newQ = await qlearning.learnSimple('state1', 0, 1);
// Returns: updated Q-value
```

### `reset()`
Clear in-memory Q-table cache.

```typescript
await qlearning.reset();
// Note: Does not clear storage
```

### `getStateValues(state, actionSize)`
Get all Q-values for a state.

```typescript
const values = qlearning.getStateValues('state1', 3);
// Returns: { 0: 0.5, 1: 0.2, 2: -0.1 }
```

### `getFullQTable()`
Get entire Q-table for inspection.

```typescript
const table = await qlearning.getFullQTable();
// Returns:
[
  { state: 'state1', action: 0, q_value: 0.5 },
  { state: 'state1', action: 1, q_value: 0.2 },
  ...
]
```

## Hyperparameters

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `alpha` | 0.1 | [0, 1] | Learning rate — how much new info overrides old |
| `gamma` | 0.9 | [0, 1] | Discount factor — future reward importance |
| `epsilon` | 0.1 | [0, 1] | Exploration rate — random action probability |

## Example

```typescript
import { QLearning, createStorage } from 'lsji';

const storage = await createStorage('memory');
const ql = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });

await ql.initialize();

// Train on simple state-action pairs
await ql.learnSimple('state1', 0, 1);  // Win
await ql.learnSimple('state1', 0, 1);  // Win again
await ql.learnSimple('state1', 1, -1); // Lose

// Check learned values
console.log(ql.getQValue('state1', 0)); // ~0.19
console.log(ql.getQValue('state1', 1)); // ~-0.1

await storage.close();
```
