export function RiskPoolAccount() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">RiskPool Account</div>
        <span className="tag" style={{ background: 'rgba(148,163,184,.1)', color: 'rgb(148,163,184)', border: '1px solid rgba(148,163,184,.2)' }}>PENDING</span>
      </div>
      <div className="card-body">
        <div className="srow">
          <span className="sl">available_balance</span>
          <span className="sv mono">0</span>
        </div>
        <div className="srow">
          <span className="sl">total_escrowed</span>
          <span className="sv mono">0</span>
        </div>
        <div className="srow">
          <span className="sl">payout_amount</span>
          <span className="sv mono">—</span>
        </div>
        <div className="srow">
          <span className="sl">total_ratio_bps</span>
          <span className="sv mono">0 / 10000</span>
        </div>
        <div className="div-line"></div>
        <div className="prog-lbl">
          <span>Collateral Funded</span>
          <span>0%</span>
        </div>
        <div className="progwrap">
          <div className="progfill" style={{ width: '0%', background: 'linear-gradient(90deg,var(--primary),var(--accent))' }}></div>
        </div>
        <div style={{ height: '130px', marginTop: '10px' }}>
          <canvas id="pieChart"></canvas>
        </div>
      </div>
    </div>
  );
}
