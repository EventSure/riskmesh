const participants = [
  { name: 'Leader', color: '#9945FF', bps: 4000 },
  { name: 'Participant A', color: '#14F195', bps: 3500 },
  { name: 'Participant B', color: '#F59E0B', bps: 2500 },
];

export function Participants() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Underwriting Participants</div>
        <span className="tag tag-s">PROPOSED</span>
      </div>
      <div className="card-body">
        {participants.map((p) => (
          <div className="pt-row" key={p.name}>
            <div className="pt-hdr">
              <div className="pt-name">
                <div className="pt-dot" style={{ background: p.color, boxShadow: `0 0 5px ${p.color}` }}></div>
                {p.name}
              </div>
              <span className="pt-chip" style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>PROPOSED</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', fontSize: '10px', color: 'var(--sub)', marginBottom: '6px' }}>
              <span>ratio_bps: <strong className="mono" style={{ color: p.color }}>{p.bps}</strong></span>
              <span>escrow_req: <strong className="mono">0</strong></span>
              <span>escrow_dep: <strong className="mono" style={{ color: 'var(--accent)' }}>0</strong></span>
              <span>max_loss: <strong className="mono">0</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
