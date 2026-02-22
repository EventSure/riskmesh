export function OracleConsole() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Oracle Console</div>
        <span className="tag tag-s">Switchboard-like</span>
      </div>
      <div className="card-body">
        <div className="srow" style={{ gap: 8, alignItems: 'flex-end' }}>
          <div className="fg" style={{ flex: 1 }}>
            <label className="fl">Delay (min) — must be ≥0, ×10</label>
            <input className="fi mono" type="number" step={10} min={0} defaultValue={130} />
          </div>
          <div className="fg" style={{ flex: 1 }}>
            <label className="fl">Freshness (min ago)</label>
            <input className="fi mono" type="number" min={0} max={60} defaultValue={5} />
          </div>
        </div>
        <button className="btn btn-p btn-full" style={{ marginTop: 8 }}>
          🔮 check_oracle_and_create_claim (public)
        </button>
        <div className="div-line"></div>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 8 }}>
          Why On-chain?
        </div>
        <div className="cmp-grid">
          <div className="cmp-trad">
            <div className="cmp-hdr">Traditional</div>
            <div className="cmp-item">3–14 day settlement</div>
            <div className="cmp-item">Manual claims review</div>
            <div className="cmp-item">Counterparty risk</div>
            <div className="cmp-item">No audit trail</div>
          </div>
          <div className="cmp-chain">
            <div className="cmp-hdr">On-Chain (MVP)</div>
            <div className="cmp-item">Sub-1s settlement</div>
            <div className="cmp-item">Oracle-verified trigger</div>
            <div className="cmp-item">Pre-funded vault</div>
            <div className="cmp-item">Immutable audit log</div>
          </div>
        </div>
      </div>
    </div>
  );
}
