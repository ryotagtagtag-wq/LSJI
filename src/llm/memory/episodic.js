/**
 * Episodic Memory
 * 
 * Event-based memory for tracking agent actions and outcomes.
 * Useful for learning from past experiences.
 */

import { createStorage } from '../../index.js';

/**
 * Episode record
 * @typedef {Object} Episode
 * @property {string} id - Unique ID
 * @property {string} task - Task description
 * @property {Array} steps - Steps taken
 * @property {string} outcome - 'success' | 'failure' | 'partial'
 * @property {Object} context - Initial context
 * @property {Object} result - Final result
 * @property {number} duration - Duration in ms
 * @property {number} tokensUsed - Total tokens used
 * @property {number} cost - Total cost
 * @property {Date} startedAt
 * @property {Date} completedAt
 * @property {Array} [tags] - Tags for categorization
 */

/**
 * Episodic Memory - Event-based experience storage
 */
export class EpisodicMemory {
  constructor({ storage } = {}) {
    this.storage = storage;
    this.currentEpisode = null;
    this.initialized = false;
  }

  /**
   * Initialize episodes table
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.storage.db) {
      await this.storage.db.exec(`
        CREATE TABLE IF NOT EXISTS episodes (
          id TEXT PRIMARY KEY,
          task TEXT NOT NULL,
          steps TEXT NOT NULL,
          outcome TEXT NOT NULL,
          context TEXT NOT NULL,
          result TEXT,
          duration INTEGER,
          tokens_used INTEGER,
          cost REAL,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          tags TEXT
        )
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_episodes_outcome ON episodes(outcome)
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_episodes_started ON episodes(started_at)
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_episodes_tags ON episodes(tags)
      `);
    }
    
    this.initialized = true;
  }

  /**
   * Start a new episode
   */
  async startEpisode(task, context = {}, tags = []) {
    await this.initialize();
    
    this.currentEpisode = {
      id: `episode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      task,
      steps: [],
      outcome: 'in_progress',
      context,
      result: null,
      duration: 0,
      tokensUsed: 0,
      cost: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      tags,
    };
    
    return this.currentEpisode.id;
  }

  /**
   * Add a step to current episode
   */
  async addStep(step) {
    if (!this.currentEpisode) {
      throw new Error('No active episode. Call startEpisode() first.');
    }
    
    this.currentEpisode.steps.push({
      ...step,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * End current episode
   */
  async endEpisode(outcome, result = null) {
    if (!this.currentEpisode) {
      throw new Error('No active episode. Call startEpisode() first.');
    }
    
    const completedAt = new Date().toISOString();
    const startedAt = new Date(this.currentEpisode.startedAt);
    
    this.currentEpisode.outcome = outcome;
    this.currentEpisode.result = result;
    this.currentEpisode.completedAt = completedAt;
    this.currentEpisode.duration = new Date(completedAt).getTime() - startedAt.getTime();
    
    // Persist
    if (this.storage.db) {
      await this.storage.db.run(
        `INSERT INTO episodes (id, task, steps, outcome, context, result, duration, tokens_used, cost, started_at, completed_at, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.currentEpisode.id,
          this.currentEpisode.task,
          JSON.stringify(this.currentEpisode.steps),
          this.currentEpisode.outcome,
          JSON.stringify(this.currentEpisode.context),
          JSON.stringify(this.currentEpisode.result),
          this.currentEpisode.duration,
          this.currentEpisode.tokensUsed,
          this.currentEpisode.cost,
          this.currentEpisode.startedAt,
          this.currentEpisode.completedAt,
          JSON.stringify(this.currentEpisode.tags),
        ]
      );
    } else {
      if (!this.memoryEpisodes) this.memoryEpisodes = new Map();
      this.memoryEpisodes.set(this.currentEpisode.id, this.currentEpisode);
    }
    
    const episode = this.currentEpisode;
    this.currentEpisode = null;
    return episode;
  }

  /**
   * Record token usage for current episode
   */
  recordTokens(tokens) {
    if (this.currentEpisode) {
      this.currentEpisode.tokensUsed += tokens;
    }
  }

  /**
   * Record cost for current episode
   */
  recordCost(cost) {
    if (this.currentEpisode) {
      this.currentEpisode.cost += cost;
    }
  }

  /**
   * Get episode by ID
   */
  async getEpisode(id) {
    await this.initialize();
    
    if (this.storage.db) {
      const row = await this.storage.db.get('SELECT * FROM episodes WHERE id = ?', [id]);
      if (!row) return null;
      return this.rowToEpisode(row);
    } else {
      return this.memoryEpisodes?.get(id) || null;
    }
  }

  /**
   * Search episodes
   */
  async search({ outcome, tags = [], limit = 50, since = null } = {}) {
    await this.initialize();
    
    let results = [];
    
    if (this.storage.db) {
      let sql = 'SELECT * FROM episodes WHERE 1=1';
      const params = [];
      
      if (outcome) {
        sql += ' AND outcome = ?';
        params.push(outcome);
      }
      
      if (tags.length > 0) {
        const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
        sql += ` AND (${tagConditions})`;
        for (const tag of tags) {
          params.push(`%"${tag}"%`);
        }
      }
      
      if (since) {
        sql += ' AND started_at >= ?';
        params.push(since.toISOString());
      }
      
      sql += ' ORDER BY started_at DESC LIMIT ?';
      params.push(limit);
      
      const rows = await this.storage.db.all(sql, params);
      results = rows.map(r => this.rowToEpisode(r));
    } else {
      for (const ep of this.memoryEpisodes?.values() || []) {
        if (outcome && ep.outcome !== outcome) continue;
        if (tags.length > 0 && !tags.some(t => ep.tags.includes(t))) continue;
        if (since && new Date(ep.startedAt) < since) continue;
        results.push(ep);
      }
      results.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
      results = results.slice(0, limit);
    }
    
    return results;
  }

  /**
   * Get successful episodes for a task type
   */
  async getSuccessfulEpisodes(taskPattern, limit = 10) {
    const episodes = await this.search({ outcome: 'success', limit: 100 });
    return episodes
      .filter(e => e.task.includes(taskPattern))
      .slice(0, limit);
  }

  /**
   * Get failure episodes for analysis
   */
  async getFailures({ limit = 50, since = null } = {}) {
    return this.search({ outcome: 'failure', limit, since });
  }

  /**
   * Get episode statistics
   */
  async getStats() {
    await this.initialize();
    
    if (this.storage.db) {
      const row = await this.storage.db.get(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
          SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) as failures,
          SUM(CASE WHEN outcome = 'partial' THEN 1 ELSE 0 END) as partials,
          AVG(duration) as avg_duration,
          AVG(tokens_used) as avg_tokens,
          AVG(cost) as avg_cost
        FROM episodes
      `);
      return row;
    }
    
    return { total: 0, successes: 0, failures: 0, partials: 0 };
  }

  rowToEpisode(row) {
    return {
      id: row.id,
      task: row.task,
      steps: JSON.parse(row.steps || '[]'),
      outcome: row.outcome,
      context: JSON.parse(row.context || '{}'),
      result: row.result ? JSON.parse(row.result) : null,
      duration: row.duration,
      tokensUsed: row.tokens_used,
      cost: row.cost,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      tags: JSON.parse(row.tags || '[]'),
    };
  }
}

/**
 * Create episodic memory from config
 */
export async function createEpisodicMemory(config = {}) {
  const storage = await createStorage(
    config.storage?.type || 'sqlite',
    config.storage?.options || {}
  );
  
  return new EpisodicMemory({ storage });
}
