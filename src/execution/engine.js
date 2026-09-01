/**
 * Execution Engine
 * 
 * Durable execution engine with automatic checkpointing and recovery.
 * Provides workflow execution with resume capability.
 */

import { createStorage } from '../index.js';
import { IdempotencyStore, createIdempotencyStore } from './idempotency.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Checkpoint record
 * @typedef {Object} CheckpointRecord
 * @property {string} id - Checkpoint ID
 * @property {string} workflowId - Workflow identifier
 * @property {number} step - Step number
 * @property {Object} state - Workflow state at checkpoint
 * @property {Object} context - Execution context
 * @property {Date} createdAt
 * @property {string} [parentId] - Parent checkpoint ID
 */

/**
 * Workflow definition
 * @typedef {Object} Workflow
 * @property {string} id - Workflow ID
 * @property {string} name - Workflow name
 * @property {Function} execute - Async function(context) -> result
 * @property {Array<string>} [checkpointSteps] - Steps to checkpoint after
 */

/**
 * Execution Engine - Durable workflow execution
 */
export class ExecutionEngine {
  constructor({ storage, checkpointStore, idempotencyStore, defaultCheckpointInterval = 5 } = {}) {
    this.storage = storage;
    this.checkpointStore = checkpointStore;
    this.idempotencyStore = idempotencyStore;
    this.defaultCheckpointInterval = defaultCheckpointInterval;
    this.initialized = false;
  }

  /**
   * Check if storage is SQL-based (has db with all method)
   */
  isSqlStorage() {
    return this.storage.db && typeof this.storage.db.all === 'function';
  }

  /**
   * Initialize checkpoint table
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.isSqlStorage()) {
      await this.storage.db.exec(`
        CREATE TABLE IF NOT EXISTS checkpoints (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          step INTEGER NOT NULL,
          state TEXT NOT NULL,
          context TEXT NOT NULL,
          created_at TEXT NOT NULL,
          parent_id TEXT
        )
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_checkpoints_workflow ON checkpoints(workflow_id)
      `);
      
      await this.storage.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_checkpoints_created ON checkpoints(created_at)
      `);
    }
    
    this.initialized = true;
  }

  /**
   * Execute a workflow with checkpointing
   */
  async execute(workflow, options = {}) {
    await this.initialize();
    
    const workflowId = options.workflowId || workflow.id || uuidv4();
    const checkpointEvery = options.checkpointEvery || this.defaultCheckpointInterval;
    const idempotencyKey = options.idempotencyKey;
    const resumeFrom = options.resumeFrom; // checkpoint ID to resume from
    
    let context = options.initialContext || {};
    let step = 0;
    let parentCheckpointId = null;
    
    // Resume from checkpoint if specified
    if (resumeFrom) {
      const checkpoint = await this.getCheckpoint(resumeFrom);
      if (checkpoint) {
        context = { ...context, ...checkpoint.state };
        step = checkpoint.step;
        parentCheckpointId = checkpoint.id;
        console.log(`Resuming workflow ${workflowId} from checkpoint ${resumeFrom} (step ${step})`);
      } else {
        throw new Error(`Checkpoint not found: ${resumeFrom}`);
      }
    }
    
    // Wrap execution with idempotency if key provided
    const executeWithIdempotency = async (fn) => {
      if (idempotencyKey && this.idempotencyStore) {
        return this.idempotencyStore.execute(
          idempotencyKey,
          workflowId,
          { workflowId, step, context },
          fn
        );
      }
      return fn();
    };
    
    try {
      // Execute workflow steps
      const result = await executeWithIdempotency(async () => {
        return await workflow.execute(context);
      });
      
      // Save final checkpoint
      await this.saveCheckpoint({
        workflowId,
        step: step + 1,
        state: context,
        context: { ...context, result },
        parentId: parentCheckpointId,
      });
      
      return { success: true, result, workflowId, checkpoints: await this.getCheckpoints(workflowId) };
    } catch (error) {
      // Save error checkpoint
      await this.saveCheckpoint({
        workflowId,
        step,
        state: context,
        context: { ...context, error: error.message },
        parentId: parentCheckpointId,
      });
      
      return { success: false, error: error.message, workflowId, checkpoints: await this.getCheckpoints(workflowId) };
    }
  }

