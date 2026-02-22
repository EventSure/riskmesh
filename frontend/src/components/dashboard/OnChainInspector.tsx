export function OnChainInspector() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">On-chain Inspector</div>
        <span className="mono sub" style={{ fontSize: '9px' }}>PDAs</span>
      </div>
      <div className="card-body" style={{ padding: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--sub)', textAlign: 'center', padding: '20px' }}>
          Create a policy to inspect accounts.
        </div>
      </div>
    </div>
  );
}
