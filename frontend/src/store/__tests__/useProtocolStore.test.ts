import { describe, it, expect, beforeEach } from 'vitest';
import { useProtocolStore } from '../useProtocolStore';
import type { Participant } from '../useProtocolStore';

const getState = () => useProtocolStore.getState();
const { setState } = useProtocolStore;

const makeParticipants = (shares: number[]): Participant[] =>
  shares.map((share, i) => ({ id: `p${i + 1}`, name: '', share, address: '', confirmed: false }));

const makeAcc = (n: number) => ({
  leaderPrem: 0,
  participantPrems: new Array(n).fill(0),
  reinPrem: 0,
  leaderClaim: 0,
  participantClaims: new Array(n).fill(0),
  reinClaim: 0,
});

beforeEach(() => {
  getState().resetAll();
  setState({ role: 'leader' });
});

describe('setTerms', () => {
  it('succeeds when role is leader and shares sum to 100', () => {
    setState({ role: 'leader', leaderShare: 50, participants: makeParticipants([30, 20]) });
    const result = getState().setTerms();
    expect(result.ok).toBe(true);
    expect(getState().processStep).toBe(1);
  });

  it('succeeds when role is operator', () => {
    setState({ role: 'operator', leaderShare: 50, participants: makeParticipants([30, 20]) });
    const result = getState().setTerms();
    expect(result.ok).toBe(true);
  });

  it('fails when role is participant', () => {
    setState({ role: 'participant' });
    const result = getState().setTerms();
    expect(result.ok).toBe(false);
    expect(result.msg).toBeDefined();
  });

  it('fails when shares do not sum to 100', () => {
    setState({ leaderShare: 50, participants: makeParticipants([30, 10]) });
    const result = getState().setTerms();
    expect(result.ok).toBe(false);
    expect(result.msg).toBeDefined();
  });

  it('sets policyStateIdx to 0 on success', () => {
    setState({ leaderShare: 50, participants: makeParticipants([30, 20]) });
    getState().setTerms();
    expect(getState().policyStateIdx).toBe(0);
  });
});

describe('confirmParticipant / confirmReinsurer', () => {
  beforeEach(() => {
    setState({
      processStep: 1,
      leaderShare: 50,
      participants: makeParticipants([30, 20]),
      reinsurer: { enabled: true, address: '', confirmed: false },
      acc: makeAcc(2),
    });
  });

  it('first participant confirmation sets processStep to 2', () => {
    getState().confirmParticipant('p1');
    expect(getState().participants.find(p => p.id === 'p1')?.confirmed).toBe(true);
    expect(getState().processStep).toBe(2);
  });

  it('both participants confirmed sets processStep to 3', () => {
    getState().confirmParticipant('p1');
    getState().confirmParticipant('p2');
    expect(getState().processStep).toBe(3);
  });

  it('all parties confirmed sets processStep to 4', () => {
    getState().confirmParticipant('p1');
    getState().confirmParticipant('p2');
    getState().confirmReinsurer();
    expect(getState().processStep).toBe(4);
    expect(getState().participants.every(p => p.confirmed)).toBe(true);
    expect(getState().reinsurer.confirmed).toBe(true);
  });

  it('second participant alone advances processStep to 2', () => {
    getState().confirmParticipant('p2');
    expect(getState().processStep).toBe(2);
  });
});

describe('activateMaster', () => {
  it('fails when not all parties confirmed', () => {
    setState({
      participants: makeParticipants([30, 20]).map((p, i) => ({ ...p, confirmed: i === 0 })),
      reinsurer: { enabled: true, address: '', confirmed: false },
    });
    const result = getState().activateMaster();
    expect(result.ok).toBe(false);
  });

  it('fails when role is not leader', () => {
    setState({
      role: 'participant',
      participants: makeParticipants([30, 20]).map(p => ({ ...p, confirmed: true })),
      reinsurer: { enabled: true, address: '', confirmed: true },
    });
    const result = getState().activateMaster();
    expect(result.ok).toBe(false);
  });

  it('succeeds with all confirmations and leader role', () => {
    setState({
      role: 'leader',
      participants: makeParticipants([30, 20]).map(p => ({ ...p, confirmed: true })),
      reinsurer: { enabled: true, address: '', confirmed: true },
    });
    const result = getState().activateMaster();
    expect(result.ok).toBe(true);
    expect(getState().masterActive).toBe(true);
    expect(getState().processStep).toBe(5);
    expect(getState().policyStateIdx).toBe(3);
  });
});

