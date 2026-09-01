/**
 * LLM Provider Base Interface
 * 
 * All LLM providers must implement this interface.
 * Provides a unified API for different LLM backends.
 */

export class LLMProvider {
  /**
   * @param {Object} config
   * @param {string} config.model - Model name
   * @param {string} [config.apiKey] - API key (for cloud providers)
   * @param {string} [config.baseUrl] - Base URL (for local/custom endpoints)
   * @param {Object} [config.defaultParams] - Default generation parameters
   */
  constructor(config = {}) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
    this.defaultParams = config.defaultParams || {};
  }

  /**
   * Generate a completion from the LLM
   * @param {Array<Object>} messages - Chat messages [{role, content}]
   * @param {Object} [options] - Generation options
   * @param {number} [options.temperature] - Sampling temperature
   * @param {number} [options.maxTokens] - Maximum tokens to generate
   * @param {Array<Object>} [options.tools] - Tool definitions
   * @param {string} [options.toolChoice] - Tool choice strategy
   * @returns {Promise<Object>} Response with content, toolCalls, usage
   */
  async generate(messages, options = {}) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Generate a completion with streaming
   * @param {Array<Object>} messages - Chat messages
   * @param {Object} [options] - Generation options
   * @returns {AsyncGenerator<Object>} Stream of response chunks
   */
  async *generateStream(messages, options = {}) {
    throw new Error('generateStream() must be implemented by subclass');
  }

  /**
   * Get the model name
   * @returns {string}
   */
  getModel() {
    return this.model;
  }

  /**
   * Estimate token count for messages (approximate)
   * @param {Array<Object>} messages
   * @returns {number} Estimated token count
   */
  estimateTokens(messages) {
    // Rough approximation: ~4 chars per token for English
    const text = messages.map(m => m.content || '').join(' ');
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if provider supports function calling
   * @returns {boolean}
   */
  supportsTools() {
    return false;
  }

  /**
   * Check if provider supports streaming
   * @returns {boolean}
   */
  supportsStreaming() {
    return false;
  }

  /**
   * Validate configuration
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validate() {
    return { valid: true };
  }
}

/**
 * Create provider instance from config
 * @param {Object} config - Provider configuration
 * @returns {Promise<LLMProvider>}
 */
export async function createProvider(config) {
  const { provider, ...options } = config;
  
  switch (provider) {
    case 'openai': {
      const { OpenAIProvider } = await import('./openai.js');
      return new OpenAIProvider(options);
    }
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic.js');
      return new AnthropicProvider(options);
    }
    case 'gemini': {
      const { GeminiProvider } = await import('./gemini.js');
      return new GeminiProvider(options);
    }
    case 'local':
    case 'ollama': {
      const { LocalProvider } = await import('./local.js');
      return new LocalProvider(options);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
