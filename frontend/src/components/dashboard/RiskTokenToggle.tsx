export function RiskTokenToggle() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Risk Token Mode (Phase 2 Preview)</div>
      </div>
      <div className="card-body">
        <div className="token-toggle">
          <label className="toggle-sw">
            <input type="checkbox" />
            <span className="toggle-slider"></span>
          </label>
          <span className="fl">Enable Risk Token Mode</span>
        </div>
        <div className="token-section" style={{ display: 'none' }}>
          <div className="srow">
            <span className="fl">token_supply</span>
            <span className="mono">—</span>
          </div>
          <div className="srow">
            <span className="fl">token_value</span>
            <span className="mono">—</span>
          </div>
          <div className="srow">
            <span className="fl">market_cap</span>
            <span className="mono">—</span>
          </div>
          <canvas
            style={{
              width: '100%',
              height: 80,
              marginTop: 8,
              background: 'var(--card2)',
              borderRadius: 6,
            }}
          />
        </div>
      </div>
    </div>
  );
}
