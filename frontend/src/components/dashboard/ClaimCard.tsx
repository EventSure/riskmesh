export function ClaimCard() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Claim Account</div>
        <span className="tag tag-s">PENDING</span>
      </div>
      <div className="card-body">
        <div className="srow">
          <span className="fl">oracle_value</span>
          <span className="mono">— min</span>
        </div>
        <div className="srow">
          <span className="fl">verified_at</span>
          <span className="mono">—</span>
        </div>
        <div className="srow">
          <span className="fl">approved_by</span>
          <span className="mono">—</span>
        </div>
        <div className="srow">
          <span className="fl">payout_amount</span>
          <span className="mono">—</span>
        </div>
        <div className="srow">
          <span className="fl">status</span>
          <span className="mono">None</span>
        </div>
        <div className="div-line"></div>
        <button className="btn btn-w btn-full">approve_claim</button>
        <button className="btn btn-a btn-full" style={{ marginTop: 6 }}>settle_claim</button>
      </div>
    </div>
  );
}
