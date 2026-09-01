---
title: Storage API
description: Pluggable storage backends
---

# Storage API

LSJI provides a pluggable storage abstraction with three built-in implementations.

## Import

```typescript
import { createStorage, Storage, SqliteStorage, BetterSqliteStorage, MemoryStorage } from 'lsji';
```

## Factory Function

```typescript
const storage = await createStorage(type, options);
```

**Types:**
- `'sqlite'` — Node.js built-in `node:sqlite` (recommended)
- `'better-sqlite'` — `better-sqlite3` package
- `'memory'` — In-memory (testing only)

**Options:**
```typescript
// SQLite
{ path: './my-agent.db' }

// Better-SQLite
{ path: './my-agent.db' }

// Memory
{}  // No options needed
```

## Storage Interface

All backends implement this interface:

```typescript
interface Storage {
  initialize(): Promise<void>;
  close(): Promise<void>;
  getSetting(key: string): Promise<{key: string, value: string} | null>;
  setSetting(key: string, value: string | number): Promise<void>;
  getQTable(): Promise<Array<{state: string, action: number, q_value: number}>>;
  updateQ(state: string, action: number, qValue: number): Promise<void>;
  addBattle(record: BattleRecord): Promise<void>;
  getTodayBattleCount(): Promise<number>;
  getPerformanceStats(): Promise<Array<{mode: string, total: number, win_rate: number}>>;
}

interface BattleRecord {
  mode: 'train' | 'test';
  handA: number;
  handB: number;
  reward: number;
  createdAt: string;  // ISO timestamp
}
```

## Backends

### SqliteStorage (Recommended)

Uses Node.js 22+ built-in `node:sqlite` — **zero dependencies**.

```typescript
import { SqliteStorage } from 'lsji';

const storage = new SqliteStorage('./agent.db');
await storage.initialize();
// ... use storage
await storage.close();
```

**Features:**
- Synchronous API (fast)
- Automatic schema creation
- Indexes on battle_history for performance
- Persistent across process restarts

### BetterSqliteStorage

Uses `better-sqlite3` for high-performance synchronous access.

```typescript
import { BetterSqliteStorage } from 'lsji';

const storage = new BetterSqliteStorage('./agent.db');
await storage.initialize();
```

**Requires:** `npm install better-sqlite3`

**Use when:** You need faster writes or advanced SQLite features.

### MemoryStorage

Pure in-memory implementation.

```typescript
import { MemoryStorage } from 'lsji';

const storage = new MemoryStorage();
await storage.initialize();
```

**Features:**
- No persistence (data lost on exit)
- Fastest for testing/CI
- Implements `clear()` for test isolation

## Database Schema

All SQL backends create these tables:

```sql
-- Settings (key-value)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Battle history
CREATE TABLE battle_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL CHECK (mode IN ('train', 'test')),
  hand_a INTEGER NOT NULL,
  hand_b INTEGER NOT NULL,
  reward INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Q-table
CREATE TABLE q_table (
  state TEXT NOT NULL,
  action INTEGER NOT NULL,
  q_value REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (state, action)
);

-- Indexes
CREATE INDEX idx_battle_history_date ON battle_history(created_at);
CREATE INDEX idx_battle_history_mode ON battle_history(mode);
```

## Example

```typescript
import { createStorage, QLearning, Agent, RockPaperScissorsEnv } from 'lsji';

// Production: persistent SQLite
const storage = await createStorage('sqlite', { path: './production.db' });

// Testing: in-memory
const testStorage = await createStorage('memory');

const qlearning = new QLearning({ alpha: 0.1, gamma: 0.9, epsilon: 0.1, storage });
const env = new RockPaperScissorsEnv({ opponent: 'random' });
const agent = new Agent({ qlearning, storage, env });

await agent.train({ episodes: 1000 });
await storage.close();
```
