import React from 'react';

function BudgetPanel({ budget }) {
  if (!budget) {
    return (
      <div className="empty-state" style={{height: '100%'}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p>No budget data available</p>
      </div>
    );
  }

  const run = budget.run || budget;
  const daily = budget.daily || {};
  const monthly = budget.monthly || {};

  const runCost = run.totalCost || 0;
  const runTokens = run.totalTokens || 0;
  const dailyCost = daily.totalCost || 0;
  const dailyLimit = daily.limit || 50;
  const monthlyCost = monthly.totalCost || 0;
  const monthlyLimit = monthly.limit || 500;

  const runPercent = run.limit ? (runCost / run.limit) * 100 : 0;
  const dailyPercent = dailyLimit ? (dailyCost / dailyLimit) * 100 : 0;
  const monthlyPercent = monthlyLimit ? (monthlyCost / monthlyLimit) * 100 : 0;

  const getStatusClass = (percent) => {
    if (percent >= 90) return 'danger';
    if (percent >= 70) return 'warning';
    return '';
  };

  return (
    <div>
      <div className="budget-overview">
        <div className={`budget-card ${getStatusClass(runPercent)}`}>
          <div className="budget-label">Run Cost</div>
          <div className={`budget-value ${getStatusClass(runPercent)}`}>${runCost.toFixed(4)}</div>
          <div className="budget-details">
            <span>{runTokens.toLocaleString()} tokens</span>
            {run.limit && <span>Limit: $${run.limit}</span>}
          </div>
          {run.limit && (
            <div style={{marginTop: '8px', height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden'}}>
              <div style={{width: `${Math.min(runPercent, 100)}%`, height: '100%', background: getStatusClass(runPercent) === 'danger' ? 'var(--danger)' : getStatusClass(runPercent) === 'warning' ? 'var(--warning)' : 'var(--success)', transition: 'width 0.3s'}}></div>
            </div>
          )}
        </div>

        <div className={`budget-card ${getStatusClass(dailyPercent)}`}>
          <div className="budget-label">Daily Cost</div>
          <div className={`budget-value ${getStatusClass(dailyPercent)}`}>${dailyCost.toFixed(2)}</div>
          <div className="budget-details">
            <span>Limit: $${dailyLimit}</span>
            <span>{dailyPercent.toFixed(0)}%</span>
          </div>
          <div style={{marginTop: '8px', height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden'}}>
            <div style={{width: `${Math.min(dailyPercent, 100)}%`, height: '100%', background: getStatusClass(dailyPercent) === 'danger' ? 'var(--danger)' : getStatusClass(dailyPercent) === 'warning' ? 'var(--warning)' : 'var(--success)', transition: 'width 0.3s'}}></div>
          </div>
        </div>

        <div className={`budget-card ${getStatusClass(monthlyPercent)}`}>
          <div className="budget-label">Monthly Cost</div>
          <div className={`budget-value ${getStatusClass(monthlyPercent)}`}>${monthlyCost.toFixed(2)}</div>
          <div className="budget-details">
            <span>Limit: $${monthlyLimit}</span>
            <span>{monthlyPercent.toFixed(0)}%</span>
          </div>
          <div style={{marginTop: '8px', height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden'}}>
            <div style={{width: `${Math.min(monthlyPercent, 100)}%`, height: '100%', background: getStatusClass(monthlyPercent) === 'danger' ? 'var(--danger)' : getStatusClass(monthlyPercent) === 'warning' ? 'var(--warning)' : 'var(--success)', transition: 'width 0.3s'}}></div>
          </div>
        </div>
      </div>

      {run.breakdown && run.breakdown.length > 0 && (
        <div>
          <h4 style={{fontSize: '12px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)'}}>
            Cost Breakdown
          </h4>
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {run.breakdown.map((item, i) => (
              <div key={i} style={{display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', fontSize: '12px'}}>
                <span>{item.model} ({item.provider})</span>
                <span>${item.cost.toFixed(6)} • {item.tokens?.toLocaleString()} tokens</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {run.circuitBreaker && (
        <div style={{marginTop: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px'}}>
          <div style={{fontSize: '12px', fontWeight: '600', marginBottom: '8px'}}>Circuit Breaker</div>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px'}}>
            <span>State: </span>
            <span style={{
              color: run.circuitBreaker.state === 'open' ? 'var(--danger)' : 
                     run.circuitBreaker.state === 'half-open' ? 'var(--warning)' : 'var(--success)'
            }}>
              {run.circuitBreaker.state.toUpperCase()}
            </span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px'}}>
            <span>Failures: </span>
            <span>{run.circuitBreaker.failures}/{run.circuitBreaker.threshold}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default BudgetPanel;
