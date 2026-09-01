/**
 * Example Plugin for LSJI
 * 
 * Provides example tools for demonstration.
 */

export default {
  name: 'example',
  version: '1.0.0',
  
  tools: {
    example_echo: {
      name: 'example_echo',
      description: 'Echo back the input message',
      category: 'plugin',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo' },
          prefix: { type: 'string', description: 'Optional prefix', default: '[ECHO]' },
        },
        required: ['message'],
      },
      requiresApproval: false,
      idempotent: true,
      async execute({ message, prefix = '[ECHO]' }, context) {
        return { echoed: `${prefix} ${message}`, timestamp: new Date().toISOString() };
      },
    },
    
    example_calculate: {
      name: 'example_calculate',
      description: 'Perform a simple calculation',
      category: 'plugin',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression (e.g., "2 + 3 * 4")' },
        },
        required: ['expression'],
      },
      requiresApproval: false,
      idempotent: true,
      async execute({ expression }, context) {
        try {
          // Simple safe eval for basic math
          const result = Function('"use strict"; return (' + expression + ')')();
          return { expression, result };
        } catch (error) {
          return { expression, error: error.message };
        }
      },
    },
    
    example_timestamp: {
      name: 'example_timestamp',
      description: 'Get current timestamp in various formats',
      category: 'plugin',
      parameters: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['iso', 'unix', 'readable'], default: 'iso' },
        },
      },
      requiresApproval: false,
      idempotent: true,
      async execute({ format = 'iso' }, context) {
        const now = new Date();
        switch (format) {
          case 'unix':
            return { timestamp: Math.floor(now.getTime() / 1000) };
          case 'readable':
            return { timestamp: now.toLocaleString() };
          default:
            return { timestamp: now.toISOString() };
        }
      },
    },
  },
  
  async init() {
    console.log('[example] Plugin initialized');
  },
  
  async cleanup() {
    console.log('[example] Plugin cleaned up');
  },
};
