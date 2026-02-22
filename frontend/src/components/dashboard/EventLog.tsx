export function EventLog() {
  return (
    <div className="bottom-section">
      <div className="log-col">
        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--sub)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', boxShadow: '0 0 6px var(--success)' }}></span>
          Protocol Event Log
        </div>
        <div className="log-entry">
          <div className="log-dot" style={{ background: 'var(--sub)' }}></div>
          <span className="log-time">--:--:--</span>
          <div className="log-body" style={{ color: 'var(--sub)' }}>Demo reset. Ready.</div>
        </div>
      </div>
      <div className="log-col" style={{ maxWidth: '340px', flex: '0 0 340px' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--sub)', marginBottom: '8px' }}>
          Approval / Settlement Audit
        </div>
        <div style={{ fontSize: '10px', color: 'var(--sub)' }}>No approval records yet.</div>
      </div>
    </div>
  );
}
