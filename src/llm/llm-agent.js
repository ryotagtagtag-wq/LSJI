/**
 * LLM Agent
 * 
 * Production-grade LLM-based agent with ReAct pattern, tools, memory,
 * HITL approval, budget control, and durability.
 */

import { createProvider } from './providers/base.js';
import { createToolRegistry } from './tools/registry.js';
import { createConversationMemory } from './memory/conversation.js';
import { createSemanticMemory } from './memory/semantic.js';
import { createEpisodicMemory } from './memory/episodic.js';
import { createPromptManager } from './prompt-manager.js';
import { createExecutionEngine } from '../execution/engine.js';
import { createApprovalGate } from '../execution/hitl/approval-gate.js';
import { createBudgetController } from '../execution/budget/index.js';
import { createIdempotencyStore } from '../execution/idempotency.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * LLM Agent Configuration
 * @typedef {Object} LLMAgentConfig
 * @property {Object} llm - LLM provider config { provider, model, apiKey, ... }
 * @property {Object} [tools] - Tool registry config
 * @property {Object} [memory] - Memory config { conversation, semantic, episodic }
 * @property {Object} [execution] - Execution engine config
 * @property {Object} [hitl] - HITL approval config
 * @property {Object} [budget] - Budget control config
 * @property {Object} [idempotency] - Idempotency config
 * @property {Object} [prompts] - Prompt manager config
 * @property {string} [sessionId] - Session ID for conversation memory
 */

/**
 * LLM Agent - Main agent class
 */
export class LLMAgent {
  constructor(config = {}) {
    this.config = config;
    this.llm = null;
    this.tools = null;
    this.memory = {};
    this.execution = null;
    this.hitl = null;
    this.budget = null;
    this.idempotency = null;
    this.promptManager = null;
    this.initialized = false;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    if (this.initialized) return;
    
    // Initialize LLM provider
    this.llm = await createProvider(this.config.llm || { provider: 'openai', model: 'gpt-4o-mini' });
    
    // Validate LLM
    const valid = await this.llm.validate();
    if (!valid.valid) {
      throw new Error(`LLM validation failed: ${valid.error}`);
    }
    
    // Get storage config
    const storageConfig = this.config.storage || { type: 'sqlite', options: {} };
    
    // Initialize tool registry
    this.tools = createToolRegistry({
      idempotencyStore: this.idempotency,
      approvalGate: this.hitl,
    });
    
    // Initialize memory systems
    if (this.config.memory?.conversation !== false) {
      this.memory.conversation = await createConversationMemory({
        ...this.config.memory?.conversation,
        storage: storageConfig
      });
      await this.memory.conversation.startSession(this.config.sessionId);
    }
    
    if (this.config.memory?.semantic) {
      this.memory.semantic = await createSemanticMemory({
        ...this.config.memory.semantic,
        storage: storageConfig
      });
    }
    
    if (this.config.memory?.episodic) {
      this.memory.episodic = await createEpisodicMemory({
        ...this.config.memory.episodic,
        storage: storageConfig
      });
    }
    
    // Initialize execution engine
    this.execution = await createExecutionEngine({
      ...this.config.execution,
      storage: storageConfig
    });
    
    // Initialize HITL
    if (this.config.hitl?.enabled !== false) {
      this.hitl = await createApprovalGate({
        ...this.config.hitl,
        store: storageConfig
      });
      // Update tool registry with HITL
      this.tools.approvalGate = this.hitl;
    }
    
    // Initialize budget
    this.budget = createBudgetController(this.config.budget);
    
    // Initialize idempotency
    this.idempotency = await createIdempotencyStore({
      ...this.config.idempotency,
      ...storageConfig
    });
    this.tools.idempotencyStore = this.idempotency;
    
    // Initialize prompt manager
    this.promptManager = await createPromptManager(this.config.prompts);
    
    this.initialized = true;
  }

