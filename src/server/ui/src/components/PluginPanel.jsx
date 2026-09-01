import React from 'react';

function PluginPanel({ plugins }) {
  if (!plugins || plugins.length === 0) {
    return (
      <div className="empty-state" style={{height: '100%'}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p>No plugins loaded</p>
        <p style={{fontSize: '12px'}}>Drop .js files in lsji-plugins/ directory</p>
      </div>
    );
  }

  return (
    <div className="plugin-list">
      {plugins.map(plugin => (
        <div key={plugin.name} className="plugin-card">
          <div className="plugin-info">
            <span className="plugin-name">{plugin.name}</span>
            <span className="plugin-version">v{plugin.version}</span>
            <span className="plugin-tools">{plugin.toolCount || 0} tools</span>
          </div>
          <span style={{fontSize: '11px', color: 'var(--text-secondary)'}}>Enabled</span>
        </div>
      ))}
    </div>
  );
}

export default PluginPanel;
