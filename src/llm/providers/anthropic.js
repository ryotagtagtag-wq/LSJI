/**
 * Anthropic Provider Implementation
 * 
 * Supports Anthropic API (Claude 3.5 Sonnet, Haiku, Opus, etc.)
 */

import { LLMProvider } from './base.js';

// Anthropic pricing (USD per 1M tokens) - as of 2026
const PRICING = {
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.25, output: 1.25 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};

export class AnthropicProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      model: config.model || 'claude-3-5-haiku-20241022',
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      baseUrl: config.baseUrl || 'https://api.anthropic.com',
      defaultParams: config.defaultParams || {},
    });
    
    this.pricing = PRICING[this.model] || PRICING['claude-3-5-haiku-20241022'];
    this.client = null;
  }

  /**
   * Lazy-load Anthropic client
   */
  async getClient() {
    if (!this.client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      this.client = new Anthropic({
        apiKey: this.apiKey,
        baseURL: this.baseUrl,
      });
    }
    return this.client;
  }

  /**
   * Generate completion from Anthropic
   */
  async generate(messages, options = {}) {
    const client = await this.getClient();
    
    // Separate system message from conversation
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    const params = {
      model: this.model,
      messages: this.formatMessages(conversationMessages),
      system: systemMessage?.content,
      temperature: options.temperature ?? this.defaultParams.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.defaultParams.maxTokens ?? 4096,
      ...this.defaultParams,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = this.formatTools(options.tools);
      params.tool_choice = options.toolChoice || 'auto';
    }

    const response = await client.messages.create(params);
    
    return this.parseResponse(response);
  }

  /**
   * Generate streaming completion
   */
  async *generateStream(messages, options = {}) {
    const client = await this.getClient();
    
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    const params = {
      model: this.model,
      messages: this.formatMessages(conversationMessages),
      system: systemMessage?.content,
      temperature: options.temperature ?? this.defaultParams.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.defaultParams.maxTokens ?? 4096,
      stream: true,
      ...this.defaultParams,
    };

    if (options.tools && options.tools.length > 0) {
      params.tools = this.formatTools(options.tools);
      params.tool_choice = options.toolChoice || 'auto';
    }

    const stream = await client.messages.stream(params);
    
    for await (const chunk of stream) {
      yield this.parseStreamChunk(chunk);
    }
  }

  /**
   * Format messages for Anthropic API
   */
  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }

  /**
   * Format tools for Anthropic API
   */
  formatTools(tools) {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Parse Anthropic response
   */
  parseResponse(response) {
    const content = response.content.find(c => c.type === 'text');
    const toolCalls = response.content
      .filter(c => c.type === 'tool_use')
      .map(c => ({
        id: c.id,
        type: 'function',
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input),
        },
      }));

    return {
      content: content?.text || '',
      toolCalls,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
      finishReason: response.stop_reason,
      model: response.model,
    };
  }

  /**
   * Parse streaming chunk
   */
  parseStreamChunk(chunk) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      return {
        content: chunk.delta.text,
        toolCalls: [],
        usage: null,
        finishReason: null,
      };
    }
    
    if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
      return {
        content: '',
        toolCalls: [{
          id: chunk.content_block.id,
          type: 'function',
          function: {
            name: chunk.content_block.name,
            arguments: JSON.stringify(chunk.content_block.input),
          },
        }],
        usage: null,
        finishReason: null,
      };
    }
    
    if (chunk.type === 'message_delta') {
      return {
        content: '',
        toolCalls: [],
        usage: chunk.usage ? {
          inputTokens: chunk.usage.input_tokens || 0,
          outputTokens: chunk.usage.output_tokens || 0,
          totalTokens: (chunk.usage.input_tokens || 0) + (chunk.usage.output_tokens || 0),
        } : null,
        finishReason: chunk.delta?.stop_reason,
      };
    }

    return { content: '', toolCalls: [], usage: null, finishReason: null };
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
    if (!this.apiKey) {
      return { valid: false, error: 'Anthropic API key is required' };
    }
    
    try {
      const client = await this.getClient();
      await client.messages.create({
        model: this.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }
}
