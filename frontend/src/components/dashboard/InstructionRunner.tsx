interface Step {
  num: number;
  name: string;
  role: string;
  roleColor: string;
  detail: string;
}

const steps: Step[] = [
  {
    num: 1,
    name: 'create_policy',
    role: 'leader',
    roleColor: '#9945FF',
    detail: 'Initializes Policy PDA. Sets all parameters.',
  },
  {
    num: 2,
    name: 'open_underwriting',
    role: 'leader',
    roleColor: '#9945FF',
    detail: 'Creates Underwriting PDA. Opens acceptance window.',
  },
  {
    num: 3,
    name: 'accept_share (Leader)',
    role: 'leader',
    roleColor: '#9945FF',
    detail: 'Leader auto-accepts 4000 bps + deposits escrow to vault.',
  },
  {
    num: 4,
    name: 'accept_share (Participant A)',
    role: 'partA',
    roleColor: '#14F195',
    detail: 'Participant A accepts 3500 bps + deposits escrow.',
  },
  {
    num: 5,
    name: 'accept_share (Participant B)',
    role: 'partB',
    roleColor: '#F59E0B',
    detail: 'Participant B accepts 2500 bps + deposits escrow.',
  },
  {
    num: 6,
    name: 'activate_policy',
    role: 'leader',
    roleColor: '#9945FF',
    detail: 'Verifies total_ratio==10000 & vault funded. Sets Active.',
  },
  {
    num: 7,
    name: 'check_oracle_and_create_claim',
    role: 'public',
    roleColor: '#94A3B8',
    detail: 'Reads oracle feed. Validates freshness & format. Creates Claim if delay>=threshold.',
  },
  {
    num: 8,
    name: 'approve_claim',
    role: 'leader/op',
    roleColor: '#EF4444',
    detail: 'Leader/Operator reviews and approves Claim manually.',
  },
  {
    num: 9,
    name: 'settle_claim',
    role: 'leader/op',
    roleColor: '#EF4444',
    detail: 'Transfers payout from vault. Deducts losses proportionally.',
  },
];

export function InstructionRunner() {
  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Instruction Runner</div>
        <button className="btn btn-o btn-sm">&#8634; Reset</button>
      </div>
      <div className="card-body">
        {steps.map((step, i) => (
          <div key={step.num} className={`step-item${i === 0 ? ' active' : ''}`}>
            <div className="step-hdr">
              <div className={`step-num${i === 0 ? ' cur-n' : ''}`}>{step.num}</div>
              <span className="step-name">{step.name}</span>
              <span
                className="step-role tag"
                style={{
                  background: `${step.roleColor}20`,
                  color: step.roleColor,
                  border: `1px solid ${step.roleColor}40`,
                }}
              >
                {step.role}
              </span>
            </div>
            <div className="step-detail">{step.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
