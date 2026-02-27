import { create } from 'zustand';
import i18n from '@/i18n';

/* ── Types ── */
export type Role = 'leader' | 'partA' | 'partB' | 'rein' | 'operator';

export interface Shares {
  leader: number;
  partA: number;
  partB: number;
}

export interface Contract {
  id: number;
  name: string;
  flight: string;
  date: string;
  lNet: number;
  aNet: number;
  bNet: number;
  rNet: number;
  status: 'active' | 'claimed';
  ts: string;
}

export interface Claim {
  id: number;
  contractId: number;
  name: string;
  flight: string;
  delay: number;
  tier: string;
  payout: number;
  lNet: number;
  aNet: number;
  bNet: number;
  totRC: number;
  rNet: number;
  status: 'claimable' | 'approved' | 'settled';
  ts: string;
  color: string;
  approvedAt?: string;
  settledAt?: string;
}

export interface Acc {
  leaderPrem: number;
  partAPrem: number;
  partBPrem: number;
  reinPrem: number;
  leaderClaim: number;
  partAClaim: number;
  partBClaim: number;
  reinClaim: number;
}

export interface LogEntry {
  id: number;
  msg: string;
  color: string;
  instruction: string;
  detail: string;
  time: string;
  txSignature?: string;
}

export type ProtocolMode = 'simulation' | 'onchain';

export interface PoolHistEntry {
  t: string;
  v: number;
}

export interface PremHistEntry {
  t: string;
  v: number;
}

/* ── Constants ── */
export const TIERS = [
  { min: 120, max: 179, p: 40, label: '2h~2h59m', color: '#F59E0B' },
  { min: 180, max: 239, p: 60, label: '3h~3h59m', color: '#f97316' },
  { min: 240, max: 359, p: 80, label: '4h~5h59m', color: '#EF4444' },
  { min: 360, max: 9999, p: 100, label: '6h+/결항', color: '#fca5a5' },
] as const;

export const FLIGHTS = ['KE081', 'OZ201', 'KE085', 'OZ211', 'KE073'] as const;
export const FLIGHT_ROUTES: Record<string, string> = {
  KE081: 'ICN→JFK',
  OZ201: 'ICN→LAX',
  KE085: 'ICN→ORD',
  OZ211: 'ICN→SFO',
  KE073: 'ICN→ATL',
};
export const DATES = [
  '2026-01-15', '2026-01-22', '2026-02-05', '2026-02-15', '2026-02-28',
  '2026-03-10', '2026-03-15', '2026-04-01', '2026-04-20', '2026-05-10',
];
export const NAMES = [
  '홍길동', '김영희', '이철수', '박민준', '최수진', '정다은', '강지훈', '윤서연',
  '임태양', '한소희', '오민수', '장예은', '배준혁', '신아름', '류성호', '문지수',
  '권태일', '송미래', '노현서', '황동주',
];

export const ROLES: Record<Role, { label: string; color: string }> = {
  leader: { label: '리더사(삼성화재)', color: '#9945FF' },
  partA: { label: '참여사A(현대해상)', color: '#14F195' },
  partB: { label: '참여사B(DB손보)', color: '#F59E0B' },
  rein: { label: '재보험사', color: '#38BDF8' },
  operator: { label: 'Operator', color: '#EF4444' },
};

export const POLICY_STATES = ['Draft', 'Open', 'Funded', 'Active', 'Claimable', 'Approved', 'Settled'] as const;
export const POLICY_STATE_ICONS = ['📄', '📂', '💰', '⚡', '🔔', '✅', '💸'] as const;

/* ── Utility Functions ── */
export function getTier(delay: number) {
  for (const t of TIERS) {
    if (delay >= t.min && delay <= t.max) return t;
  }
  return null;
}

export function fakePubkey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  const c = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let a = '';
  for (let i = 0; i < 44; i++) a += c[Math.abs(h * i * 17 + i + 13) % 58];
  return a;
}

export const masterPDA = () => fakePubkey('master_contract_2026_flight_delay');
export const poolPDA = () => fakePubkey('pool_' + masterPDA());
export const vaultPDA = () => fakePubkey('vault_' + poolPDA());
export const ledgerPDA = () => fakePubkey('ledger_' + masterPDA());

