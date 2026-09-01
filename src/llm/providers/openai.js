/**
 * OpenAI Provider Implementation
 * 
 * Supports OpenAI API (GPT-4, GPT-3.5, etc.)
 * Compatible with OpenAI-compatible endpoints (e.g., Azure, local proxies)
 */

import { LLMProvider } from './base.js';

// OpenAI pricing (USD per 1M tokens) - as of 2026
const PRICING = {
  'gpt-4o': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
};

export class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      model: config.model || 'gpt-4o-mini',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      defaultParams: config.defaultParams || {},
    });
    
    this.pricing = PRICING[this.model] || PRICING['gpt-4o-mini'];
    this.client = null;
  }

  /**
   * Lazy-load OpenAI client
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
   * Generate completion from OpenAI
   */
  async generate(messages, options = {}) {
    const client = await this.getClient();
    
    const params = {
      model: this.model,
      messages: this.formatMessages(messages),
      temperature: options.temperature ?? this.defaultParams.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.defaultParams.maxTokens ?? 4096,
      ...this.defaultParams,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = this.formatTools(options.tools);
      params.tool_choice = options.toolChoice || 'auto';
    }

    const response = await client.chat.completions.create(params);
    
    return this.parseResponse(response);
  }

  /**
   * Generate streaming completion
   */
  async *generateStream(messages, options = {}) {
    const client = await this.getClient();
    
    const params = {
      model: this.model,
      messages: this.formatMessages(messages),
      temperature: options.temperature ?? this.defaultParams.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.defaultParams.maxTokens ?? 4096,
      stream: true,
      ...this.defaultParams,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = this.formatTools(options.tools);
      params.tool_choice = options.toolChoice || 'auto';
    }

    const stream = await client.chat.completions.create(params);
    
    for await (const chunk of stream) {
      yield this.parseStreamChunk(chunk);
    }
  }

  /**
   * Format messages for OpenAI API
   */
  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      tool_call_id: msg.tool_call_id,
      tool_calls: msg.tool_calls,
    }));
  }

  /**
   * Format tools for OpenAI API
   */
  formatTools(tools) {
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
   * Parse OpenAI response
   */
  parseResponse(response) {
    const choice = response.choices[0];
    const message = choice.message;
    
    return {
      content: message.content || '',
      toolCalls: message.tool_calls || [],
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: choice.finish_reason,
      model: response.model,
    };
  }

  /**
   * Parse streaming chunk
   */
  parseStreamChunk(chunk) {
    const choice = chunk.choices[0];
    const delta = choice.delta;
    
    return {
      content: delta.content || '',
      toolCalls: delta.tool_calls || [],
      usage: chunk.usage ? {
        inputTokens: chunk.usage.prompt_tokens || 0,
        outputTokens: chunk.usage.completion_tokens || 0,
        totalTokens: chunk.usage.total_tokens || 0,
      } : null,
      finishReason: choice.finish_reason,
    };
  }

  /**
   * Calculate cost for usage
   */
  calculateCost(usage) {
    const inputCost = (usage.inputTokens / 1_000_000) * this.pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * this.pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Get pricing info for current model
   */
  getPricing() {
    return { ...this.pricing };
  }

  /**
   * Check if provider supports function calling
   */
  supportsTools() {
    // Most OpenAI models support function calling
    return !this.model.includes('o1-mini') && !this.model.includes('o1-preview');
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
    if (!this.apiKey) {
      return { valid: false, error: 'OpenAI API key is required' };
    }
    
    try {
      const client = await this.getClient();
      await client.models.list();
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
}
