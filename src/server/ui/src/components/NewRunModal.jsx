import React, { useState } from 'react';

function NewRunModal({ onClose, onStart }) {
  const [task, setTask] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [maxCost, setMaxCost] = useState(10);
  const [maxTokens, setMaxTokens] = useState(100000);
  const [hitlEnabled, setHitlEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="local">Local (Ollama)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <input
                type="text"
                className="form-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
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