export const formatNum = (n: number, d = 2) =>
  Number(n).toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const getRoleLabel = (role: Role): string => i18n.t(`role.${role}Short`);

const nowTime = () =>
  new Date().toLocaleTimeString('ko-KR', { hour12: false });

const nowDate = () =>
  new Date().toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

/* ── Store ── */
interface ProtocolState {
  mode: ProtocolMode;
  role: Role;
  masterActive: boolean;
  processStep: number;
  policyStateIdx: number;
  confirms: { partA: boolean; partB: boolean; rein: boolean };
  shares: Shares;
  poolBalance: number;
  totalPremium: number;
  totalClaim: number;
  contracts: Contract[];
  claims: Claim[];
  contractCount: number;
  claimCount: number;
  acc: Acc;
  logs: LogEntry[];
  logIdCounter: number;
  premHist: PremHistEntry[];
  poolHist: PoolHistEntry[];

  // Reinsurance ratios (bps, 10000 = 100%)
  cededRatioBps: number;
  reinsCommissionBps: number;

  // On-chain state
  masterPolicyPDA: string | null;
  lastTxSignature: string | null;

  // Actions
  setMode: (m: ProtocolMode) => void;
  setRole: (r: Role) => void;
  setShares: (s: Partial<Shares>) => void;
  setTerms: () => { ok: boolean; msg?: string };
  confirmParty: (key: 'partA' | 'partB' | 'rein') => void;
  activateMaster: () => { ok: boolean; msg?: string };
  addContract: (name?: string, flight?: string, date?: string) => void;
  clearContracts: () => void;
  runOracle: (contractId: number, delay: number, fresh: number, cancelled: boolean) => { ok: boolean; msg: string; type: 'error' | 'ok' | 'info'; code?: string };
  approveClaims: () => number;
  settleClaims: () => number;
  addLog: (msg: string, color: string, instruction: string, detail?: string, txSignature?: string) => void;
  setMasterPolicyPDA: (pda: string | null) => void;
  onChainSetTerms: (txSignature: string, cededRatioBps?: number, reinsCommissionBps?: number) => void;
  onChainConfirm: (key: 'partA' | 'partB' | 'rein', txSignature: string) => void;
  onChainActivate: (txSignature: string, pda: string) => void;
  onChainAddContract: (id: number, name: string, flight: string, date: string, txSignature: string) => void;
  onChainResolve: (contractId: number, delay: number, cancelled: boolean, txSignature: string) => void;
  onChainSettle: (contractId: number, txSignature: string) => void;
  resetAll: () => void;
}

const INITIAL_ACC: Acc = { leaderPrem: 0, partAPrem: 0, partBPrem: 0, reinPrem: 0, leaderClaim: 0, partAClaim: 0, partBClaim: 0, reinClaim: 0 };