  /**
   * Run the agent on a task
   */
  async run(task, options = {}) {
    await this.initialize();
    
    const runId = options.runId || `run_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const budgetId = options.budgetId || runId;
    const checkpointId = options.checkpointId;
    const hitlRequired = options.hitlRequired || [];
    const maxSteps = options.maxSteps || 50;
    
    // Start episodic memory
    let episodeId = null;
    if (this.memory.episodic) {
      episodeId = await this.memory.episodic.startEpisode(task, { runId, options });
    }
    
    // Get system prompt
    const systemPrompt = await this.promptManager.render('system:react', {
      tools: JSON.stringify(this.tools.getDefinitions(), null, 2),
      task,
    });
    
    // Build initial messages
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: task },
    ];
    
    // Add conversation history if available
    if (this.memory.conversation) {
      const history = await this.memory.conversation.getMessagesForLLM(50000);
      messages.splice(1, 0, ...history);
    }
    
    let step = 0;
    let finalAnswer = null;
    
    try {
      while (step < maxSteps) {
        step++;
        
        // Check budget before each step
        const budgetCheck = await this.budget.checkBudget(budgetId, 0, 0);
        if (!budgetCheck.allowed) {
          throw new Error(`Budget exceeded: ${budgetCheck.errors.map(e => e.type).join(', ')}`);
        }
        
        // Generate response
        const response = await this.llm.generate(messages, {
          tools: this.tools.getDefinitions(),
          toolChoice: 'auto',
          temperature: 0.7,
          maxTokens: 4096,
        });
        

        // Record token usage
        if (this.memory.episodic) {
          this.memory.episodic.recordTokens(response.usage?.totalTokens || 0);
        }
        this.budget.recordCost({
          budgetId,
          ...response.usage,
          model: this.llm.getModel(),
          provider: this.config.llm?.provider || 'openai',
          cost: this.llm.calculateCost?.(response.usage) || 0,
        });
        
        // Add assistant message
        messages.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls,
        });
        
        if (this.memory.conversation) {
          await this.memory.conversation.addMessage(messages[messages.length - 1]);
        }
        
        // Check for tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);
            
            // Check if tool requires HITL
            const tool = this.tools.get(toolName);
            if (tool?.requiresApproval && hitlRequired.includes(toolName)) {
              // Request approval
              try {
                await this.hitl.requestApproval({
                  action: toolName,
                  context: { params: toolArgs, runId },
                  requester: 'agent',
                });
              } catch (error) {
                // Approval denied or timeout
                const errorMsg = `Tool ${toolName} requires approval: ${error.message}`;
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: errorMsg,
                });
                continue;
              }
            }
            
            // Execute tool
            let result;
            try {
              result = await this.tools.execute(toolName, toolArgs, { runId, budgetId });
            } catch (error) {
              result = { error: error.message };
            }
            
            // Record tool execution in episodic memory
            if (this.memory.episodic) {
              await this.memory.episodic.addStep({
                type: 'tool',
                tool: toolName,
                params: toolArgs,
                result,
              });
            }
            
            // Add tool result
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
            
            if (this.memory.conversation) {
              await this.memory.conversation.addMessage(messages[messages.length - 1]);
            }
          }
          
          // Continue loop for next LLM call
          continue;
        }
        
        // No tool calls - check if final answer
        // Don't treat empty/whitespace-only content as final answer
        const hasContent = response.content && response.content.trim().length > 0;
        const isReActFormat = response.content && (response.content.includes('THOUGHT:') || response.content.includes('ACTION:'));
        const isFinalAnswer = hasContent && !isReActFormat;
        
        if (isFinalAnswer) {
          finalAnswer = response.content;
          break;
        }
        
        // Parse ReAct format if present (THOUGHT: or ACTION:)
        if (isReActFormat) {
          // This is a ReAct formatted response without tool calls
          // Check if it contains a final answer indicator
          if (response.content.includes('FINAL ANSWER:') || response.content.includes('Final Answer:')) {
            // Extract the final answer part
            const finalAnswerMatch = response.content.match(/(?:FINAL ANSWER:|Final Answer:)\s*(.+)/i);
            if (finalAnswerMatch) {
              finalAnswer = finalAnswerMatch[1].trim();
              break;
            }
          }
          // Continue to next iteration for more ReAct steps
          continue;
        }
        
        // Skip empty responses
        if (!hasContent) {
          continue;
        }
        
        // Default: treat as final answer
        finalAnswer = response.content;
        break;
      }
      
      // End episode
      if (this.memory.episodic) {
        await this.memory.episodic.endEpisode(finalAnswer ? 'success' : 'partial', { answer: finalAnswer, steps: step });
      }
      
      return {
        success: !!finalAnswer,
        answer: finalAnswer,
        runId,
        steps: step,
        budget: this.budget.getStatus(budgetId),
      };
      
    } catch (error) {
      if (this.memory.episodic) {
        await this.memory.episodic.endEpisode('failure', { error: error.message, steps: step });
      }
      throw error;
    }
  }

  /**
   * Run with durability (checkpointing)
   */
  async runDurable(task, options = {}) {
    await this.initialize();
    
    const workflowId = options.workflowId || `workflow_${Date.now()}`;
    
    return this.execution.execute({
      id: workflowId,
      name: task,
      execute: async (context) => {
        return this.run(task, { ...options, ...context });
      },
    }, {
      workflowId,
      checkpointEvery: options.checkpointEvery || 3,
      idempotencyKey: options.idempotencyKey,
      resumeFrom: options.resumeFrom,
    });
  }

  /**
   * Resume from checkpoint
   */
  async resume(checkpointId) {
    await this.initialize();
    return this.execution.execute({ id: 'resume', execute: async () => {} }, { resumeFrom: checkpointId });
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      llm: this.llm?.getModel(),
      tools: this.tools?.getAll().map(t => t.name) || [],
      memory: {
        conversation: this.memory.conversation?.getSummary(),
        semantic: this.memory.semantic ? 'enabled' : 'disabled',
        episodic: this.memory.episodic ? 'enabled' : 'disabled',
      },
      budget: this.budget?.getStatus(),
      hitl: this.hitl ? 'enabled' : 'disabled',
    };
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.memory.conversation) {
      await this.memory.conversation.clear();
    }
    if (this.execution?.storage) {
      await this.execution.storage.close();
    }
    this.initialized = false;
  }
}

/**
 * Create LLM agent from config
 */
export async function createLLMAgent(config = {}) {
  const agent = new LLMAgent(config);
  await agent.initialize();
  return agent;
}
