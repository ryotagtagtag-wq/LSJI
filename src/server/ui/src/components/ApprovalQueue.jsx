import React, { useState } from 'react';

function ApprovalQueue({ approvals, onApprove, onReject }) {
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const decidedApprovals = approvals.filter(a => a.status !== 'pending');

  const [expanded, setExpanded] = useState({});
  const [approveReason, setApproveReason] = useState({});
  const [rejectReason, setRejectReason] = useState({});

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApprove = async (id) => {
    await onApprove(id, approveReason[id] || 'Approved via UI');
    setApproveReason(prev => ({ ...prev, [id]: '' }));
  };

  const handleReject = async (id) => {
    const reason = rejectReason[id] || 'Rejected via UI';
    if (!reason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    await onReject(id, reason);
    setRejectReason(prev => ({ ...prev, [id]: '' }));
  };

  if (pendingApprovals.length === 0 && decidedApprovals.length === 0) {
    return (
      <div className="empty-state" style={{height: '100%'}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p>No pending approvals</p>
      </div>
    );
  }

  return (
    <div className="approval-list">
      {pendingApprovals.map(approval => (
        <div key={approval.id} className="approval-card">
          <div className="approval-header">
            <span className="approval-action">{approval.action}</span>
            <span className="approval-badge pending">PENDING</span>
          </div>
          
          <div className="approval-context">
            <pre>{JSON.stringify(approval.context, null, 2)}</pre>
          </div>
          
          <div className="approval-actions">
            <button
              className="btn"
              onClick={() => toggleExpand(approval.id)}
              style={{flex: 1}}
            >
              {expanded[approval.id] ? 'Hide Details' : 'Show Details'}
            </button>
            
            {expanded[approval.id] && (
              <div style={{width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px'}}>
                <div style={{display: 'flex', gap: '8px'}}>
                  <input
                    type="text"
                    placeholder="Approval reason (optional)"
                    value={approveReason[approval.id] || ''}
                    onChange={(e) => setApproveReason(prev => ({ ...prev, [approval.id]: e.target.value }))}
                    className="form-input"
                    style={{flex: 1, padding: '8px 12px'}}
                  />
                  <button className="btn success" onClick={() => handleApprove(approval.id)}>
                    ✓ Approve
                  </button>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <input
                    type="text"
                    placeholder="Rejection reason (required)"
                    value={rejectReason[approval.id] || ''}
                    onChange={(e) => setRejectReason(prev => ({ ...prev, [approval.id]: e.target.value }))}
                    className="form-input"
                    style={{flex: 1, padding: '8px 12px'}}
                  />
                  <button className="btn danger" onClick={() => handleReject(approval.id)}>
                    ✗ Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {decidedApprovals.length > 0 && (
        <details style={{marginTop: '16px'}}>
          <summary style={{cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px'}}>
            Decided ({decidedApprovals.length})
          </summary>
          <div style={{marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {decidedApprovals.slice(0, 10).map(approval => (
              <div key={approval.id} className="approval-card" style={{opacity: 0.7}}>
                <div className="approval-header">
                  <span className="approval-action">{approval.action}</span>
                  <span className={`approval-badge ${approval.status}`}>{approval.status.toUpperCase()}</span>
                </div>
                <div className="approval-context">
                  <pre>{JSON.stringify(approval.context, null, 2)}</pre>
                </div>
                {approval.reason && (
                  <div style={{fontSize: '11px', color: 'var(--text-secondary)'}}>
                    Reason: {approval.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default ApprovalQueue;