describe('addContract', () => {
  beforeEach(() => {
    setState({
      masterActive: true,
      leaderShare: 50,
      participants: makeParticipants([30, 20]),
      reinsurer: { enabled: true, address: '', confirmed: false },
      acc: makeAcc(2),
      premiumPerPolicy: 3,
      cededRatioBps: 5000,
      reinsCommissionBps: 1000,
    });
  });

  it('does nothing when masterActive is false', () => {
    setState({ masterActive: false });
    getState().addContract('Test', 'KE081', '2026-01-15');
    expect(getState().contracts).toHaveLength(0);
  });

  it('creates a contract with correct premium distribution', () => {
    getState().addContract('홍길동', 'KE081', '2026-01-15');
    const contracts = getState().contracts;
    expect(contracts).toHaveLength(1);

    const ct = contracts[0];
    // reinsEff = 0.5 * (1 - 0.1) = 0.45
    // lNet = 0.5 * 0.55 * 3 = 0.825
    // participantNets[0] (30%) = 0.3 * 0.55 * 3 = 0.495
    // participantNets[1] (20%) = 0.2 * 0.55 * 3 = 0.33
    // rNet = 0.45 * 3 = 1.35
    expect(ct.lNet).toBeCloseTo(0.825, 6);
    expect(ct.participantNets[0]).toBeCloseTo(0.495, 6);
    expect(ct.participantNets[1]).toBeCloseTo(0.33, 6);
    expect(ct.rNet).toBeCloseTo(1.35, 6);
    expect(ct.status).toBe('active');
    expect(ct.name).toBe('홍길동');
    expect(ct.flight).toBe('KE081');
  });

  it('accumulates premiums in acc', () => {
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().addContract('B', 'OZ201', '2026-02-05');
    const acc = getState().acc;
    expect(acc.leaderPrem).toBeCloseTo(0.825 * 2, 6);
    expect(acc.participantPrems[0]).toBeCloseTo(0.495 * 2, 6);
    expect(acc.participantPrems[1]).toBeCloseTo(0.33 * 2, 6);
    expect(acc.reinPrem).toBeCloseTo(1.35 * 2, 6);
  });

  it('increments contractCount and totalPremium', () => {
    getState().addContract();
    getState().addContract();
    expect(getState().contractCount).toBe(2);
    expect(getState().totalPremium).toBeCloseTo(6, 6);
  });
});

describe('runOracle', () => {
  beforeEach(() => {
    setState({
      masterActive: true,
      leaderShare: 50,
      participants: makeParticipants([30, 20]),
      reinsurer: { enabled: true, address: '', confirmed: false },
      acc: makeAcc(2),
      premiumPerPolicy: 3,
      cededRatioBps: 5000,
      reinsCommissionBps: 1000,
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      poolBalance: 10000,
    });
    getState().addContract('Test', 'KE081', '2026-01-15');
  });

  it('rejects stale oracle data (fresh > 30)', () => {
    const result = getState().runOracle(1, 120, 31, false);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_ORACLE_STALE');
  });

  it('rejects negative freshness', () => {
    const result = getState().runOracle(1, 120, -1, false);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_ORACLE_STALE');
  });

  it('rejects non-multiple-of-10 delay', () => {
    const result = getState().runOracle(1, 125, 0, false);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_ORACLE_FORMAT');
  });

  it('rejects negative delay', () => {
    const result = getState().runOracle(1, -10, 0, false);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_ORACLE_FORMAT');
  });

  it('does not trigger for delay < 120', () => {
    const result = getState().runOracle(1, 110, 0, false);
    expect(result.ok).toBe(true);
    expect(result.type).toBe('ok');
    expect(getState().claims).toHaveLength(0);
  });

  it('creates claim for delay=120 (2h tier, payout=5)', () => {
    const result = getState().runOracle(1, 120, 0, false);
    expect(result.ok).toBe(true);
    expect(result.type).toBe('ok');
    const claims = getState().claims;
    expect(claims).toHaveLength(1);
    expect(claims[0].payout).toBe(5);
    expect(claims[0].tier).toBe('2h~2h59m');
  });

  it('creates claim for delay=180 (3h tier, payout=8)', () => {
    const result = getState().runOracle(1, 180, 0, false);
    expect(result.ok).toBe(true);
    expect(getState().claims[0].payout).toBe(8);
  });

  it('creates claim for delay=240 (4-5h tier, payout=12)', () => {
    const result = getState().runOracle(1, 240, 0, false);
    expect(result.ok).toBe(true);
    expect(getState().claims[0].payout).toBe(12);
  });

  it('creates claim for delay=360 (6h+ tier, payout=15)', () => {
    const result = getState().runOracle(1, 360, 0, false);
    expect(result.ok).toBe(true);
    expect(getState().claims[0].payout).toBe(15);
  });

  it('cancelled=true uses highest tier regardless of delay', () => {
    const result = getState().runOracle(1, 0, 0, true);
    expect(result.ok).toBe(true);
    expect(getState().claims[0].payout).toBe(15);
    expect(getState().claims[0].tier).toBe('6h+/결항');
  });

  it('calculates correct payout distribution for delay=120', () => {
    getState().runOracle(1, 120, 0, false);
    const cl = getState().claims[0];
    // payout=5, reinsEff=0.45, insurerEff=0.55
    // lNet = 5 * 0.55 * 0.5 = 1.375
    // participantNets[0] (30%) = 5 * 0.55 * 0.3 = 0.825
    // participantNets[1] (20%) = 5 * 0.55 * 0.2 = 0.55
    // rNet = 5 * 0.45 = 2.25
    expect(cl.lNet).toBeCloseTo(1.375, 6);
    expect(cl.participantNets[0]).toBeCloseTo(0.825, 6);
    expect(cl.participantNets[1]).toBeCloseTo(0.55, 6);
    expect(cl.rNet).toBeCloseTo(2.25, 6);
    expect(cl.totRC).toBeCloseTo(2.25, 6);
  });

  it('reduces pool balance by payout amount', () => {
    const balanceBefore = getState().poolBalance;
    getState().runOracle(1, 120, 0, false);
    expect(getState().poolBalance).toBeCloseTo(balanceBefore - 5, 6);
  });

  it('marks contract as claimed', () => {
    getState().runOracle(1, 120, 0, false);
    expect(getState().contracts[0].status).toBe('claimed');
  });

  it('rejects already claimed contract', () => {
    getState().runOracle(1, 120, 0, false);
    getState().addContract('Test2', 'OZ201', '2026-02-05');
    const result = getState().runOracle(1, 180, 0, false);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_ALREADY_CLAIMED');
  });

  it('rejects non-existent contract', () => {
    const result = getState().runOracle(999, 120, 0, false);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('E_CONTRACT_NOT_FOUND');
  });

  it('accumulates claim amounts in acc', () => {
    getState().addContract('Test2', 'OZ201', '2026-02-05');
    getState().runOracle(1, 120, 0, false); // payout=5
    getState().runOracle(2, 180, 0, false); // payout=8
    const acc = getState().acc;
    // delay2h: lNet=1.375, delay3h: lNet = 8 * 0.55 * 0.5 = 2.2
    expect(acc.leaderClaim).toBeCloseTo(1.375 + 2.2, 6);
    // participantClaims[0] (30%): 0.825 + 8*0.55*0.3=1.32
    expect(acc.participantClaims[0]).toBeCloseTo(0.825 + 1.32, 6);
    // participantClaims[1] (20%): 0.55 + 8*0.55*0.2=0.88
    expect(acc.participantClaims[1]).toBeCloseTo(0.55 + 0.88, 6);
    expect(acc.reinClaim).toBeCloseTo(2.25 + 3.6, 6);
  });
});

