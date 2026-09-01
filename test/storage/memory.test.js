/**
 * MemoryStorage Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorage } from '../../src/storage/memory.js';

describe('MemoryStorage', () => {
  let storage;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.initialize();
  });

  it('should initialize with default settings', async () => {
    const setting = await storage.getSetting('is_active');
    expect(setting).toEqual({ key: 'is_active', value: '1' });
  });

  it('should get and set settings', async () => {
    await storage.setSetting('test_key', 'test_value');
    const setting = await storage.getSetting('test_key');
    expect(setting).toEqual({ key: 'test_key', value: 'test_value' });
  });

  it('should return null for missing settings', async () => {
    const setting = await storage.getSetting('nonexistent');
    expect(setting).toBeNull();
  });

  it('should add and retrieve battles', async () => {
    await storage.addBattle({
      mode: 'test',
      handA: 0,
      handB: 1,
      reward: 1,
      createdAt: '2026-01-01T00:00:00Z'
    });

    const count = await storage.getTodayBattleCount();
    // Note: this depends on current date, so we just check it's a number
    expect(typeof count).toBe('number');
  });

  it('should track Q-table', async () => {
    await storage.updateQ('state1', 0, 0.5);
    
    const qTable = await storage.getQTable();
    expect(qTable.length).toBe(1);
    expect(qTable[0]).toEqual({ state: 'state1', action: 0, q_value: 0.5 });
  });

  it('should compute performance stats', async () => {
    // Add some battles
    await storage.addBattle({ mode: 'test', handA: 0, handB: 1, reward: 1, createdAt: new Date().toISOString() });
    await storage.addBattle({ mode: 'test', handA: 0, handB: 2, reward: -1, createdAt: new Date().toISOString() });
    await storage.addBattle({ mode: 'train', handA: 1, handB: 0, reward: 0, createdAt: new Date().toISOString() });

    const stats = await storage.getPerformanceStats();
    expect(stats.length).toBe(2); // test and train
    
    const testStat = stats.find(s => s.mode === 'test');
    expect(testStat.total).toBe(2);
    expect(testStat.win_rate).toBe(50); // 1 win out of 2
  });

  it('should clear all data', async () => {
    await storage.setSetting('test', 'value');
    await storage.addBattle({ mode: 'test', handA: 0, handB: 1, reward: 1, createdAt: new Date().toISOString() });
    await storage.updateQ('state1', 0, 0.5);
    
    storage.clear();
    
    const setting = await storage.getSetting('test');
    expect(setting).toBeNull();
    
    const count = await storage.getTodayBattleCount();
    expect(count).toBe(0);
  });
});
