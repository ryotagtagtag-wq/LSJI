/**
 * LSJI Tool Plugin System
 * 
 * Dynamic plugin loading for custom tools.
 * Plugins are JavaScript modules that export tool definitions.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Plugin definition
 * @typedef {Object} Plugin
 * @property {string} name - Plugin name
 * @property {string} version - Plugin version
 * @property {Object} tools - Object mapping tool names to tool definitions
 * @property {Function} [init] - Optional initialization function
 * @property {Function} [cleanup] - Optional cleanup function
 */

/**
 * Default plugin directories to scan
 */
const DEFAULT_PLUGIN_DIRS = [
  resolve(process.cwd(), 'lsji-plugins'),
  resolve(__dirname, '../../plugins'),
  resolve(process.cwd(), '.lsji/plugins'),
];

/**
 * Load plugins from directory
 * @param {string|string[]} pluginPaths - Paths to plugin directories or files
 * @returns {Promise<Object>} Map of toolName -> toolDefinition
 */
export async function loadPlugins(pluginPaths = []) {
  const allTools = {};
  const dirs = [...DEFAULT_PLUGIN_DIRS, ...(Array.isArray(pluginPaths) ? pluginPaths : [pluginPaths])];
  
  for (const dir of dirs) {
    try {
      const tools = await loadPluginDirectory(dir);
      Object.assign(allTools, tools);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to load plugins from ${dir}:`, error.message);
      }
    }
  }
  
  return allTools;
}

/**
 * Load all plugins from a directory
 */
async function loadPluginDirectory(dir) {
  const tools = {};
  
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return tools;
  }
  
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    
    const filePath = join(dir, entry.name);
    try {
      const plugin = await import(filePath);
      const pluginModule = plugin.default || plugin;
      
      if (pluginModule.tools) {
        for (const [name, definition] of Object.entries(pluginModule.tools)) {
          tools[name] = {
            ...definition,
            plugin: pluginModule.name || entry.name.replace('.js', ''),
          };
        }
      }
      
      if (pluginModule.init) {
        await pluginModule.init();
      }
    } catch (error) {
      console.warn(`Failed to load plugin ${filePath}:`, error.message);
    }
  }
  
  return tools;
}

/**
 * Create a plugin template
 */
export function createPluginTemplate(name) {
  return `/**
 * ${name} Plugin for LSJI
 * 
 * Drop this file in lsji-plugins/ directory to enable.
 */

export default {
  name: '${name}',
  version: '1.0.0',
  
  tools: {
    ${name}_example: {
      name: '${name}_example',
      description: 'Example tool from ${name} plugin',
      category: 'plugin',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Input parameter' },
        },
        required: ['input'],
      },
      requiresApproval: false,
      idempotent: true,
      async execute({ input }, context) {
        return { result: \`Processed: \${input}\`, plugin: '${name}' };
      },
    },
  },
  
  async init() {
    console.log('[${name}] Plugin initialized');
  },
  
  async cleanup() {
    console.log('[${name}] Plugin cleaned up');
  },
};
`;
}

/**
 * Plugin registry for runtime management
 */
export class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.tools = new Map();
  }
  
  register(plugin) {
    if (!plugin.name || !plugin.tools) {
      throw new Error('Plugin must have name and tools');
    }
    
    this.plugins.set(plugin.name, plugin);
    
    for (const [name, tool] of Object.entries(plugin.tools)) {
      this.tools.set(name, { ...tool, plugin: plugin.name });
    }
    
    if (plugin.init) {
      plugin.init();
    }
  }
  
  async unregister(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    
    if (plugin.cleanup) {
      await plugin.cleanup();
    }
    
    for (const toolName of Object.keys(plugin.tools)) {
      this.tools.delete(toolName);
    }
    
    this.plugins.delete(name);
    return true;
  }
  
  getTools() {
    return Object.fromEntries(this.tools);
  }
  
  getPlugin(name) {
    return this.plugins.get(name);
  }
  
  listPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      toolCount: Object.keys(p.tools).length,
    }));
  }
}

// Global registry
export const globalPluginRegistry = new PluginRegistry();
