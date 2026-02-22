export function PolicyDetails() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Policy Account</div>
        <span className="tag tag-s">DRAFT</span>
      </div>
      <div className="card-body">
        <div className="srow">
          <span className="fl">policy_id</span>
          <span className="mono">1001</span>
        </div>
        <div className="srow">
          <span className="fl">flight_no</span>
          <span className="mono">KE081</span>
        </div>
        <div className="srow">
          <span className="fl">route</span>
          <span className="mono">ICN-JFK</span>
        </div>
        <div className="srow">
          <span className="fl">delay_threshold</span>
          <span className="mono">120 min</span>
        </div>
        <div className="srow">
          <span className="fl">payout_amount</span>
          <span className="mono">1,000,000 USDC</span>
        </div>
        <div className="srow">
          <span className="fl">departure_date</span>
          <span className="mono">2026-03-15T10:00:00Z</span>
        </div>
        <div className="srow">
          <span className="fl">unix_timestamp</span>
          <span className="mono">1773568800</span>
        </div>
        <div className="srow">
          <span className="fl">state</span>
          <span className="mono">Draft</span>
        </div>
        <div className="div-line"></div>
        <button className="btn btn-p btn-full">open_underwriting</button>
        <button className="btn btn-a btn-full" style={{ marginTop: 6 }}>activate_policy</button>
        <button className="btn btn-o btn-full" style={{ marginTop: 6, fontSize: 11 }}>expire_policy</button>
      </div>
    </div>
  );
}
