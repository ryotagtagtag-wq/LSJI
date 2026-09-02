import React, { useState, useEffect } from 'react';

// Model definitions per provider (as of 2024)
const MODELS_BY_PROVIDER = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Latest)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Default)' },
    { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B' },
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
    { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking (Experimental)' },
  ],
  local: [
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'codellama', label: 'Code Llama' },
    { value: 'qwen2.5', label: 'Qwen 2.5' },
    { value: 'phi3.5', label: 'Phi 3.5' },
  ],
};

// Default models per provider
const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  local: 'llama3.2',
};

function NewRunModal({ onClose, onStart }) {
  const [task, setTask] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [provider, setProvider] = useState('gemini'); // Default to Gemini
  const [model, setModel] = useState(DEFAULT_MODELS.gemini);
  const [maxCost, setMaxCost] = useState(10);
  const [maxTokens, setMaxTokens] = useState(100000);
  const [hitlEnabled, setHitlEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Update model when provider changes
  useEffect(() => {
    setModel(DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini);
  }, [provider]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!task.trim()) return;
    
    setSubmitting(true);
    try {
      await onStart({
        task: task.trim(),
        workflowId: workflowId.trim() || undefined,
        llm: { provider, model },
        budget: { maxCostPerRun: maxCost, maxTokensPerRun: maxTokens },
        hitl: { enabled: hitlEnabled },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const currentModels = MODELS_BY_PROVIDER[provider] || MODELS_BY_PROVIDER.gemini;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create New Agent Run</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Task Description *</label>
            <textarea
              className="form-textarea"
              placeholder="Describe the task for the agent to complete..."
              value={task}
              onChange={(e) => setTask(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Workflow ID (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Auto-generated if empty"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">LLM Provider</label>
              <select className="form-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="local">Local (Ollama)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <select className="form-select" value={model} onChange={(e) => setModel(e.target.value)}>
                {currentModels.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Max Cost ($)</label>
              <input
                type="number"
                className="form-input"
                value={maxCost}
                onChange={(e) => setMaxCost(parseFloat(e.target.value) || 0)}
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Tokens</label>
              <input
                type="number"
                className="form-input"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                min="1000"
                step="1000"
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}>
              <input
                type="checkbox"
                checked={hitlEnabled}
                onChange={(e) => setHitlEnabled(e.target.checked)}
              />
              <span>Enable HITL (Human-in-the-Loop) approvals</span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting || !task.trim()}>
              {submitting ? 'Starting...' : 'Start Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewRunModal;
