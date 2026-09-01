---
title: Custom Storage Backend
description: Implement your own storage backend
---

# Custom Storage Backend

Create a custom storage backend by extending the abstract `Storage` class.

## Interface to Implement

```typescript
import { Storage } from 'lsji';

abstract class Storage {
  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;
  abstract getSetting(key: string): Promise<{key: string, value: string} | null>;
  abstract setSetting(key: string, value: string | number): Promise<void>;
  abstract getQTable(): Promise<Array<{state: string, action: number, q_value: number}>>;
  abstract updateQ(state: string, action: number, qValue: number): Promise<void>;
  abstract addBattle(record: BattleRecord): Promise<void>;
  abstract getTodayBattleCount(): Promise<number>;
  abstract getPerformanceStats(): Promise<Array<{mode: string, total: number, win_rate: number}>>;
}

interface BattleRecord {
  mode: 'train' | 'test';
  handA: number;
  handB: number;
  reward: number;
  createdAt: string;
}
```

## Example: Redis Storage

```typescript
import { Storage } from 'lsji';
import Redis from 'ioredis';

class RedisStorage extends Storage {
  constructor(redisUrl = 'redis://localhost:6379') {
    super();
    this.redis = new Redis(redisUrl);
    this.keyPrefix = 'lsji:';
  }

  async initialize() {
    // Set default settings
    await this.setSetting('is_active', 1);
  }

  async close() {
    await this.redis.quit();
  }

  async getSetting(key) {
    const value = await this.redis.get(this.keyPrefix + 'setting:' + key);
    return value ? { key, value } : null;
  }

  async setSetting(key, value) {
    await this.redis.set(this.keyPrefix + 'setting:' + key, String(value));
  }

  async getQTable() {
    const keys = await this.redis.keys(this.keyPrefix + 'q:*');
    const results = [];
    
    for (const key of keys) {
      const value = await this.redis.get(key);
      const parts = key.replace(this.keyPrefix + 'q:', '').split(':');
      results.push({
        state: parts[0],
        action: parseInt(parts[1], 10),
        q_value: parseFloat(value)
      });
    }
    
    return results.sort((a, b) => a.state.localeCompare(b.state) || a.action - b.action);
  }

  async updateQ(state, action, qValue) {
    await this.redis.set(
      this.keyPrefix + `q:${state}:${action}`, 
      qValue.toString()
    );
  }

  async addBattle(record) {
    const battleKey = this.keyPrefix + `battle:${Date.now()}:${Math.random()}`;
    await this.redis.hset(battleKey, {
      mode: record.mode,
      hand_a: record.handA.toString(),
      hand_b: record.handB.toString(),
      reward: record.reward.toString(),
      created_at: record.createdAt
    });
    
    // Add to sorted set for date queries
    await this.redis.zadd(
      this.keyPrefix + 'battles:by_date',
      new Date(record.createdAt).getTime(),
      battleKey
    );
  }

  async getTodayBattleCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.redis.zcount(
      this.keyPrefix + 'battles:by_date',
      today.getTime(),
      tomorrow.getTime()
    );
  }

  async getPerformanceStats() {
    const keys = await this.redis.zrange(this.keyPrefix + 'battles:by_date', 0, -1);
    const stats = new Map();
    
    for (const key of keys) {
      const battle = await this.redis.hgetall(key);
      const mode = battle.mode;
      
      if (!stats.has(mode)) {
        stats.set(mode, { total: 0, wins: 0 });
      }
      
      const stat = stats.get(mode);
      stat.total++;
      if (parseInt(battle.reward) > 0) stat.wins++;
    }
    
    return Array.from(stats.entries()).map(([mode, stat]) => ({
      mode,
      total: stat.total,
      win_rate: stat.total > 0 ? Math.round((stat.wins / stat.total) * 1000) / 10 : 0
    }));
  }
}
```

## Register Custom Storage

Add to `createStorage` factory (or use directly):

```typescript
import { createStorage } from 'lsji';

// Option 1: Use directly
const storage = new RedisStorage('redis://localhost:6379');
await storage.initialize();

// Option 2: Extend createStorage (modify src/storage/index.js)
import { RedisStorage } from './redis-storage';

// In your code:
const storage = new RedisStorage();
await storage.initialize();
```

## Example: PostgreSQL Storage

```typescript
import { Pool } from 'pg';

class PostgresStorage extends Storage {
  constructor(connectionString) {
    super();
    this.pool = new Pool({ connectionString });
  }

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS battle_history (
        id SERIAL PRIMARY KEY,
        mode TEXT NOT NULL,
        hand_a INTEGER NOT NULL,
        hand_b INTEGER NOT NULL,
        reward INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL
      );
      CREATE TABLE IF NOT EXISTS q_table (
        state TEXT NOT NULL,
        action INTEGER NOT NULL,
        q_value REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (state, action)
      );
    `);
    await this.setSetting('is_active', 1);
  }

  async close() {
    await this.pool.end();
  }

  async getSetting(key) {
    const res = await this.pool.query('SELECT key, value FROM settings WHERE key = $1', [key]);
    return res.rows[0] || null;
  }

  async setSetting(key, value) {
    await this.pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) 
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      [key, String(value)]
    );
  }

  // ... implement other methods similarly
}
```

## Testing Custom Storage

```typescript
import { MemoryStorage } from 'lsji';

// Use MemoryStorage as reference implementation for testing
async function testStorageImplementation(StorageClass) {
  const storage = new StorageClass();
  await storage.initialize();
  
  // Test settings
  await storage.setSetting('test', 'value');
  const setting = await storage.getSetting('test');
  assert(setting.value === 'value');
  
  // Test Q-table
  await storage.updateQ('state1', 0, 0.5);
  const qTable = await storage.getQTable();
  assert(qTable[0].q_value === 0.5);
  
  // Test battles
  await storage.addBattle({ mode: 'train', handA: 0, handB: 1, reward: 1, createdAt: new Date().toISOString() });
  const count = await storage.getTodayBattleCount();
  assert(count === 1);
  
  await storage.close();
  console.log('All tests passed!');
}
```
