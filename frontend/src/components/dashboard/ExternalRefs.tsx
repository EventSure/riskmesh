export function ExternalRefs() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">External Policyholder Refs (Off-chain)</div>
      </div>
      <div className="card-body">
        <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 8 }}>
          SHA-256 hashes only. No PII stored on-chain.
        </div>
        <div className="srow">
          <span className="fl" style={{ fontSize: 9 }}>ref_hash_1</span>
          <span className="mono" style={{ fontSize: 9 }}>a3f8e2...d91c</span>
        </div>
        <div className="srow">
          <span className="fl" style={{ fontSize: 9 }}>ref_hash_2</span>
          <span className="mono" style={{ fontSize: 9 }}>7b14cc...f302</span>
        </div>
        <div className="srow">
          <span className="fl" style={{ fontSize: 9 }}>ref_hash_3</span>
          <span className="mono" style={{ fontSize: 9 }}>c09a77...1e88</span>
        </div>
      </div>
    </div>
  );
}
