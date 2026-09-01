/**
 * Google Gemini Provider
 * 
 * Implements LLMProvider interface for Google's Gemini API.
 * Supports function calling, streaming, and token counting.
 */

import { LLMProvider } from './base.js';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Gemini Provider
 */
export class GeminiProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
    this.apiVersion = config.apiVersion || 'v1beta';
  }

  /**
   * Generate completion from Gemini
   */
  async generate(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 4096, tools, toolChoice = 'auto' } = options;

    // Convert messages to Gemini format
    const contents = this.convertMessages(messages);
    const systemInstruction = this.extractSystemInstruction(messages);

    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40,
      },
    };

    // Add system instruction if present
    if (systemInstruction) {
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = [{ functionDeclarations: this.convertTools(tools) }];
      requestBody.toolConfig = { functionCallingConfig: { mode: this.convertToolChoice(toolChoice) } };
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  /**
   * Generate streaming completion
   */
  async *generateStream(messages, options = {}) {
    const { temperature = 0.7, maxTokens = 4096, tools, toolChoice = 'auto' } = options;

    const contents = this.convertMessages(messages);
    const systemInstruction = this.extractSystemInstruction(messages);

    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (tools && tools.length > 0) {
      requestBody.tools = [{ functionDeclarations: this.convertTools(tools) }];
      requestBody.toolConfig = { functionCallingConfig: { mode: this.convertToolChoice(toolChoice) } };
    }

    const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} - ${error.error?.message || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') return;
          try {
            const chunk = JSON.parse(jsonStr);
            const parsed = this.parseStreamChunk(chunk);
            if (parsed) yield parsed;
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  }

  /**
   * Convert messages to Gemini format
   */
  convertMessages(messages) {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '' }],
      }));
  }

  /**
   * Extract system instruction from messages
   */
  extractSystemInstruction(messages) {
    const systemMsg = messages.find(m => m.role === 'system');
    return systemMsg?.content || null;
  }

  /**
   * Convert OpenAI-style tools to Gemini function declarations
   */
  convertTools(tools) {
    return tools
      .filter(t => t.type === 'function')
      .map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }));
  }

  /**
   * Convert tool choice to Gemini mode
   */
  convertToolChoice(choice) {
    switch (choice) {
      case 'none': return 'NONE';
      case 'required': return 'ANY';
      case 'auto':
      default: return 'AUTO';
    }
  }

  /**
   * Parse full response
   */
  parseResponse(data) {
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No candidate in Gemini response');
    }

    const content = candidate.content?.parts?.[0]?.text || '';
    const toolCalls = this.extractToolCalls(candidate);
    const usage = data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount || 0,
      completionTokens: data.usageMetadata.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata.totalTokenCount || 0,
    } : null;

    return {
      content,
      toolCalls,
      usage,
      model: this.model,
      provider: 'gemini',
    };
  }

  /**
   * Parse streaming chunk
   */
  parseStreamChunk(data) {
    const candidate = data.candidates?.[0];
    if (!candidate) return null;

    const delta = candidate.content?.parts?.[0]?.text || '';
    const toolCalls = this.extractToolCalls(candidate);

    return {
      content: delta,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  }

  /**
   * Extract tool calls from candidate
   */
  extractToolCalls(candidate) {
    const functionCalls = candidate.content?.parts
      ?.filter(p => p.functionCall)
      .map(p => p.functionCall) || [];

    return functionCalls.map((fc, i) => ({
      id: `call_${Date.now()}_${i}`,
      type: 'function',
      function: {
        name: fc.name,
        arguments: JSON.stringify(fc.args || {}),
      },
    }));
  }

  /**
   * Calculate estimated cost
   */
  calculateCost(usage) {
    if (!usage) return 0;

    // Approximate pricing (as of 2024) - update as needed
    const pricing = {
      'gemini-1.5-flash': { input: 0.075, output: 0.30 }, // per 1M tokens
      'gemini-1.5-pro': { input: 3.50, output: 10.50 },
      'gemini-2.0-flash': { input: 0.075, output: 0.30 },
      'gemini-2.0-flash-lite': { input: 0.0375, output: 0.15 },
    };

    const modelPricing = pricing[this.model] || pricing['gemini-1.5-flash'];
    const inputCost = (usage.promptTokens / 1_000_000) * modelPricing.input;
    const outputCost = (usage.completionTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }

  /**
   * Validate configuration
   */
  async validate() {
    if (!this.apiKey) {
      return { valid: false, error: 'Gemini API key is required' };
    }

    // Quick validation call
    try {
      const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { valid: false, error: `Gemini validation failed: ${error.error?.message || response.statusText}` };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Gemini validation failed: ${error.message}` };
    }
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
   * More accurate token estimation for Gemini
   */
  estimateTokens(messages) {
    const text = messages.map(m => m.content || '').join(' ');
    // Gemini uses similar tokenization to other models
    return Math.ceil(text.length / 4);
  }
}
