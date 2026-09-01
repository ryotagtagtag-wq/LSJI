/**
 * Token Counter
 * 
 * Tracks token usage across different LLM providers with accurate counting.
 */

import { createProvider } from '../../llm/providers/base.js';

/**
 * Token usage record
 * @typedef {Object} TokenUsage
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 * @property {string} model
 * @property {string} provider
 * @property {Date} timestamp
 */

/**
 * Token Counter - Tracks and estimates token usage
 */
export class TokenCounter {
  constructor() {
    this.usageHistory = [];
    this.providerCache = new Map();
  }

  /**
   * Get or create provider instance for token estimation
   */
  async getProvider(config) {
    const key = `${config.provider}:${config.model}`;
    if (!this.providerCache.has(key)) {
      const provider = await createProvider(config);
      this.providerCache.set(key, provider);
    }
    return this.providerCache.get(key);
  }

  /**
   * Estimate tokens for messages using provider's tokenizer
   */
  async estimateTokens(messages, providerConfig) {
    const provider = await this.getProvider(providerConfig);
    return provider.estimateTokens(messages);
  }

  /**
   * Record actual token usage from a completion
   */
  recordUsage(usage) {
    const record = {
      ...usage,
      timestamp: new Date(),
    };
    this.usageHistory.push(record);
    return record;
  }

  /**
   * Get total tokens used in a time range
   */
  getTotalTokens(since = null) {
    let filtered = this.usageHistory;
    if (since) {
      filtered = this.usageHistory.filter(u => u.timestamp >= since);
    }
    return filtered.reduce((sum, u) => sum + (u.totalTokens || 0), 0);
  }

  /**
   * Get tokens by model
   */
  getTokensByModel(since = null) {
    let filtered = this.usageHistory;
    if (since) {
      filtered = this.usageHistory.filter(u => u.timestamp >= since);
    }
    
    const byModel = {};
    for (const u of filtered) {
      const model = u.model || 'unknown';
      if (!byModel[model]) {
        byModel[model] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, count: 0 };
      }
      byModel[model].inputTokens += u.inputTokens || 0;
      byModel[model].outputTokens += u.outputTokens || 0;
      byModel[model].totalTokens += u.totalTokens || 0;
      byModel[model].count += 1;
    }
    return byModel;
  }

  /**
   * Get tokens by provider
   */
  getTokensByProvider(since = null) {
    let filtered = this.usageHistory;
    if (since) {
      filtered = this.usageHistory.filter(u => u.timestamp >= since);
    }
    
    const byProvider = {};
    for (const u of filtered) {
      const provider = u.provider || 'unknown';
      if (!byProvider[provider]) {
        byProvider[provider] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, count: 0 };
      }
      byProvider[provider].inputTokens += u.inputTokens || 0;
      byProvider[provider].outputTokens += u.outputTokens || 0;
      byProvider[provider].totalTokens += u.totalTokens || 0;
      byProvider[provider].count += 1;
    }
    return byProvider;
  }

  /**
   * Get usage history
   */
  getHistory(limit = 100) {
    return this.usageHistory.slice(-limit);
  }

  /**
   * Clear history
   */
  clear() {
    this.usageHistory = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(since = null) {
    let filtered = this.usageHistory;
    if (since) {
      filtered = this.usageHistory.filter(u => u.timestamp >= since);
    }
    
    const total = filtered.reduce((sum, u) => sum + (u.totalTokens || 0), 0);
    const input = filtered.reduce((sum, u) => sum + (u.inputTokens || 0), 0);
    const output = filtered.reduce((sum, u) => sum + (u.outputTokens || 0), 0);
    
    return {
      totalRequests: filtered.length,
      totalTokens: total,
      inputTokens: input,
      outputTokens: output,
      byModel: this.getTokensByModel(since),
      byProvider: this.getTokensByProvider(since),
    };
  }
}

/**
 * Global token counter instance
 */
export const globalTokenCounter = new TokenCounter();
