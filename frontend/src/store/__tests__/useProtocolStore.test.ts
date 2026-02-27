import { describe, it, expect, beforeEach } from 'vitest';
import { useProtocolStore } from '../useProtocolStore';

// Helper to get fresh store state
const getState = () => useProtocolStore.getState();
const { setState } = useProtocolStore;

beforeEach(() => {
  getState().resetAll();
  // Ensure leader role for most tests
  setState({ role: 'leader' });
});

describe('setTerms', () => {
  it('succeeds when role is leader and shares sum to 100', () => {
    setState({ role: 'leader', shares: { leader: 50, partA: 30, partB: 20 } });
    const result = getState().setTerms();
    expect(result.ok).toBe(true);
    expect(getState().processStep).toBe(1);
  });

  it('succeeds when role is operator', () => {
    setState({ role: 'operator', shares: { leader: 50, partA: 30, partB: 20 } });
    const result = getState().setTerms();
    expect(result.ok).toBe(true);
  });

  it('fails when role is partA', () => {
    setState({ role: 'partA' });
    const result = getState().setTerms();
    expect(result.ok).toBe(false);
    expect(result.msg).toBeDefined();
  });

  it('fails when shares do not sum to 100', () => {
    setState({ shares: { leader: 50, partA: 30, partB: 10 } });
    const result = getState().setTerms();
    expect(result.ok).toBe(false);
    expect(result.msg).toBeDefined();
  });

  it('sets policyStateIdx to 0 on success', () => {
    setState({ shares: { leader: 50, partA: 30, partB: 20 } });
    getState().setTerms();
    expect(getState().policyStateIdx).toBe(0);
  });
});

describe('confirmParty', () => {
  beforeEach(() => {
    setState({ processStep: 1 });
  });

  it('partA confirmation sets processStep to 2', () => {
    getState().confirmParty('partA');
    expect(getState().confirms.partA).toBe(true);
    expect(getState().processStep).toBe(2);
  });

  it('partA + partB sets processStep to 3', () => {
    getState().confirmParty('partA');
    getState().confirmParty('partB');
    expect(getState().processStep).toBe(3);
  });

  it('all three confirmations set processStep to 4', () => {
    getState().confirmParty('partA');
    getState().confirmParty('partB');
    getState().confirmParty('rein');
    expect(getState().processStep).toBe(4);
    expect(getState().confirms).toEqual({ partA: true, partB: true, rein: true });
  });

  it('partB alone does not advance processStep beyond 1', () => {
    getState().confirmParty('partB');
    expect(getState().processStep).toBe(1);
  });
});

describe('activateMaster', () => {
  it('fails when not all parties confirmed', () => {
    setState({ confirms: { partA: true, partB: true, rein: false } });
    const result = getState().activateMaster();
    expect(result.ok).toBe(false);
  });

  it('fails when role is not leader', () => {
    setState({
      role: 'partA',
      confirms: { partA: true, partB: true, rein: true },
    });
    const result = getState().activateMaster();
    expect(result.ok).toBe(false);
  });

  it('succeeds with all confirmations and leader role', () => {
    setState({
      role: 'leader',
      confirms: { partA: true, partB: true, rein: true },
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
      shares: { leader: 50, partA: 30, partB: 20 },
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
    // aNet = 0.3 * 0.55 * 3 = 0.495
    // bNet = 0.2 * 0.55 * 3 = 0.33
    // rNet = 0.45 * 3 = 1.35
    expect(ct.lNet).toBeCloseTo(0.825, 6);
    expect(ct.aNet).toBeCloseTo(0.495, 6);
    expect(ct.bNet).toBeCloseTo(0.33, 6);
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
    expect(acc.partAPrem).toBeCloseTo(0.495 * 2, 6);
    expect(acc.partBPrem).toBeCloseTo(0.33 * 2, 6);
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
      shares: { leader: 50, partA: 30, partB: 20 },
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
    // aNet = 5 * 0.55 * 0.3 = 0.825
    // bNet = 5 * 0.55 * 0.2 = 0.55
    // rNet = 5 * 0.45 = 2.25
    expect(cl.lNet).toBeCloseTo(1.375, 6);
    expect(cl.aNet).toBeCloseTo(0.825, 6);
    expect(cl.bNet).toBeCloseTo(0.55, 6);
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
    // Add another contract to test with
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
    expect(acc.partAClaim).toBeCloseTo(0.825 + 1.32, 6);
    expect(acc.partBClaim).toBeCloseTo(0.55 + 0.88, 6);
    expect(acc.reinClaim).toBeCloseTo(2.25 + 3.6, 6);
  });
});

describe('approveClaims', () => {
  beforeEach(() => {
    setState({
      masterActive: true,
      shares: { leader: 50, partA: 30, partB: 20 },
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
      shares: { leader: 50, partA: 30, partB: 20 },
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
