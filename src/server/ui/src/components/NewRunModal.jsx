import React, { useState, useEffect } from 'react';

// Fetch available models from Ollama
async function fetchLocalModels() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    if (res.ok) {
      const data = await res.json();
      return data.models?.map(m => ({ value: m.name, label: m.name })) || [];
    }
  } catch (e) {
    // Ollama not running
  }
  return [];
}

// Model definitions per provider (as of 2024 - from official API docs)
// Source: https://ai.google.dev/gemini-api/docs/models?hl=ja
const MODELS_BY_PROVIDER = {
  gemini: [
    // Current stable models (as of 2025)
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Stable) - Best Price/Performance' },
    { value: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro (Stable) - Best Reasoning' },
    { value: 'gemini-3.1-flash', label: 'Gemini 3.1 Flash (Preview)' },
    { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Preview)' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (Preview)' },
    // Legacy (deprecated)
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Deprecated)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deprecated)' },
  ],
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
  // Local models are fetched dynamically from Ollama
  local: [],
};

// Default models per provider
const DEFAULT_MODELS = {
  gemini: 'gemini-3.5-flash', // Current stable
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  local: 'llama3.2',
};

function NewRunModal({ onClose, onStart }) {
  const [task, setTask] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState(DEFAULT_MODELS.gemini);
  const [apiKey, setApiKey] = useState('');
  const [localModels, setLocalModels] = useState([]);
  const [maxCost, setMaxCost] = useState(10);
  const [maxTokens, setMaxTokens] = useState(100000);
  const [hitlEnabled, setHitlEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Update model when provider changes
  useEffect(() => {
    setModel(DEFAULT_MODELS[provider] || DEFAULT_MODELS.gemini);
  }, [provider]);

  // Fetch local models when provider is 'local'
  useEffect(() => {
    if (provider === 'local') {
      fetchLocalModels().then(models => {
        if (models.length > 0) {
          setLocalModels(models);
          setModel(models[0].value);
        }
      });
    }
  }, [provider]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!task.trim()) return;
    
    setSubmitting(true);
    try {
      await onStart({
        task: task.trim(),
        workflowId: workflowId.trim() || undefined,
        llm: { provider, model, apiKey: apiKey || undefined },
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

            {provider !== 'local' && (
              <div className="form-group">
                <label className="form-label">API Key (or set env var)</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder={provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <span className="form-hint">Leave empty to use environment variable</span>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Model</label>
              <select className="form-select" value={model} onChange={(e) => setModel(e.target.value)}>
                {(provider === 'local' ? localModels : currentModels).map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {provider === 'local' && localModels.length === 0 && (
                <span className="form-hint" style={{color: 'var(--warning)'}}>
                  No local models found. Make sure Ollama is running at http://localhost:11434
                </span>
              )}
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
