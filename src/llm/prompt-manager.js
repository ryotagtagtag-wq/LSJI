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
    
    // Use the new storage interface
    if (typeof this.storage.exec === 'function') {
      await this.storage.exec(`
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
    if (typeof this.storage.run === 'function') {
      await this.storage.run(
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
    
    // Return latest version (highest semver)
    let latest = null;
    for (const [ver, prompt] of versions) {
      if (!latest || this.compareVersions(ver, latest) > 0) {
        latest = ver;
      }
    }
    return versions.get(latest);
  }

  /**
   * Get all versions of a prompt
   */
  async getAllVersions(name) {
    await this.initialize();
    const versions = this.templates.get(name);
    if (!versions) return [];
    return Array.from(versions.values());
  }

  /**
   * Render a template with variables
   */
  async render(name, variables = {}, version = null) {
    const prompt = await this.get(name, version);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}${version ? `@${version}` : ''}`);
    }
    
    let rendered = prompt.template;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    
    // Check for missing variables
    const missingVars = prompt.variables.filter(v => !(v in variables));
    if (missingVars.length > 0) {
      console.warn(`Missing variables for prompt ${name}: ${missingVars.join(', ')}`);
    }
    
    return rendered;
  }

  /**
   * Extract variables from template
   */
  extractVariables(template) {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  }

  /**
   * Compare semantic versions
   */
  compareVersions(a, b) {
    const parse = v => v.split('.').map(Number);
    const [aMajor, aMinor, aPatch] = parse(a);
    const [bMajor, bMinor, bPatch] = parse(b);
    if (aMajor !== bMajor) return aMajor - bMajor;
    if (aMinor !== bMinor) return aMinor - bMinor;
    return aPatch - bPatch;
  }

  /**
   * Load all prompts from storage
   */
  async loadFromStorage() {
    await this.initialize();
    
    if (typeof this.storage.all === 'function') {
      const rows = await this.storage.all(
        'SELECT * FROM prompts ORDER BY name, version'
      );
      
      for (const row of rows) {
        const prompt = {
          name: row.name,
          version: row.version,
          template: row.template,
          variables: JSON.parse(row.variables),
          description: row.description,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
        
        if (!this.templates.has(prompt.name)) {
          this.templates.set(prompt.name, new Map());
        }
        this.templates.get(prompt.name).set(prompt.version, prompt);
      }
    }
  }
}

/**
 * Built-in prompt templates
 */
export const BUILTIN_PROMPTS = {
  'system:react': {
    name: 'system:react',
    version: '1.0.0',
    template: `You are an AI assistant that uses the ReAct (Reasoning + Acting) pattern.

You have access to the following tools:
{{tools}}

Your task is: {{task}}

Use the following format:

THOUGHT: Your reasoning about what to do next
ACTION: The tool to use (must be one of the available tools)
ACTION_INPUT: The parameters for the tool

When you have the final answer, respond directly without THOUGHT/ACTION format.

Begin!`,
    variables: ['tools', 'task'],
    description: 'System prompt for ReAct agent',
  },
};

/**
 * Create prompt manager from config
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
      version: prompt.version,
      variables: prompt.variables,
      description: prompt.description,
    });
  }
  
  return manager;
}
