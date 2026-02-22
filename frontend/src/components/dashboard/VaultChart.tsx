export function VaultChart() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Vault Balance Over Time</div>
      </div>
      <div className="card-body" style={{ padding: '10px' }}>
        <div style={{ height: '130px' }}>
          <canvas id="vaultChart"></canvas>
        </div>
      </div>
    </div>
  );
}
