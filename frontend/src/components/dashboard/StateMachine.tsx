const policyNodes = [
  { icon: '📄', label: 'Draft' },
  { icon: '📂', label: 'Open' },
  { icon: '💰', label: 'Funded' },
  { icon: '⚡', label: 'Active' },
  { icon: '🔔', label: 'Claimable' },
  { icon: '✅', label: 'Approved' },
  { icon: '💸', label: 'Settled' },
  { icon: '⏰', label: 'Expired' },
];

const underwritingNodes = [
  { icon: '💬', label: 'Proposed' },
  { icon: '📂', label: 'Open' },
  { icon: '✅', label: 'Finalized' },
];

export function StateMachine() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Policy State Machine</div>
        <span className="mono sub" style={{ fontSize: '9px' }}>PolicyState enum</span>
      </div>
      <div className="card-body">
        <div className="sm-wrap">
          <div className="sm-track">
            {policyNodes.map((node, i) => (
              <div key={node.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className="sm-node">
                  <div className="sm-circle">{node.icon}</div>
                  <div className="sm-lbl">{node.label}</div>
                </div>
                {i < policyNodes.length - 1 && <div className="sm-conn"></div>}
              </div>
            ))}
          </div>
        </div>
        <div className="mono sub" style={{ fontSize: '9px', marginTop: 10, marginBottom: 6 }}>
          UnderwritingStatus
        </div>
        <div className="sm-wrap">
          <div className="sm-track" style={{ minWidth: 300 }}>
            {underwritingNodes.map((node, i) => (
              <div key={node.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className="sm-node">
                  <div className="sm-circle">{node.icon}</div>
                  <div className="sm-lbl">{node.label}</div>
                </div>
                {i < underwritingNodes.length - 1 && <div className="sm-conn"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
