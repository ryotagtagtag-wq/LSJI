/**
 * Prompt Manager
 * 
 * Manages prompt templates with versioning and variable substitution.
 */

import { createStorage } from '../index.js';

/**
 * Prompt template
 * @typedef {Object} PromptTemplate
 * @property {string} name - Template name
 * @property {string} version - Template version
 * @property {string} template - Template string with {{variables}}
 * @property {Array<string>} variables - Required variables
 * @property {string} description - Template description
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * Prompt Manager - Template management with versioning
 */
export class PromptManager {
  constructor({ storage } = {}) {
    this.storage = storage;
    this.templates = new Map(); // name -> { versions: Map<version, template> }
    this.initialized = false;
  }

  /**
   * Initialize prompts table
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.storage.db) {
      await this.storage.db.exec(`
        CREATE TABLE IF NOT EXISTS prompts (
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          template TEXT NOT NULL,
          variables TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (name, version)
        )
      `);
    }
    
    this.initialized = true;
  }

  /**
   * Register a prompt template
   */
  async register(name, template, { version = '1.0.0', variables = [], description = '' } = {}) {
    await this.initialize();
    
    // Extract variables from template if not provided
    const extractedVars = variables.length > 0 ? variables : this.extractVariables(template);
    
    const prompt = {
      name,
      version,
      template,
      variables: extractedVars,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Store in memory
    if (!this.templates.has(name)) {
      this.templates.set(name, new Map());
    }
    this.templates.get(name).set(version, prompt);
    
    // Persist
    if (this.storage.db) {
      await this.storage.db.run(
        `INSERT OR REPLACE INTO prompts (name, version, template, variables, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, version, template, JSON.stringify(extractedVars), description, prompt.createdAt, prompt.updatedAt]
      );
    }
    
    return prompt;
  }

  /**
   * Get a prompt template (latest version by default)
   */
  async get(name, version = null) {
    await this.initialize();
    
    const versions = this.templates.get(name);
    if (!versions) return null;
    
    if (version) {
      return versions.get(version) || null;
    }
    
    // Get latest version
    const sortedVersions = Array.from(versions.keys()).sort((a, b) => {
      const parseVersion = v => v.split('.').map(Number);
      const va = parseVersion(a);
      const vb = parseVersion(b);
      for (let i = 0; i < 3; i++) {
        if (va[i] !== vb[i]) return vb[i] - va[i];
      }
      return 0;
    });
    
    return versions.get(sortedVersions[0]) || null;
  }

  /**
   * Get all versions of a prompt
   */
  async getAllVersions(name) {
    await this.initialize();
    const versions = this.templates.get(name);
    if (!versions) return [];
    return Array.from(versions.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  /**
   * Render a prompt with variables
   */
  async render(name, variables, version = null) {
    const prompt = await this.get(name, version);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}${version ? `@${version}` : ''}`);
    }
    
    // Check required variables
    for (const v of prompt.variables) {
      if (!(v in variables)) {
        throw new Error(`Missing required variable: ${v}`);
      }
    }
    
    // Substitute variables
    let rendered = prompt.template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      rendered = rendered.replaceAll(placeholder, String(value));
    }
    
    return rendered;
  }

  /**
   * Render multiple prompts (for system + user messages)
   */
  async renderAll(prompts, variables) {
    const results = [];
    for (const { name, version, role = 'user' } of prompts) {
      const content = await this.render(name, variables, version);
      results.push({ role, content });
    }
    return results;
  }

  /**
   * Extract variables from template
   */
  extractVariables(template) {
    const matches = template.match(/{{(\w+)}}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  }

  /**
   * List all prompt names
   */
  async list() {
    await this.initialize();
    return Array.from(this.templates.keys());
  }

  /**
   * Delete a prompt version
   */
  async delete(name, version) {
    await this.initialize();
    
    const versions = this.templates.get(name);
    if (!versions || !versions.has(version)) {
      return false;
    }
    
    versions.delete(version);
    
    if (this.storage.db) {
      await this.storage.db.run(
        'DELETE FROM prompts WHERE name = ? AND version = ?',
        [name, version]
      );
    }
    
    return true;
  }

  /**
   * Load all prompts from storage
   */
  async loadAll() {
    await this.initialize();
    
    if (this.storage.db) {
      const rows = await this.storage.db.all('SELECT * FROM prompts');
      for (const row of rows) {
        if (!this.templates.has(row.name)) {
          this.templates.set(row.name, new Map());
        }
        this.templates.get(row.name).set(row.version, {
          name: row.name,
          version: row.version,
          template: row.template,
          variables: JSON.parse(row.variables || '[]'),
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    }
  }
}

/**
 * Built-in prompt templates
 */
export const BUILTIN_PROMPTS = {
  'system:react': {
    template: `You are an AI assistant that uses the ReAct pattern (Reasoning + Acting) to solve tasks.

You have access to the following tools:
{{tools}}

When you need to use a tool, respond with:
THOUGHT: Your reasoning about what to do next
ACTION: The tool name to use
ACTION_INPUT: The parameters for the tool

After the tool returns, you'll see:
OBSERVATION: The result

Continue this pattern until you can provide the final answer.

Current task: {{task}}`,
    variables: ['tools', 'task'],
    description: 'ReAct system prompt with tool definitions',
  },
  
  'system:planner': {
    template: `You are a planning agent. Break down the task into a sequence of steps.

Task: {{task}}

Available tools: {{tools}}

Create a plan with numbered steps. Each step should specify:
1. What tool to use (if any)
2. What parameters to pass
3. What you expect to learn or achieve

Output as JSON:
{
  "steps": [
    {"step": 1, "tool": "tool_name", "params": {}, "description": "..."}
  ]
}`,
    variables: ['task', 'tools'],
    description: 'Planning agent prompt',
  },
  
  'system:code-reviewer': {
    template: `You are an expert code reviewer. Analyze the provided code for:
- Bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code style and best practices
- Test coverage gaps

Code to review:
{{code}}

Context: {{context}}

Provide your review in this format:
## Summary
Brief overall assessment

## Issues Found
- [Severity] File:Line - Description

## Suggestions
- Improvement suggestions

## Approved: true/false`,
    variables: ['code', 'context'],
    description: 'Code review prompt',
  },
};

/**
 * Create prompt manager with built-in templates
 */
export async function createPromptManager(config = {}) {
  const storage = await createStorage(
    config.storage?.type || 'sqlite',
    config.storage?.options || {}
  );
  
  const manager = new PromptManager({ storage });
  await manager.initialize();
  
  // Register built-in prompts
  for (const [name, prompt] of Object.entries(BUILTIN_PROMPTS)) {
    await manager.register(name, prompt.template, {
      variables: prompt.variables,
      description: prompt.description,
    });
  }
  
  return manager;
}
