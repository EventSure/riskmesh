export function PolicyBuilder() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Policy Builder</div>
        <span className="mono sub" style={{ fontSize: '10px' }}>POL-—</span>
      </div>
      <div className="card-body">
        <div className="fg">
          <label className="fl">policy_id</label>
          <input className="fi mono" type="number" defaultValue={1001} />
        </div>
        <div className="fg">
          <label className="fl">flight_no</label>
          <input className="fi mono" type="text" defaultValue="KE081" />
        </div>
        <div className="fg">
          <label className="fl">route</label>
          <input className="fi mono" type="text" defaultValue="ICN-JFK" />
        </div>
        <div className="fg">
          <label className="fl">departure_date</label>
          <input className="fi mono" type="text" defaultValue="2026-03-15T10:00:00Z" />
        </div>
        <div className="fg">
          <label className="fl">delay_threshold</label>
          <input className="fi mono" type="number" defaultValue={120} />
        </div>
        <div className="fg">
          <label className="fl">payout_amount</label>
          <input className="fi mono" type="number" defaultValue={1000000} />
        </div>
        <div className="fg">
          <label className="fl">currency_mint</label>
          <input
            className="fi mono"
            type="text"
            defaultValue="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            readOnly
            style={{ fontSize: '9px', opacity: 0.7 }}
          />
        </div>
        <div className="fg">
          <label className="fl">oracle_feed</label>
          <input
            className="fi mono"
            type="text"
            defaultValue="SwitchboardFeed1aFlight1ICN1JFK1KE081xxxx"
            readOnly
            style={{ fontSize: '9px', opacity: 0.7 }}
          />
        </div>
        <div className="div-line"></div>
        <button className="btn btn-p btn-full">📄 create_policy</button>
      </div>
    </div>
  );
}