export const useProtocolStore = create<ProtocolState>((set, get) => ({
  mode: 'simulation' as ProtocolMode,
  role: 'leader',
  masterActive: false,
  processStep: 0,
  policyStateIdx: -1,
  confirms: { partA: false, partB: false, rein: false },
  shares: { leader: 50, partA: 30, partB: 20 },
  poolBalance: 10000,
  totalPremium: 0,
  totalClaim: 0,
  contracts: [],
  claims: [],
  contractCount: 0,
  claimCount: 0,
  acc: { ...INITIAL_ACC },
  logs: [],
  logIdCounter: 0,
  premHist: [],
  poolHist: [{ t: 'init', v: 10000 }],

  // Reinsurance ratios (bps)
  cededRatioBps: 5000,       // 50%
  reinsCommissionBps: 1000,  // 10%

  // On-chain state
  masterPolicyPDA: null,
  lastTxSignature: null,

  setMode: (m) => {
    set({ mode: m });
    get().addLog(`Mode → ${m}`, '#9945FF', 'system');
  },

  setRole: (r) => {
    set({ role: r });
    get().addLog(i18n.t('store.roleSwitch', { role: getRoleLabel(r) }), ROLES[r].color, 'role_switch');
  },

  setShares: (s) => set(st => ({ shares: { ...st.shares, ...s } })),

  setTerms: () => {
    const { role, shares } = get();
    if (role !== 'leader' && role !== 'operator') return { ok: false, msg: i18n.t('store.leaderOnly') };
    if (shares.leader + shares.partA + shares.partB !== 100) return { ok: false, msg: i18n.t('store.shareSumError') };
    set({ processStep: 1, policyStateIdx: 0 });
    get().addLog(
      i18n.t('store.termsSet'), '#9945FF', 'set_terms',
      i18n.t('store.termsDetail', { leader: shares.leader, partA: shares.partA, partB: shares.partB }),
    );
    return { ok: true };
  },

  confirmParty: (key) => {
    set(st => {
      const c = { ...st.confirms, [key]: true };
      let step = st.processStep;
      if (c.partA && step < 2) step = 2;
      if (c.partA && c.partB && step < 3) step = 3;
      if (c.partA && c.partB && c.rein && step < 4) step = 4;
      return { confirms: c, processStep: step };
    });
    get().addLog(i18n.t('store.confirmDone', { role: getRoleLabel(key) }), ROLES[key].color, 'confirm_party');
  },

  activateMaster: () => {
    const { role, confirms } = get();
    if (role !== 'leader' && role !== 'operator') return { ok: false, msg: i18n.t('store.leaderOnly') };
    if (!confirms.partA || !confirms.partB || !confirms.rein) return { ok: false, msg: i18n.t('store.allConfirmNeeded') };
    set({ masterActive: true, policyStateIdx: 3, processStep: 5 });
    get().addLog(
      i18n.t('store.masterActivated'), '#14F195', 'activate_master',
      i18n.t('store.masterDetail', { pda: masterPDA().substring(0, 16) }),
    );
    return { ok: true };
  },

  addContract: (autoName, autoFlight, autoDate) => {
    const st = get();
    if (!st.masterActive) return;
    const newCnt = st.contractCount + 1;
    const name = autoName || i18n.t('store.defaultName');
    const flight = autoFlight || 'KE081';
    const date = autoDate || '2026-01-15';
    const lS = st.shares.leader / 100;
    const aS = st.shares.partA / 100;
    const bS = st.shares.partB / 100;
    const ceded = st.cededRatioBps / 10000;
    const comm = st.reinsCommissionBps / 10000;
    const lRaw = lS, aRaw = aS, bRaw = bS;
    const lToR = lRaw * ceded, aToR = aRaw * ceded, bToR = bRaw * ceded;
    const lNet = lRaw - lToR + comm * lS;
    const aNet = aRaw - aToR + comm * aS;
    const bNet = bRaw - bToR + comm * bS;
    const rNet = (lToR + aToR + bToR) - comm;

    const ct: Contract = { id: newCnt, name, flight, date, lNet, aNet, bNet, rNet, status: 'active', ts: nowDate() };
    set(prev => ({
      contractCount: newCnt,
      contracts: [...prev.contracts, ct],
      totalPremium: prev.totalPremium + 1,
      acc: {
        ...prev.acc,
        leaderPrem: prev.acc.leaderPrem + lNet,
        partAPrem: prev.acc.partAPrem + aNet,
        partBPrem: prev.acc.partBPrem + bNet,
        reinPrem: prev.acc.reinPrem + rNet,
      },
      premHist: [...prev.premHist, { t: nowTime(), v: prev.totalPremium + 1 }],
    }));
    get().addLog(
      i18n.t('store.newContract', { id: newCnt, name, flight, date }), ROLES.leader.color, 'new_contract',
      i18n.t('store.newContractDetail', { lNet: formatNum(lNet, 4), aNet: formatNum(aNet, 4), bNet: formatNum(bNet, 4), rNet: formatNum(rNet, 4) }),
    );
  },

  clearContracts: () => {
    set({
      contracts: [],
      contractCount: 0,
      acc: { ...INITIAL_ACC },
      totalPremium: 0,
      totalClaim: 0,
      poolBalance: 10000,
      premHist: [],
      poolHist: [{ t: 'init', v: 10000 }],
      claims: [],
      claimCount: 0,
    });
  },

  runOracle: (contractId, delay, fresh, cancelled) => {
    const st = get();
    if (fresh < 0 || fresh > 30) return { ok: false, msg: i18n.t('store.oracleStale', { fresh }), type: 'error' as const, code: 'E_ORACLE_STALE' };
    if (delay < 0 || delay % 10 !== 0) return { ok: false, msg: i18n.t('store.oracleFormat', { delay }), type: 'error' as const, code: 'E_ORACLE_FORMAT' };

    // Cancellation overrides delay: treat as highest tier regardless of actual delay
    const tier = cancelled ? TIERS[3] : getTier(delay);
    if (!tier) {
      get().addLog(i18n.t('store.oracleNoTrigger', { delay }), '#22C55E', 'check_oracle');
      return { ok: true, msg: i18n.t('store.oracleNoTriggerMsg', { delay }), type: 'ok' as const };
    }

    const contract = st.contracts.find(c => c.id === contractId);
    if (!contract) return { ok: false, msg: i18n.t('store.contractNotFound', { id: contractId }), type: 'error' as const, code: 'E_CONTRACT_NOT_FOUND' };
    if (contract.status === 'claimed') return { ok: false, msg: i18n.t('store.alreadyClaimed', { id: contractId }), type: 'error' as const, code: 'E_ALREADY_CLAIMED' };
    const ceded = st.cededRatioBps / 10000;
    const commRate = st.reinsCommissionBps / 10000;
    const newClCnt = st.claimCount + 1;
    const payout = tier.p;
    const lS = st.shares.leader / 100, aS = st.shares.partA / 100, bS = st.shares.partB / 100;
    const lPay = payout * lS, aPay = payout * aS, bPay = payout * bS;
    const lRC = lPay * ceded, aRC = aPay * ceded, bRC = bPay * ceded, totRC = lRC + aRC + bRC;
    const clComm = payout * commRate;
    const lNet = lPay - lRC + clComm * lS;
    const aNet = aPay - aRC + clComm * aS;
    const bNet = bPay - bRC + clComm * bS;
    const rNet = totRC - clComm;

    const cl: Claim = {
      id: newClCnt, contractId, name: contract?.name || i18n.t('store.defaultName'), flight: contract?.flight || '—',
      delay, tier: tier.label, payout, lNet, aNet, bNet, totRC, rNet,
      status: 'claimable', ts: nowDate(), color: tier.color,
    };

    set(prev => ({
      claimCount: newClCnt,
      claims: [...prev.claims, cl],
      totalClaim: prev.totalClaim + payout,
      poolBalance: Math.max(0, prev.poolBalance - payout),
      policyStateIdx: Math.max(prev.policyStateIdx, 4),
      acc: {
        ...prev.acc,
        leaderClaim: prev.acc.leaderClaim + lNet,
        partAClaim: prev.acc.partAClaim + aNet,
        partBClaim: prev.acc.partBClaim + bNet,
        reinClaim: prev.acc.reinClaim + rNet,
      },
      contracts: prev.contracts.map(c => c.id === contractId ? { ...c, status: 'claimed' as const } : c),
      poolHist: [...prev.poolHist, { t: nowTime(), v: Math.max(0, prev.poolBalance - payout) }],
    }));

    get().addLog(
      i18n.t('store.claimLog', { id: newClCnt, tier: tier.label, payout }), tier.color, 'create_claim',
      i18n.t('store.claimDetail', { lNet: formatNum(lNet, 2), aNet: formatNum(aNet, 2), bNet: formatNum(bNet, 2), totRC: formatNum(totRC, 2) }),
    );

    return { ok: true, msg: i18n.t('store.claimCreated', { delay, tier: tier.label, payout }), type: 'ok' as const };
  },

  approveClaims: () => {
    const st = get();
    const pend = st.claims.filter(c => c.status === 'claimable');
    if (!pend.length) return 0;
    const pendIds = new Set(pend.map(c => c.id));
    set(prev => ({
      claims: prev.claims.map(c => pendIds.has(c.id) ? { ...c, status: 'approved' as const, approvedAt: nowDate() } : c),
      policyStateIdx: Math.max(prev.policyStateIdx, 5),
    }));
    get().addLog(i18n.t('store.claimsApproved', { count: pend.length, role: getRoleLabel(st.role) }), '#22C55E', 'approve_claim');
    return pend.length;
  },

  settleClaims: () => {
    const st = get();
    const appr = st.claims.filter(c => c.status === 'approved');
    if (!appr.length) return 0;
    const apprIds = new Set(appr.map(c => c.id));
    set(prev => ({
      claims: prev.claims.map(c => apprIds.has(c.id) ? { ...c, status: 'settled' as const, settledAt: nowDate() } : c),
      policyStateIdx: 6,
    }));
    get().addLog(
      i18n.t('store.claimsSettled', { count: appr.length }), '#14F195', 'settle_claim',
      i18n.t('store.settledDetail', { totalClaim: formatNum(st.totalClaim, 2), poolBalance: formatNum(st.poolBalance, 2) }),
    );
    return appr.length;
  },

  addLog: (msg, color, instruction, detail = '', txSignature) => {
    set(prev => ({
      logIdCounter: prev.logIdCounter + 1,
      lastTxSignature: txSignature || prev.lastTxSignature,
      logs: [{ id: prev.logIdCounter + 1, msg, color, instruction, detail, time: nowTime(), txSignature }, ...prev.logs].slice(0, 80),
    }));
  },

  setMasterPolicyPDA: (pda) => set({ masterPolicyPDA: pda }),

  /* ── On-chain action callbacks (called by components after successful tx) ── */

  onChainSetTerms: (txSignature, cededBps, commBps) => {
    const { shares } = get();
    set({
      processStep: 1,
      policyStateIdx: 0,
      ...(cededBps != null && { cededRatioBps: cededBps }),
      ...(commBps != null && { reinsCommissionBps: commBps }),
    });
    get().addLog(
      i18n.t('store.termsSet'), '#9945FF', 'create_master_policy',
      i18n.t('store.termsDetail', { leader: shares.leader, partA: shares.partA, partB: shares.partB }),
      txSignature,
    );
  },

  onChainConfirm: (key, txSignature) => {
    set(st => {
      const c = { ...st.confirms, [key]: true };
      let step = st.processStep;
      if (c.partA && step < 2) step = 2;
      if (c.partA && c.partB && step < 3) step = 3;
      if (c.partA && c.partB && c.rein && step < 4) step = 4;
      return { confirms: c, processStep: step };
    });
    get().addLog(
      i18n.t('store.confirmDone', { role: getRoleLabel(key) }), ROLES[key].color, 'confirm_master',
      '', txSignature,
    );
  },

  onChainActivate: (txSignature, pda) => {
    set({ masterActive: true, policyStateIdx: 3, processStep: 5, masterPolicyPDA: pda });
    get().addLog(
      i18n.t('store.masterActivated'), '#14F195', 'activate_master',
      `PDA: ${pda.substring(0, 16)}...`, txSignature,
    );
  },

  onChainAddContract: (id, name, flight, date, txSignature) => {
    const st = get();
    const lS = st.shares.leader / 100;
    const aS = st.shares.partA / 100;
    const bS = st.shares.partB / 100;
    const ceded = st.cededRatioBps / 10000;
    const comm = st.reinsCommissionBps / 10000;
    const lRaw = lS, aRaw = aS, bRaw = bS;
    const lToR = lRaw * ceded, aToR = aRaw * ceded, bToR = bRaw * ceded;
    const lNet = lRaw - lToR + comm * lS;
    const aNet = aRaw - aToR + comm * aS;
    const bNet = bRaw - bToR + comm * bS;
    const rNet = (lToR + aToR + bToR) - comm;

    const ct: Contract = { id, name, flight, date, lNet, aNet, bNet, rNet, status: 'active', ts: nowDate() };
    set(prev => ({
      contractCount: id,
      contracts: [...prev.contracts, ct],
      totalPremium: prev.totalPremium + 1,
      acc: {
        ...prev.acc,
        leaderPrem: prev.acc.leaderPrem + lNet,
        partAPrem: prev.acc.partAPrem + aNet,
        partBPrem: prev.acc.partBPrem + bNet,
        reinPrem: prev.acc.reinPrem + rNet,
      },
      premHist: [...prev.premHist, { t: nowTime(), v: prev.totalPremium + 1 }],
    }));
    get().addLog(
      i18n.t('store.newContract', { id, name, flight, date }), ROLES.leader.color, 'create_flight_policy',
      i18n.t('store.newContractDetail', { lNet: formatNum(lNet, 4), aNet: formatNum(aNet, 4), bNet: formatNum(bNet, 4), rNet: formatNum(rNet, 4) }),
      txSignature,
    );
  },

  onChainResolve: (contractId, delay, cancelled, txSignature) => {
    const st = get();
    const contract = st.contracts.find(c => c.id === contractId);
    if (!contract) return;

    // Cancellation overrides delay: treat as highest tier regardless of actual delay
    const tier = cancelled ? TIERS[3] : getTier(delay);
    // No trigger (delay < 120min): on-chain status → NoClaim, mark contract resolved
    if (!tier) {
      set(prev => ({
        contracts: prev.contracts.map(c => c.id === contractId ? { ...c, status: 'claimed' as const } : c),
      }));
      get().addLog(
        i18n.t('store.noTrigger', { id: contractId }), '#22c55e', 'resolve_flight_delay',
        `delay=${delay}min (< 120min threshold)`, txSignature,
      );
      return;
    }

    const ceded = st.cededRatioBps / 10000;
    const commRate = st.reinsCommissionBps / 10000;
    const newClCnt = st.claimCount + 1;
    const payout = tier.p;
    const lS = st.shares.leader / 100, aS = st.shares.partA / 100, bS = st.shares.partB / 100;
    const lPay = payout * lS, aPay = payout * aS, bPay = payout * bS;
    const lRC = lPay * ceded, aRC = aPay * ceded, bRC = bPay * ceded, totRC = lRC + aRC + bRC;
    const clComm = payout * commRate;
    const lNet = lPay - lRC + clComm * lS;
    const aNet = aPay - aRC + clComm * aS;
    const bNet = bPay - bRC + clComm * bS;
    const rNet = totRC - clComm;

    const cl: Claim = {
      id: newClCnt, contractId, name: contract.name, flight: contract.flight,
      delay, tier: tier.label, payout, lNet, aNet, bNet, totRC, rNet,
      status: 'claimable', ts: nowDate(), color: tier.color,
    };

    set(prev => ({
      claimCount: newClCnt,
      claims: [...prev.claims, cl],
      totalClaim: prev.totalClaim + payout,
      poolBalance: Math.max(0, prev.poolBalance - payout),
      policyStateIdx: Math.max(prev.policyStateIdx, 4),
      acc: {
        ...prev.acc,
        leaderClaim: prev.acc.leaderClaim + lNet,
        partAClaim: prev.acc.partAClaim + aNet,
        partBClaim: prev.acc.partBClaim + bNet,
        reinClaim: prev.acc.reinClaim + rNet,
      },
      contracts: prev.contracts.map(c => c.id === contractId ? { ...c, status: 'claimed' as const } : c),
      poolHist: [...prev.poolHist, { t: nowTime(), v: Math.max(0, prev.poolBalance - payout) }],
    }));

    get().addLog(
      i18n.t('store.claimLog', { id: newClCnt, tier: tier.label, payout }), tier.color, 'resolve_flight_delay',
      i18n.t('store.claimDetail', { lNet: formatNum(lNet, 2), aNet: formatNum(aNet, 2), bNet: formatNum(bNet, 2), totRC: formatNum(totRC, 2) }),
      txSignature,
    );
  },

  onChainSettle: (contractId, txSignature) => {
    set(prev => ({
      claims: prev.claims.map(c =>
        c.contractId === contractId && c.status !== 'settled'
          ? { ...c, status: 'settled' as const, settledAt: nowDate() }
          : c,
      ),
      policyStateIdx: 6,
    }));
    get().addLog(
      i18n.t('store.settledOnchain', { id: contractId }), '#14F195', 'settle_flight_claim',
      '', txSignature,
    );
  },

  resetAll: () => {
    set({
      masterActive: false, policyStateIdx: -1, processStep: 0,
      confirms: { partA: false, partB: false, rein: false },
      shares: { leader: 50, partA: 30, partB: 20 },
      cededRatioBps: 5000, reinsCommissionBps: 1000,
      poolBalance: 10000, totalPremium: 0, totalClaim: 0,
      contracts: [], claims: [], contractCount: 0, claimCount: 0,
      acc: { ...INITIAL_ACC },
      premHist: [], poolHist: [{ t: 'init', v: 10000 }],
      logs: [], logIdCounter: 0,
      masterPolicyPDA: null, lastTxSignature: null,
    });
    get().addLog(i18n.t('store.resetMsg'), '#9945FF', 'system_init');
  },
}));
