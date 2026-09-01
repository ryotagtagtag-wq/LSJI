import React from 'react';

function RunList({ runs, selectedRunId, onSelect, onStop }) {
  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (runs.length === 0) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-title">Active Runs</div>
        <div className="empty-state" style={{padding: '24px 8px'}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width: '32px', height: '32px'}}>
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 9h6M9 15h6M9 12h4"/>
          </svg>
          <p style={{fontSize: '12px'}}>No runs yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-section">
      <div className="sidebar-title">Active Runs ({runs.length})</div>
      <div className="run-list">
        {runs.map(run => (
          <div
            key={run.runId}
            className={`run-item ${selectedRunId === run.runId ? 'active' : ''}`}
            onClick={() => onSelect(run.runId)}
          >
            <div className="run-item-header">
              <span className="run-id">{run.runId.slice(0, 20)}...</span>
              <span className={`run-status ${run.status}`}>{run.status}</span>
            </div>
            <div className="run-task" title={run.task}>{run.task || 'No task'}</div>
            <div className="run-meta">
              <span>⏱ {formatDuration(run.duration)}</span>
              <span>🕐 {formatTime(run.startTime)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RunList;
