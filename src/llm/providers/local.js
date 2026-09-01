/**
 * Local LLM Provider (Ollama, LM Studio, etc.)
 * 
 * Supports OpenAI-compatible local endpoints
 */

import { LLMProvider } from './base.js';

export class LocalProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      model: config.model || 'llama3.1',
      apiKey: config.apiKey || 'ollama', // dummy key for Ollama
      baseUrl: config.baseUrl || 'http://localhost:11434/v1',
      defaultParams: config.defaultParams || {},
    });
    
    this.client = null;
    // Local models are free (no API cost)
    this.pricing = { input: 0, output: 0 };
  }

  /**
   * Lazy-load OpenAI-compatible client
   */
  async getClient() {
    if (!this.client) {
      const { default: OpenAI } = await import('openai');
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
      });
    }
    return this.client;
  }

  /**
   * Generate completion from local LLM
   */
  async generate(messages, options = {}) {
    const client = await this.getClient();
    
    const params = {
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? this.defaultParams.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.defaultParams.maxTokens ?? 4096,
      ...this.defaultParams,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      params.tool_choice = options.toolChoice || 'auto';
    }

    const response = await client.chat.completions.create(params);
    
    return {
      content: response.choices[0]?.message?.content || '',
      toolCalls: response.choices[0]?.message?.tool_calls || [],
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: response.choices[0]?.finish_reason,
      model: response.model,
    };
  }

  /**
   * Generate streaming completion
   */
  async *generateStream(messages, options = {}) {
    const client = await this.getClient();
    
    const params = {
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? this.defaultParams.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.defaultParams.maxTokens ?? 4096,
      stream: true,
      ...this.defaultParams,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
      params.tool_choice = options.toolChoice || 'auto';
    }

    const stream = await client.chat.completions.create(params);
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      yield {
        content: delta?.content || '',
        toolCalls: delta?.tool_calls || [],
        usage: chunk.usage ? {
          inputTokens: chunk.usage.prompt_tokens || 0,
          outputTokens: chunk.usage.completion_tokens || 0,
          totalTokens: chunk.usage.total_tokens || 0,
        } : null,
        finishReason: chunk.choices[0]?.finish_reason,
      };
    }
  }

  /**
   * Calculate cost (free for local)
   */
  calculateCost(usage) {
    return 0;
  }

  /**
   * Get pricing info
   */
  getPricing() {
    return { input: 0, output: 0 };
  }

  /**
   * Check if provider supports function calling
   */
  supportsTools() {
    // Depends on the model, assume yes for modern models
    return true;
  }

  /**
   * Check if provider supports streaming
   */
  supportsStreaming() {
    return true;
  }

  /**
   * Validate configuration
   */
  async validate() {
    try {
      const client = await this.getClient();
      await client.models.list();
      return { valid: true };
    } catch (e) {
      return { valid: false, error: `Cannot connect to local LLM at ${this.baseUrl}: ${e.message}` };
    }
  }
}
