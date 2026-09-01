import React from 'react';

function ThoughtLog({ thoughts }) {
  if (thoughts.length === 0) {
    return (
      <div className="empty-state" style={{height: '100%'}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          <path d="M15 5l5 5"/>
        </svg>
        <p>No thoughts yet. Start a run to see the agent's thinking process.</p>
      </div>
    );
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'thought': return '💭';
      case 'action': return '⚡';
      case 'observation': return '👁';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  return (
    <div className="thought-log">
      {thoughts.slice().reverse().map((thought, index) => (
        <div key={`${thought.id || index}-${thought.timestamp}`} className="thought-entry">
          <div className="thought-header">
            <span className={`thought-type ${thought.type}`}>
              {getTypeIcon(thought.type)} {thought.type.toUpperCase()}
            </span>
            <span>{new Date(thought.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="thought-content">{thought.content}</div>
          {thought.tool && (
            <div className="thought-tool">
              <strong>Tool:</strong> {thought.tool.name} 
              {thought.tool.args && <span> | Args: {JSON.stringify(thought.tool.args).slice(0, 100)}</span>}
              {thought.tool.result !== undefined && <span> | Result: {JSON.stringify(thought.tool.result).slice(0, 100)}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ThoughtLog;