describe('approveClaims', () => {
  beforeEach(() => {
    setState({
      masterActive: true,
      leaderShare: 50,
      participants: makeParticipants([30, 20]),
      reinsurer: { enabled: true, address: '', confirmed: false },
      acc: makeAcc(2),
      premiumPerPolicy: 3,
      cededRatioBps: 5000,
      reinsCommissionBps: 1000,
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      poolBalance: 10000,
    });
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().addContract('B', 'OZ201', '2026-02-05');
    getState().runOracle(1, 120, 0, false);
    getState().runOracle(2, 180, 0, false);
  });

  it('approves all claimable claims', () => {
    const count = getState().approveClaims();
    expect(count).toBe(2);
    expect(getState().claims.every(c => c.status === 'approved')).toBe(true);
  });

  it('returns 0 when no claimable claims', () => {
    getState().approveClaims();
    const count = getState().approveClaims();
    expect(count).toBe(0);
  });

  it('sets approvedAt timestamp', () => {
    getState().approveClaims();
    expect(getState().claims[0].approvedAt).toBeDefined();
  });
});

describe('settleClaims', () => {
  beforeEach(() => {
    setState({
      masterActive: true,
      leaderShare: 50,
      participants: makeParticipants([30, 20]),
      reinsurer: { enabled: true, address: '', confirmed: false },
      acc: makeAcc(2),
      premiumPerPolicy: 3,
      cededRatioBps: 5000,
      reinsCommissionBps: 1000,
      payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      poolBalance: 10000,
    });
    getState().addContract('A', 'KE081', '2026-01-15');
    getState().runOracle(1, 120, 0, false);
    getState().approveClaims();
  });

  it('settles approved claims', () => {
    const count = getState().settleClaims();
    expect(count).toBe(1);
    expect(getState().claims[0].status).toBe('settled');
  });

  it('returns 0 when no approved claims', () => {
    getState().settleClaims();
    const count = getState().settleClaims();
    expect(count).toBe(0);
  });

  it('sets settledAt timestamp', () => {
    getState().settleClaims();
    expect(getState().claims[0].settledAt).toBeDefined();
  });

  it('sets policyStateIdx to 6 (Settled)', () => {
    getState().settleClaims();
    expect(getState().policyStateIdx).toBe(6);
  });
});

describe('clearContracts', () => {
  it('resets all contract-related state', () => {
    setState({ masterActive: true });
    getState().addContract('Test', 'KE081', '2026-01-15');
    getState().clearContracts();
    expect(getState().contracts).toHaveLength(0);
    expect(getState().claims).toHaveLength(0);
    expect(getState().contractCount).toBe(0);
    expect(getState().claimCount).toBe(0);
    expect(getState().totalPremium).toBe(0);
    expect(getState().totalClaim).toBe(0);
    expect(getState().poolBalance).toBe(10000);
  });
});
