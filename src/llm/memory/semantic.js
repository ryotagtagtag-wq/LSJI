/**
 * Semantic Memory
 * 
 * Long-term knowledge storage with vector embeddings for retrieval.
 * Uses simple keyword-based retrieval (can be extended with vector DB).
 */

import { createStorage } from '../../index.js';

/**
 * Knowledge entry
 * @typedef {Object} KnowledgeEntry
 * @property {string} id - Unique ID
 * @property {string} content - Knowledge content
 * @property {Array<string>} tags - Tags for categorization
 * @property {Object} metadata - Additional metadata
 * @property {number} [embedding] - Vector embedding (placeholder)
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {number} accessCount - Number of times accessed
 */

/**
 * Semantic Memory - Long-term knowledge storage
 */
export class SemanticMemory {
  constructor({ storage, embedder } = {}) {
    this.storage = storage;
    this.embedder = embedder; // Function to generate embeddings
    this.initialized = false;
  }

  /**
   * Initialize knowledge table
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.storage.db) {
      await this.storage.db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          tags TEXT NOT NULL,
          metadata TEXT,
          embedding TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          access_count INTEGER DEFAULT 0
        )
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge(tags)
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge(created_at)
      `);
    }
    
    this.initialized = true;
  }

  /**
   * Store knowledge
   */
  async store(content, { tags = [], metadata = {}, id = null } = {}) {
    await this.initialize();
    
    const entryId = id || `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    let embedding = null;
    if (this.embedder) {
      embedding = await this.embedder(content);
    }
    
    const entry = {
      id: entryId,
      content,
      tags: JSON.stringify(tags),
      metadata: JSON.stringify(metadata),
      embedding: embedding ? JSON.stringify(embedding) : null,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };
    
    if (this.storage.db) {
      await this.storage.db.run(
        `INSERT INTO knowledge (id, content, tags, metadata, embedding, created_at, updated_at, access_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.id, entry.content, entry.tags, entry.metadata, entry.embedding, entry.createdAt, entry.updatedAt, entry.accessCount]
      );
    } else {
      if (!this.memoryKnowledge) this.memoryKnowledge = new Map();
      this.memoryKnowledge.set(entryId, entry);
    }
    
    return entry;
  }

  /**
   * Retrieve knowledge by query
   */
  async retrieve(query, { limit = 10, tags = [] } = {}) {
    await this.initialize();
    
    let results = [];
    
    if (this.storage.db) {
      let sql = 'SELECT * FROM knowledge WHERE 1=1';
      const params = [];
      
      // Add tag filter
      if (tags.length > 0) {
        const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
        sql += ` AND (${tagConditions})`;
        for (const tag of tags) {
          params.push(`%"${tag}"%`);
        }
      }
      
      sql += ' ORDER BY access_count DESC, created_at DESC LIMIT ?';
      params.push(limit);
      
      const rows = await this.storage.db.all(sql, params);
      
      for (const row of rows) {
        results.push(this.rowToEntry(row));
      }
    } else {
      for (const entry of this.memoryKnowledge?.values() || []) {
        if (tags.length === 0 || tags.some(t => entry.tags.includes(t))) {
          results.push(entry);
        }
      }
      results.sort((a, b) => b.accessCount - a.accessCount);
      results = results.slice(0, limit);
    }
    
    // Simple keyword relevance scoring
    const queryWords = query.toLowerCase().split(/\s+/);
    for (const entry of results) {
      const contentWords = entry.content.toLowerCase().split(/\s+/);
      let score = 0;
      for (const qw of queryWords) {
        for (const cw of contentWords) {
          if (cw.includes(qw) || qw.includes(cw)) score++;
        }
      }
      entry.relevanceScore = score;
    }
    
    // Sort by relevance
    results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    // Update access count
    for (const entry of results) {
      await this.incrementAccess(entry.id);
    }
    
    return results;
  }

  /**
   * Get knowledge by ID
   */
  async get(id) {
    await this.initialize();
    
    if (this.storage.db) {
      const row = await this.storage.db.get('SELECT * FROM knowledge WHERE id = ?', [id]);
      if (!row) return null;
      return this.rowToEntry(row);
    } else {
      return this.memoryKnowledge?.get(id) || null;
    }
  }

  /**
   * Update knowledge
   */
  async update(id, { content, tags, metadata } = {}) {
    await this.initialize();
    
    const entry = await this.get(id);
    if (!entry) throw new Error(`Knowledge not found: ${id}`);
    
    const updates = [];
    const params = [];
    
    if (content !== undefined) {
      entry.content = content;
      updates.push('content = ?');
      params.push(content);
      
      if (this.embedder) {
        entry.embedding = JSON.stringify(await this.embedder(content));
        updates.push('embedding = ?');
        params.push(entry.embedding);
      }
    }
    
    if (tags !== undefined) {
      entry.tags = JSON.stringify(tags);
      updates.push('tags = ?');
      params.push(entry.tags);
    }
    
    if (metadata !== undefined) {
      entry.metadata = JSON.stringify({ ...JSON.parse(entry.metadata), ...metadata });
      updates.push('metadata = ?');
      params.push(entry.metadata);
    }
    
    entry.updatedAt = new Date().toISOString();
    updates.push('updated_at = ?');
    params.push(entry.updatedAt);
    
    params.push(id);
    
    if (this.storage.db) {
      await this.storage.db.run(
        `UPDATE knowledge SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    } else {
      this.memoryKnowledge.set(id, entry);
    }
    
    return entry;
  }

  /**
   * Delete knowledge
   */
  async delete(id) {
    await this.initialize();
    
    if (this.storage.db) {
      await this.storage.db.run('DELETE FROM knowledge WHERE id = ?', [id]);
    } else {
      this.memoryKnowledge?.delete(id);
    }
  }

  /**
   * Increment access count
   */
  async incrementAccess(id) {
    await this.initialize();
    
    if (this.storage.db) {
      await this.storage.db.run(
        'UPDATE knowledge SET access_count = access_count + 1 WHERE id = ?',
        [id]
      );
    } else {
      const entry = this.memoryKnowledge?.get(id);
      if (entry) {
        entry.accessCount++;
        this.memoryKnowledge.set(id, entry);
      }
    }
  }

  /**
   * List all knowledge
   */
  async list({ limit = 100, tags = [] } = {}) {
    await this.initialize();
    
    if (this.storage.db) {
      let sql = 'SELECT * FROM knowledge WHERE 1=1';
      const params = [];
      
      if (tags.length > 0) {
        const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
        sql += ` AND (${tagConditions})`;
        for (const tag of tags) {
          params.push(`%"${tag}"%`);
        }
      }
      
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      
      const rows = await this.storage.db.all(sql, params);
      return rows.map(r => this.rowToEntry(r));
    }
    
    return [];
  }

  rowToEntry(row) {
    return {
      id: row.id,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}'),
      embedding: row.embedding ? JSON.parse(row.embedding) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      accessCount: row.access_count || 0,
    };
  }
}

/**
 * Create semantic memory from config
 */
export async function createSemanticMemory(config = {}) {
  const storage = await createStorage(
    config.storage?.type || 'sqlite',
    config.storage?.options || {}
  );
  
  return new SemanticMemory({
    storage,
    embedder: config.embedder,
  });
}