  /**
   * Execute a multi-step workflow with per-step checkpointing
   */
  async executeSteps(steps, options = {}) {
    await this.initialize();
    
    const workflowId = options.workflowId || uuidv4();
    const checkpointEvery = options.checkpointEvery || this.defaultCheckpointInterval;
    const idempotencyKey = options.idempotencyKey;
    const resumeFrom = options.resumeFrom;
    
    let context = options.initialContext || {};
    let step = 0;
    let parentCheckpointId = null;
    
    // Resume from checkpoint
    if (resumeFrom) {
      const checkpoint = await this.getCheckpoint(resumeFrom);
      if (checkpoint) {
        context = { ...context, ...checkpoint.state };
        step = checkpoint.step;
        parentCheckpointId = checkpoint.id;
      }
    }
    
    const results = [];
    
    for (let i = step; i < steps.length; i++) {
      const stepFn = steps[i];
      step = i + 1;
      
      try {
        const stepResult = await stepFn(context);
        results.push({ step: i, success: true, result: stepResult });
        context = { ...context, [steps[i].name || `step_${i}`]: stepResult };
      } catch (error) {
        results.push({ step: i, success: false, error: error.message });
        
        // Save error checkpoint
        await this.saveCheckpoint({
          workflowId,
          step: i + 1,
          state: context,
          context: { ...context, error: error.message, step: i },
          parentId: parentCheckpointId,
        });
        
        if (!options.continueOnError) {
          return { success: false, results, workflowId, error: error.message };
        }
      }
      
      // Checkpoint at intervals
      if (step % checkpointEvery === 0) {
        await this.saveCheckpoint({
          workflowId,
          step,
          state: context,
          context: { ...context, lastStep: i },
          parentId: parentCheckpointId,
        });
        parentCheckpointId = await this.getLatestCheckpointId(workflowId);
      }
    }
    
    // Final checkpoint
    await this.saveCheckpoint({
      workflowId,
      step: steps.length,
      state: context,
      context: { ...context, results },
      parentId: parentCheckpointId,
    });
    
    return { success: true, results, workflowId, context };
  }

