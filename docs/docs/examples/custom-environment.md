---
title: Custom Environment
description: Build your own RL environment
---

# Custom Environment Example

This guide shows how to create a custom environment by extending the `Env` base class.

## Grid World Environment

A simple 1D grid where the agent learns to move right to reach the goal.

```typescript
import { Env } from 'lsji';

class GridWorldEnv extends Env {
  constructor(gridSize = 10) {
    super();
    this.gridSize = gridSize;
    this.position = 0;
  }

  getState(): string {
    return String(this.position);
  }

  async step(action: number): Promise<StepResult> {
    // Actions: 0 = left, 1 = right
    if (action === 0) {
      this.position = Math.max(0, this.position - 1);
    } else if (action === 1) {
      this.position = Math.min(this.gridSize - 1, this.position + 1);
    }

    const done = this.position === this.gridSize - 1;
    const reward = done ? 1 : -0.01; // Small penalty for each step

    return {
      state: String(this.position),
      reward,
      done,
      info: { position: this.position }
    };
  }

  actionSize(): number {
    return 2; // Left, Right
  }

  async reset(): Promise<string> {
    this.position = 0;
    return '0';
  }

  render(): string {
    const bar = ' '.repeat(this.gridSize);
    const chars = bar.split('');
    chars[this.position] = 'A';
    chars[this.gridSize - 1] = 'G';
    return `[${chars.join('')}]`;
  }
}
```

## Using the Custom Environment

```typescript
import { Agent, QLearning, createStorage } from 'lsji';
import { GridWorldEnv } from './grid-world';

async function main() {
  const storage = await createStorage('sqlite', { path: './gridworld.db' });
  
  const qlearning = new QLearning({
    alpha: 0.1,
    gamma: 0.9,
    epsilon: 0.1,
    storage
  });

  const env = new GridWorldEnv(10);
  const agent = new Agent({ qlearning, storage, env });

  console.log('Training...');
  await agent.train({ episodes: 5000 });

  console.log('Testing...');
  await agent.play(); // Single step
  
  const status = await agent.status();
  console.log('Q-table:', status.aiBrain);

  await storage.close();
}

main().catch(console.error);
```

## Multi-State Environment

For environments with multiple state variables, use `StateEncoder`:

```typescript
import { Env, StateEncoder } from 'lsji';

interface GameState {
  playerHP: number;
  enemyHP: number;
  hasPotion: boolean;
}

class BattleEnv extends Env {
  state: GameState = { playerHP: 100, enemyHP: 50, hasPotion: true };

  getState(): string {
    return StateEncoder.encode(this.state);
  }

  async step(action: number): Promise<StepResult> {
    // 0 = attack, 1 = heal, 2 = defend
    let reward = 0;
    let done = false;

    if (action === 0) { // Attack
      this.state.enemyHP -= 10;
      reward = this.state.enemyHP <= 0 ? 10 : -1;
      done = this.state.enemyHP <= 0;
    } else if (action === 1) { // Heal
      if (this.state.hasPotion) {
        this.state.playerHP = Math.min(100, this.state.playerHP + 30);
        this.state.hasPotion = false;
        reward = -1;
      } else {
        reward = -5; // No potion penalty
      }
    } else if (action === 2) { // Defend
      reward = -0.5;
    }

    // Enemy counter-attack
    if (!done) {
      this.state.playerHP -= 5;
      if (this.state.playerHP <= 0) {
        reward = -10;
        done = true;
      }
    }

    return {
      state: StateEncoder.encode(this.state),
      reward,
      done,
      info: { ...this.state }
    };
  }

  actionSize(): number {
    return 3;
  }

  async reset(): Promise<string> {
    this.state = { playerHP: 100, enemyHP: 50, hasPotion: true };
    return StateEncoder.encode(this.state);
  }
}
```

## Key Points

1. **State as string** — Use `StateEncoder.encode()` for complex states
2. **Reward design** — Shape rewards to guide learning (dense vs sparse)
3. **Action space** — Keep small for tabular Q-learning
4. **Episode termination** — Always implement `done` condition
5. **Reset** — Must restore initial state completely

## Testing Your Environment

```typescript
async function testEnv() {
  const env = new GridWorldEnv(5);
  
  console.log('Initial:', env.getState());
  console.log(env.render());
  
  for (let i = 0; i < 10; i++) {
    const result = await env.step(1); // Always move right
    console.log(`Step ${i}: state=${result.state}, reward=${result.reward}, done=${result.done}`);
    console.log(env.render());
    if (result.done) break;
  }
  
  await env.reset();
  console.log('After reset:', env.getState());
}

testEnv();
```
