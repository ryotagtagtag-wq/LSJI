---
title: Env Interface
description: Base environment interface for RL problems
---

# Env Interface

All reinforcement learning environments must extend the abstract `Env` class.

## Import

```typescript
import { Env } from 'lsji';
```

## Abstract Methods

### `getState()`
Return current state as a string key.

```typescript
getState(): string;
```

### `step(action)`
Execute an action and return the result.

```typescript
async step(action: number): Promise<StepResult>;
```

**StepResult:**
```typescript
interface StepResult {
  state: string;      // New state
  reward: number;     // Reward for this step
  done: boolean;      // Episode ended
  info?: object;      // Additional info
}
```

### `actionSize()`
Return number of possible actions.

```typescript
actionSize(): number;
```

### `reset()`
Reset environment to initial state.

```typescript
async reset(): Promise<string>;  // Returns initial state
```

## Optional Methods

### `render()`
Human-readable representation for debugging.

```typescript
render(): string;
```

## StateEncoder Utility

Helper for encoding/decoding complex states:

```typescript
import { StateEncoder } from 'lsji';

// Encode object to string
const key = StateEncoder.encode({ position: 5, inventory: ['sword'] });
// Returns: '{"position":5,"inventory":["sword"]}'

// Decode string to object
const state = StateEncoder.decode(key);
// Returns: { position: 5, inventory: ['sword'] }
```

## Creating a Custom Environment

```typescript
import { Env } from 'lsji';

class GridWorldEnv extends Env {
  constructor() {
    super();
    this.position = 0;
    this.gridSize = 10;
  }

  getState() {
    return String(this.position);
  }

  async step(action) {
    // Actions: 0=left, 1=right
    if (action === 0) this.position = Math.max(0, this.position - 1);
    if (action === 1) this.position = Math.min(this.gridSize - 1, this.position + 1);

    const done = this.position === this.gridSize - 1;
    const reward = done ? 1 : -0.01;

    return {
      state: String(this.position),
      reward,
      done,
      info: { position: this.position }
    };
  }

  actionSize() {
    return 2;
  }

  async reset() {
    this.position = 0;
    return '0';
  }

  render() {
    return `GridWorld: position ${this.position}/${this.gridSize - 1}`;
  }
}
```

## Best Practices

1. **State as string** — Use simple string keys for Q-table indexing
2. **Deterministic rewards** — Same state-action should give consistent rewards
3. **Action space** — Keep action space small for tabular Q-learning
4. **Reset** — Always implement proper reset for episode boundaries
