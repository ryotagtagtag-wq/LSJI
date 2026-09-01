import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import RunList from './components/RunList';
import ThoughtLog from './components/ThoughtLog';
import ApprovalQueue from './components/ApprovalQueue';
import BudgetPanel from './components/BudgetPanel';
import PluginPanel from './components/PluginPanel';
import NewRunModal from './components/NewRunModal';

function App() {
  const [socket, setSocket] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [thoughts, setThoughts] = useState([]);
  const [budget, setBudget] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [connected, setConnected] = useState(false);
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [activeTab, setActiveTab] = useState('thoughts'); // thoughts, approvals, budget, plugins

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('Connected to LSJI server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('Disconnected from LSJI server');
    });

    newSocket.on('init', (data) => {
      setRuns(data.runs || []);
      setApprovals(data.approvals || []);
      if (data.runs?.length > 0 && !selectedRunId) {
        setSelectedRunId(data.runs[0].runId);
        newSocket.emit('subscribe:run', data.runs[0].runId);
      }
    });

    newSocket.on('run:updated', (data) => {
      setRuns(prev => prev.map(r => 
        r.runId === data.runId ? { ...r, status: data.status, error: data.error, result: data.result } : r
      ));
    });

    newSocket.on('run:completed', (data) => {
      setRuns(prev => prev.map(r => 
        r.runId === data.runId ? { ...r, status: 'completed', result: data.result } : r
      ));
      // Fetch final thoughts for this run
      fetch(`/api/runs/${data.runId}`).then(res => res.json()).then(data => {
        if (data.thoughts) setThoughts(data.thoughts);
      });
    });

    newSocket.on('run:error', (data) => {
      setRuns(prev => prev.map(r => 
        r.runId === data.runId ? { ...r, status: 'error', error: data.error } : r
      ));
    });

    newSocket.on('run:stopped', (data) => {
      setRuns(prev => prev.map(r => 
        r.runId === data.runId ? { ...r, status: 'stopped' } : r
      ));
    });

    newSocket.on('thought:new', (data) => {
      if (data.runId === selectedRunId) {
        setThoughts(prev => [...prev, data]);
      }
    });

    newSocket.on('approval:new', (data) => {
      setApprovals(prev => [...prev, { ...data, runId: data.runId }]);
    });

    newSocket.on('approval:updated', (data) => {
      setApprovals(prev => prev.map(a => 
        a.id === data.approvalId ? { ...a, status: data.status } : a
      ));
    });

    newSocket.on('budget:updated', (data) => {
      setBudget(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [selectedRunId]);

  // Subscribe to run updates when selection changes
  useEffect(() => {
    if (socket && selectedRunId) {
      socket.emit('subscribe:run', selectedRunId);
      // Fetch run details
      fetch(`/api/runs/${selectedRunId}`)
        .then(res => res.json())
        .then(data => {
          if (data.thoughts) setThoughts(data.thoughts);
          if (data.budget) setBudget(data.budget);
        })
        .catch(console.error);
    }
  }, [socket, selectedRunId]);

  // Fetch approvals periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket) {
        fetch('/api/approvals')
          .then(res => res.json())
          .then(data => setApprovals(data.approvals || []))
          .catch(console.error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [socket]);

  // Fetch plugins
  useEffect(() => {
    fetch('/api/plugins')
      .then(res => res.json())
      .then(data => setPlugins(data.plugins || []))
      .catch(() => setPlugins([])); // Endpoint might not exist yet
  }, []);

  const handleStartRun = useCallback(async (config) => {
    if (!socket) return;
    
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.runId) {
        setShowNewRunModal(false);
        setSelectedRunId(data.runId);
        socket.emit('subscribe:run', data.runId);
      }
    } catch (error) {
      console.error('Failed to start run:', error);
    }
  }, [socket]);

  const handleApprove = useCallback(async (approvalId, reason) => {
    try {
      await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', reason }),
      });
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  }, []);

  const handleReject = useCallback(async (approvalId, reason) => {
    try {
      await fetch(`/api/approvals/${approvalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      });
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  }, []);

  const handleStopRun = useCallback(async (runId) => {
    try {
      await fetch(`/api/runs/${runId}/stop`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to stop run:', error);
    }
  }, []);

  const selectedRun = runs.find(r => r.runId === selectedRunId);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">LSJI</span>
          <span className="version">v0.3.0</span>
        </div>
        <div className="header-right">
          <div className="connection-status">
            <span className={`status-dot ${connected ? '' : 'disconnected'}`}></span>
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button className="btn primary" onClick={() => setShowNewRunModal(true)}>
            + New Run
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          <RunList 
            runs={runs} 
            selectedRunId={selectedRunId}
            onSelect={setSelectedRunId}
            onStop={handleStopRun}
          />
          
          <div className="sidebar-section">
            <div className="sidebar-title">Quick Actions</div>
            <button className="btn" style={{width: '100%', justifyContent: 'center'}} onClick={() => setShowNewRunModal(true)}>
              + Create New Run
            </button>
          </div>
        </aside>

        <div className="content">
          {selectedRun ? (
            <>
              <div className="content-header">
                <div>
                  <div className="content-title">{selectedRun.task || 'Untitled Task'}</div>
                  <div style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                    Run: <code>{selectedRun.runId}</code> | Workflow: <code>{selectedRun.workflowId}</code>
                  </div>
                </div>
                <div className="content-actions">
                  <span className={`run-status ${selectedRun.status}`}>{selectedRun.status}</span>
                  {selectedRun.status === 'running' && (
                    <button className="btn danger" onClick={() => handleStopRun(selectedRun.runId)}>
                      Stop
                    </button>
                  )}
                </div>
              </div>

              <div className="panels">
                <div className="panel" style={{flex: '2'}}>
                  <div className="panel-header">
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <span className="panel-title">Thought Log</span>
                      <span style={{fontSize: '11px', color: 'var(--text-secondary)'}}>{thoughts.length} entries</span>
                    </div>
                  </div>
                  <div className="panel-content">
                    <ThoughtLog thoughts={thoughts} />
                  </div>
                </div>

                <div className="panel" style={{flex: '1', minWidth: '350px'}}>
                  <div className="panel-header">
                    <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                      <span className="panel-title">Approval Queue</span>
                      <span style={{fontSize: '11px', color: 'var(--text-secondary)'}}>
                        {approvals.filter(a => a.status === 'pending').length} pending
                      </span>
                    </div>
                  </div>
                  <div className="panel-content">
                    <ApprovalQueue 
                      approvals={approvals.filter(a => a.runId === selectedRunId)}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  </div>
                </div>
              </div>

              <div style={{borderTop: '1px solid var(--border)'}}>
                <div style={{display: 'flex', gap: '8px', padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)'}}>
                  {['thoughts', 'approvals', 'budget', 'plugins'].map(tab => (
                    <button
                      key={tab}
                      className={`btn ${activeTab === tab ? 'primary' : ''}`}
                      style={{padding: '6px 12px', fontSize: '12px'}}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="panel-content" style={{flex: 1, maxHeight: '300px'}}>
                  {activeTab === 'thoughts' && <ThoughtLog thoughts={thoughts} />}
                  {activeTab === 'approvals' && <ApprovalQueue approvals={approvals} onApprove={handleApprove} onReject={handleReject} />}
                  {activeTab === 'budget' && <BudgetPanel budget={budget} />}
                  {activeTab === 'plugins' && <PluginPanel plugins={plugins} />}
                </div>
              </div>
            </>
          ) : (
            <div className="content" style={{alignItems: 'center', justifyContent: 'center'}}>
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                <p>Select a run from the sidebar or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNewRunModal && (
        <NewRunModal onClose={() => setShowNewRunModal(false)} onStart={handleStartRun} />
      )}
    </div>
  );
}

export default App;
