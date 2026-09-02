/**
 * Tool Registry
 * 
 * Manages tool/function definitions for LLM agents.
 * Provides registration, lookup, and execution with idempotency.
 */

import { IdempotencyStore } from '../../execution/idempotency.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Tool definition
 * @typedef {Object} ToolDefinition
 * @property {string} name - Unique tool name
 * @property {string} description - Human-readable description
 * @property {Object} parameters - JSON Schema for parameters
 * @property {Function} execute - Async function(params, context) -> result
 * @property {boolean} [requiresApproval] - Whether HITL approval needed
 * @property {boolean} [idempotent] - Whether to use idempotency
 */

/**
 * Tool Registry - Manages available tools
 */
export class ToolRegistry {
  constructor({ idempotencyStore, approvalGate } = {}) {
    this.tools = new Map();
    this.idempotencyStore = idempotencyStore;
    this.approvalGate = approvalGate;
    this.categories = new Map();
  }

  /**
   * Register a tool
   */
  register(definition) {
    if (!definition.name) {
      throw new Error('Tool must have a name');
    }
    if (!definition.execute || typeof definition.execute !== 'function') {
      throw new Error('Tool must have an execute function');
    }
    if (!definition.parameters) {
      throw new Error('Tool must have parameters schema');
    }
    
    this.tools.set(definition.name, definition);
    
    // Categorize
    const category = definition.category || 'general';
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
    }
    this.categories.get(category).push(definition.name);
    
    return this;
  }

  /**
   * Register multiple tools
   */
  registerMany(definitions) {
    for (const def of definitions) {
      this.register(def);
    }
    return this;
  }

  /**
   * Get a tool by name
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name) {
    return this.tools.has(name);
  }

  /**
   * Get all tools
   */
  getAll() {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category) {
    const names = this.categories.get(category) || [];
    return names.map(n => this.tools.get(n)).filter(Boolean);
  }

  /**
   * Get tool definitions for LLM (OpenAI/Anthropic format)
   */
  getDefinitions(category = null) {
    const tools = category ? this.getByCategory(category) : this.getAll();
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Execute a tool with idempotency and approval
   */
  async execute(name, params, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    // Check approval requirement
    if (tool.requiresApproval && this.approvalGate) {
      const approval = await this.approvalGate.requestApproval({
        action: name,
        context: { params, ...context },
        requester: context.requester || 'agent',
      });
      
      if (approval.status !== 'approved') {
        throw new Error(`Tool ${name} was ${approval.status}: ${approval.reason}`);
      }
    }
    
    // Execute with idempotency if enabled
    if (tool.idempotent && this.idempotencyStore) {
      // BUG FIX: Use full request object (including tool name) for idempotency key
      const requestForIdem = { name, params };
      const requestHash = this.idempotencyStore.hashRequest(requestForIdem);
      const key = `${name}_${requestHash}`;
      return this.idempotencyStore.execute(key, name, requestForIdem, () => tool.execute(params, context));
    }
    
    return tool.execute(params, context);
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeAll(calls, context = {}) {
    return Promise.all(calls.map(({ name, params }) => this.execute(name, params, context)));
  }
}

/**
 * Create tool registry with built-in tools
 */
export function createToolRegistry(config = {}) {
  const registry = new ToolRegistry(config);
  
  // Register built-in tools
  registry.registerMany(getBuiltinTools(config));
  
  return registry;
}

/**
 * Get built-in tool definitions
 */
function getBuiltinTools(config = {}) {
  const tools = [];
  
  // Web search tool
  tools.push({
    name: 'web_search',
    description: 'Search the web for current information',
    category: 'research',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Maximum results', default: 5 },
      },
      required: ['query'],
    },
    requiresApproval: false,
    idempotent: true,
    async execute({ query, maxResults = 5 }, context) {
      // This would integrate with actual search API
      return { query, results: [], note: 'Web search not configured' };
    },
  });
  
  // File read tool
  tools.push({
    name: 'file_read',
    description: 'Read a file from the filesystem',
    category: 'filesystem',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        encoding: { type: 'string', description: 'Encoding', default: 'utf-8' },
      },
      required: ['path'],
    },
    requiresApproval: false,
    idempotent: true,
    async execute({ path, encoding = 'utf-8' }, context) {
      const fs = await import('fs/promises');
      return fs.readFile(path, encoding);
    },
  });
  
  // File write tool
  tools.push({
    name: 'file_write',
    description: 'Write a file to the filesystem',
    category: 'filesystem',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
        encoding: { type: 'string', description: 'Encoding', default: 'utf-8' },
      },
      required: ['path', 'content'],
    },
    requiresApproval: true, // Requires HITL approval
    idempotent: true,
    async execute({ path, content, encoding = 'utf-8' }, context) {
      const fs = await import('fs/promises');
      await fs.writeFile(path, content, encoding);
      return { path, bytesWritten: Buffer.byteLength(content, encoding) };
    },
  });
  
  // Code execution tool
  tools.push({
    name: 'code_exec',
    description: 'Execute code in a sandboxed environment',
    category: 'code',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', description: 'Language', default: 'javascript' },
        timeout: { type: 'number', description: 'Timeout in ms', default: 30000 },
      },
      required: ['code'],
    },
    requiresApproval: true, // Requires HITL approval
    idempotent: false,
    async execute({ code, language = 'javascript', timeout = 30000 }, context) {
      // This would integrate with a sandbox like Pyodide, QuickJS, etc.
      return { output: 'Code execution not configured', language };
    },
  });
  
  // API call tool
  tools.push({
    name: 'api_call',
    description: 'Make an HTTP API call',
    category: 'network',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'API URL' },
        method: { type: 'string', description: 'HTTP method', default: 'GET' },
        headers: { type: 'object', description: 'Headers' },
        body: { type: 'object', description: 'Request body' },
        timeout: { type: 'number', description: 'Timeout in ms', default: 30000 },
      },
      required: ['url'],
    },
    requiresApproval: true, // Requires HITL approval
    idempotent: true,
    async execute({ url, method = 'GET', headers = {}, body, timeout = 30000 }, context) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const data = await response.json();
        return { status: response.status, data };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
  });
  
  // Email send tool
  tools.push({
    name: 'send_email',
    description: 'Send an email',
    category: 'communication',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body' },
        html: { type: 'string', description: 'HTML body' },
      },
      required: ['to', 'subject', 'body'],
    },
    requiresApproval: true, // Requires HITL approval
    idempotent: true,
    async execute({ to, subject, body, html }, context) {
      // This would integrate with actual email service
      return { to, subject, sent: false, note: 'Email service not configured' };
    },
  });
  
  // Database query tool
  tools.push({
    name: 'db_query',
    description: 'Execute a database query',
    category: 'data',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL query' },
        params: { type: 'array', description: 'Query parameters' },
      },
      required: ['query'],
    },
    requiresApproval: true, // Requires HITL approval
    idempotent: false,
    async execute({ query, params = [] }, context) {
      // This would use the existing storage
      return { query, results: [], note: 'DB query not configured' };
    },
  });
  
  return tools;
}