  /**
   * Save a checkpoint
   */
  async saveCheckpoint(data) {
    await this.initialize();
    
    const checkpoint = {
      id: uuidv4(),
      workflowId: data.workflowId,
      step: data.step,
      state: JSON.stringify(data.state),
      context: JSON.stringify(data.context),
      createdAt: new Date().toISOString(),
      parentId: data.parentId || null,
    };
    
    if (this.isSqlStorage()) {
      await this.storage.db.run(
        `INSERT INTO checkpoints (id, workflow_id, step, state, context, created_at, parent_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [checkpoint.id, checkpoint.workflowId, checkpoint.step, checkpoint.state, 
         checkpoint.context, checkpoint.createdAt, checkpoint.parentId]
      );
    } else {
      if (!this.memoryCheckpoints) this.memoryCheckpoints = new Map();
      this.memoryCheckpoints.set(checkpoint.id, checkpoint);
    }
    
    return checkpoint;
  }

  /**
   * Get a checkpoint by ID
   */
  async getCheckpoint(id) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const row = await this.storage.db.get('SELECT * FROM checkpoints WHERE id = ?', [id]);
      if (!row) return null;
      return {
        id: row.id,
        workflowId: row.workflow_id,
        step: row.step,
        state: JSON.parse(row.state),
        context: JSON.parse(row.context),
        createdAt: row.created_at,
        parentId: row.parent_id,
      };
    } else {
      return this.memoryCheckpoints?.get(id) || null;
    }
  }

  /**
   * Get all checkpoints for a workflow
   */
  async getCheckpoints(workflowId) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const rows = await this.storage.db.all(
        'SELECT * FROM checkpoints WHERE workflow_id = ? ORDER BY step ASC',
        [workflowId]
      );
      return rows.map(row => ({
        id: row.id,
        workflowId: row.workflow_id,
        step: row.step,
        state: JSON.parse(row.state),
        context: JSON.parse(row.context),
        createdAt: row.created_at,
        parentId: row.parent_id,
      }));
    } else {
      const checkpoints = [];
      for (const cp of this.memoryCheckpoints?.values() || []) {
        if (cp.workflowId === workflowId) {
          checkpoints.push(cp);
        }
      }
      return checkpoints.sort((a, b) => a.step - b.step);
    }
  }

  /**
   * Get latest checkpoint ID for a workflow
   */
  async getLatestCheckpointId(workflowId) {
    const checkpoints = await this.getCheckpoints(workflowId);
    return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].id : null;
  }

  /**
   * Recover workflow from latest checkpoint
   */
  async recover(workflowId) {
    const checkpoints = await this.getCheckpoints(workflowId);
    if (checkpoints.length === 0) {
      return null;
    }
    
    const latest = checkpoints[checkpoints.length - 1];
    return {
      workflowId,
      step: latest.step,
      state: latest.state,
      context: latest.context,
      checkpointId: latest.id,
    };
  }

  /**
   * List all workflows with checkpoints
   */
  async listWorkflows() {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      const rows = await this.storage.db.all(`
        SELECT workflow_id, MAX(step) as last_step, MAX(created_at) as last_checkpoint
        FROM checkpoints
        GROUP BY workflow_id
        ORDER BY last_checkpoint DESC
      `);
      return rows;
    }
    
    // For memory storage, collect unique workflow IDs
    const workflows = new Map();
    for (const cp of this.memoryCheckpoints?.values() || []) {
      if (!workflows.has(cp.workflowId)) {
        workflows.set(cp.workflowId, {
          workflow_id: cp.workflowId,
          last_step: cp.step,
          last_checkpoint: cp.createdAt,
        });
      } else {
        const existing = workflows.get(cp.workflowId);
        if (cp.step > existing.last_step) {
          existing.last_step = cp.step;
          existing.last_checkpoint = cp.createdAt;
        }
      }
    }
    
    return Array.from(workflows.values()).sort((a, b) => 
      new Date(b.last_checkpoint) - new Date(a.last_checkpoint)
    );
  }

  /**
   * Delete checkpoints for a workflow
   */
  async deleteCheckpoints(workflowId) {
    await this.initialize();
    
    if (this.isSqlStorage()) {
      await this.storage.db.run('DELETE FROM checkpoints WHERE workflow_id = ?', [workflowId]);
    } else {
      for (const [key, cp] of this.memoryCheckpoints?.entries() || []) {
        if (cp.workflowId === workflowId) {
          this.memoryCheckpoints.delete(key);
        }
      }
    }
  }
}

/**
 * Create execution engine from config
 */
export async function createExecutionEngine(config = {}) {
  const storage = await createStorage(
    config.storage?.type || 'sqlite',
    config.storage?.options || {}
  );
  
  let checkpointStore = storage;
  if (config.checkpointStorage) {
    checkpointStore = await createStorage(
      config.checkpointStorage.type || 'sqlite',
      config.checkpointStorage.options || {}
    );
  }
  
  let idempotencyStore = null;
  if (config.idempotency) {
    idempotencyStore = await createIdempotencyStore(config.idempotency);
  }
  
  return new ExecutionEngine({
    storage,
    checkpointStore,
    idempotencyStore,
    defaultCheckpointInterval: config.checkpointInterval,
  });
}
