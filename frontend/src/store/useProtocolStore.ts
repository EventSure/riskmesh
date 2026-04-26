import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MasterAgreementStatus, FlightPolicyStatus, type MasterAgreementAccount } from '@/lib/idl/open_parametric';
import type { FlightPolicyWithKey } from '@/hooks/useFlightPolicies';
import i18n from '@/i18n';

/* ── Types ── */
export type Role = 'leader' | 'participant' | 'rein' | 'operator';

export interface Participant {
  id: string;
  name: string;
  share: number;
  address: string;
  confirmed: boolean;
}

export interface ReinsurerConfig {
  enabled: boolean;
  name?: string;
  address: string;
  confirmed: boolean;
}

interface MasterAgreementDisplayNames {
  participants: Array<{
    wallet: string;
    displayName: string;
  }>;
  reinsurer: {
    wallet: string;
    displayName: string;
  } | null;
}

export interface Contract {
  id: number;
  name: string;
  flight: string;
  date: string;
  lNet: number;
  participantNets: number[];
  rNet: number;
  status: 'active' | 'claimed' | 'paid' | 'noClaim' | 'expired' | 'settled';
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
  participantNets: number[];
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
  participantPrems: number[];
  reinPrem: number;
  leaderClaim: number;
  participantClaims: number[];
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

export interface MasterAgreementSummary {
  pda: string;
  masterId: string;
  status: number;
  statusLabel: string;
  coverageEndTs: number;
  myRole?: 'leader' | 'participant' | 'rein';
}

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
  { min: 120, max: 179, key: 'delay2h' as const, label: '2h~2h59m', color: '#F59E0B' },
  { min: 180, max: 239, key: 'delay3h' as const, label: '3h~3h59m', color: '#f97316' },
  { min: 240, max: 359, key: 'delay4to5h' as const, label: '4h~5h59m', color: '#EF4444' },
  { min: 360, max: 9999, key: 'delay6hOrCancelled' as const, label: '6h+/결항', color: '#fca5a5' },
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
  participant: { label: '참여사', color: '#14F195' },
  rein: { label: '재보험사', color: '#38BDF8' },
  operator: { label: 'Operator', color: '#EF4444' },
};

export const PARTICIPANT_COLORS = ['#14F195', '#F59E0B', '#38BDF8', '#A78BFA'] as const;
export const REINSURER_COLOR = '#EC4899';

export const MAX_PARTICIPANTS = 4;

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
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number(n));

export const getRoleLabel = (role: string): string => {
  if (role === 'rein') return i18n.t('role.reinShort');
  if (role === 'leader') return i18n.t('role.leaderShort');
  if (role === 'operator') return i18n.t('role.operatorShort');
  if (role === 'participant') return i18n.t('role.participantShort');
  return role;
};

const nowTime = () =>
  new Date().toLocaleTimeString('ko-KR', { hour12: false });

const nowDate = () =>
  new Date().toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

const makeInitialAcc = (n: number): Acc => ({
  leaderPrem: 0, participantPrems: new Array(n).fill(0), reinPrem: 0,
  leaderClaim: 0, participantClaims: new Array(n).fill(0), reinClaim: 0,
});

const DEFAULT_PARTICIPANT: Participant = { id: 'p1', name: '', share: 50, address: '', confirmed: false };
const participantFallbackName = (index: number) => `${i18n.t('confirm.participant')} ${index + 1}`;

/* ── Store ── */
interface ProtocolState {
  mode: ProtocolMode;
  role: Role;
  masterActive: boolean;
  processStep: number;
  policyStateIdx: number;
  leaderShare: number;
  participants: Participant[];
  reinsurer: ReinsurerConfig;
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

  // Master policy terms (USDC display units)
  coverageStart: string;
  coverageEnd: string;
  premiumPerPolicy: number;
  payoutTiers: { delay2h: number; delay3h: number; delay4to5h: number; delay6hOrCancelled: number };

  // Reinsurance ratios (bps, 10000 = 100%)
  cededRatioBps: number;
  reinsCommissionBps: number;

  // On-chain state
  poolRefreshKey: number;
  masterAgreementPDA: string | null;
  lastTxSignature: string | null;
  masterAgreements: MasterAgreementSummary[];
  lastDaemonActivityTs: number | null;
  kpiSnapshot: { poolBalance: number; claimCount: number; flightPolicyCount: number } | null;
  displayNamesByWallet: Record<string, string>;

  // Actions
  setMode: (m: ProtocolMode) => void;
  setRole: (r: Role) => void;
  setLeaderShare: (v: number) => void;
  addParticipant: () => void;
  removeParticipant: (id: string) => void;
  updateParticipant: (id: string, patch: Partial<Omit<Participant, 'id'>>) => void;
  setReinsurer: (patch: Partial<ReinsurerConfig>) => void;
  toggleReinsurer: () => void;
  setCoverage: (c: { start?: string; end?: string }) => void;
  setTerms: () => { ok: boolean; msg?: string };
  confirmParticipant: (id: string) => void;
  confirmReinsurer: () => void;
  activateMaster: () => { ok: boolean; msg?: string };
  addContract: (name?: string, flight?: string, date?: string) => void;
  clearContracts: () => void;
  runOracle: (contractId: number, delay: number, fresh: number, cancelled: boolean) => { ok: boolean; msg: string; type: 'error' | 'ok' | 'info'; code?: string };
  approveClaims: () => number;
  settleClaims: () => number;
  addLog: (msg: string, color: string, instruction: string, detail?: string, txSignature?: string) => void;
  applyMasterAgreementDisplayNames: (payload: MasterAgreementDisplayNames) => void;
  setMasterAgreementPDA: (pda: string | null) => void;
  setMasterAgreements: (list: MasterAgreementSummary[]) => void;
  selectMasterAgreement: (pda: string | null) => void;
  onChainSetTerms: (txSignature: string, opts?: {
    cededRatioBps?: number;
    reinsCommissionBps?: number;
    premium?: number;
    payoutTiers?: { delay2h: number; delay3h: number; delay4to5h: number; delay6hOrCancelled: number };
    coverageDates?: { start: string; end: string };
    leaderShare?: number;
    participants?: Participant[];
    reinsurer?: ReinsurerConfig;
  }) => void;
  onChainConfirm: (target: string, txSignature: string) => void;
  onChainActivate: (txSignature: string, pda: string) => void;
  onChainAddContract: (id: number, name: string, flight: string, date: string, txSignature: string) => void;
  onChainResolve: (contractId: number, delay: number, cancelled: boolean, txSignature: string) => void;
  onChainSettle: (contractId: number, txSignature: string) => void;
  refreshPool: () => void;
  setPoolBalance: (balance: number) => void;
  captureKpiSnapshot: () => void;
  resetAll: () => void;
  syncMasterFromChain: (data: MasterAgreementAccount) => void;
  syncFlightPoliciesFromChain: (policies: FlightPolicyWithKey[]) => void;
}

let participantIdCounter = 1;

export const useProtocolStore = create<ProtocolState>()(persist((set, get) => ({
  mode: 'simulation' as ProtocolMode,
  role: 'leader',
  masterActive: false,
  processStep: 0,
  policyStateIdx: -1,
  leaderShare: 50,
  participants: [{ ...DEFAULT_PARTICIPANT }],
  reinsurer: { enabled: true, address: '', confirmed: false },
  poolBalance: 10000,
  totalPremium: 0,
  totalClaim: 0,
  contracts: [],
  claims: [],
  contractCount: 0,
  claimCount: 0,
  kpiSnapshot: null,
  displayNamesByWallet: {},
  acc: makeInitialAcc(1),
  logs: [],
  logIdCounter: 0,
  premHist: [],
  poolHist: [{ t: 'init', v: 10000 }],

  // Master policy terms
  coverageStart: '2026-01-01',
  coverageEnd: '2026-12-31',
  premiumPerPolicy: 3,
  payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },

  // Reinsurance ratios (bps)
  cededRatioBps: 5000,       // 50%
  reinsCommissionBps: 1000,  // 10%

  // On-chain state
  poolRefreshKey: 0,
  masterAgreementPDA: null,
  lastTxSignature: null,
  masterAgreements: [],
  lastDaemonActivityTs: null,

  setMode: (m) => {
    set({ mode: m });
    get().addLog(`Mode → ${m}`, '#9945FF', 'system');
  },

  setRole: (r) => {
    set({ role: r });
    get().addLog(i18n.t('store.roleSwitch', { role: getRoleLabel(r) }), ROLES[r].color, 'role_switch');
  },

  setLeaderShare: (v) => set({ leaderShare: v }),

  addParticipant: () => {
    set(st => {
      if (st.participants.length >= MAX_PARTICIPANTS) return st;
      participantIdCounter++;
      const newP: Participant = {
        id: `p${participantIdCounter}`,
        name: '',
        share: 0,
        address: '',
        confirmed: false,
      };
      return {
        participants: [...st.participants, newP],
        acc: {
          ...st.acc,
          participantPrems: [...st.acc.participantPrems, 0],
          participantClaims: [...st.acc.participantClaims, 0],
        },
      };
    });
  },

  removeParticipant: (id) => {
    set(st => {
      if (st.participants.length <= 1) return st;
      const idx = st.participants.findIndex(p => p.id === id);
      if (idx < 0) return st;
      const participants = st.participants.filter(p => p.id !== id);
      const participantPrems = st.acc.participantPrems.filter((_, i) => i !== idx);
      const participantClaims = st.acc.participantClaims.filter((_, i) => i !== idx);
      return {
        participants,
        acc: { ...st.acc, participantPrems, participantClaims },
      };
    });
  },

  updateParticipant: (id, patch) => {
    set(st => ({
      participants: st.participants.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  },

  setReinsurer: (patch) => set(st => ({ reinsurer: { ...st.reinsurer, ...patch } })),

  toggleReinsurer: () => set(st => ({
    reinsurer: { ...st.reinsurer, enabled: !st.reinsurer.enabled, confirmed: false, address: st.reinsurer.enabled ? '' : st.reinsurer.address },
  })),

  setCoverage: (c) => set(st => ({ coverageStart: c.start ?? st.coverageStart, coverageEnd: c.end ?? st.coverageEnd })),

  setTerms: () => {
    const { role, leaderShare, participants } = get();
    if (role !== 'leader' && role !== 'operator') return { ok: false, msg: i18n.t('store.leaderOnly') };
    if (participants.length === 0) return { ok: false, msg: i18n.t('store.participantRequired') };
    const total = leaderShare + participants.reduce((s, p) => s + p.share, 0);
    if (total !== 100) return { ok: false, msg: i18n.t('store.shareSumError') };
    set({ processStep: 1, policyStateIdx: 0, acc: makeInitialAcc(participants.length) });
    const shareDetail = `L${leaderShare}/${participants.map((p, i) => `P${i + 1}:${p.share}`).join('/')}`;
    get().addLog(
      i18n.t('store.termsSet'), '#9945FF', 'set_terms',
      `${i18n.t('store.termsDetailPrefix')}|${shareDetail}`,
    );
    return { ok: true };
  },

  confirmParticipant: (id) => {
    set(st => {
      const participants = st.participants.map(p => p.id === id ? { ...p, confirmed: true } : p);
      const allPart = participants.every(p => p.confirmed);
      const somePart = participants.some(p => p.confirmed);
      const reinOk = !st.reinsurer.enabled || st.reinsurer.confirmed;
      let step = st.processStep;
      if (somePart && step < 2) step = 2;
      if (allPart && step < 3) step = 3;
      if (allPart && reinOk && step < 4) step = 4;
      return { participants, processStep: step };
    });
    const st = get();
    const p = st.participants.find(p => p.id === id);
    const idx = st.participants.findIndex(p => p.id === id);
    const label = p?.name || `참여사 ${idx + 1}`;
    get().addLog(i18n.t('store.confirmDone', { role: label }), PARTICIPANT_COLORS[idx] || '#14F195', 'confirm_party');
  },

  confirmReinsurer: () => {
    set(st => {
      const reinsurer = { ...st.reinsurer, confirmed: true };
      const allPart = st.participants.every(p => p.confirmed);
      let step = st.processStep;
      if (allPart && step < 3) step = 3;
      if (allPart && reinsurer.confirmed && step < 4) step = 4;
      return { reinsurer, processStep: step };
    });
    get().addLog(i18n.t('store.confirmDone', { role: getRoleLabel('rein') }), REINSURER_COLOR, 'confirm_party');
  },

  activateMaster: () => {
    const { role, participants, reinsurer } = get();
    if (role !== 'leader' && role !== 'operator') return { ok: false, msg: i18n.t('store.leaderOnly') };
    const allPart = participants.every(p => p.confirmed);
    const reinOk = !reinsurer.enabled || reinsurer.confirmed;
    if (!allPart || !reinOk) return { ok: false, msg: i18n.t('store.allConfirmNeeded') };
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
    const pp = st.premiumPerPolicy;
    const lS = st.leaderShare / 100;
    const ceded = st.cededRatioBps / 10000;
    const comm = st.reinsCommissionBps / 10000;
    const reinsEff = st.reinsurer.enabled ? ceded * (1 - comm) : 0;
    const lNet = lS * (1 - reinsEff) * pp;
    const participantNets = st.participants.map(p => (p.share / 100) * (1 - reinsEff) * pp);
    const rNet = reinsEff * pp;

    const ct: Contract = { id: newCnt, name, flight, date, lNet, participantNets, rNet, status: 'active', ts: nowDate() };
    set(prev => ({
      contractCount: newCnt,
      contracts: [...prev.contracts, ct],
      totalPremium: prev.totalPremium + pp,
      acc: {
        ...prev.acc,
        leaderPrem: prev.acc.leaderPrem + lNet,
        participantPrems: prev.acc.participantPrems.map((v, i) => v + (participantNets[i] ?? 0)),
        reinPrem: prev.acc.reinPrem + rNet,
      },
      premHist: [...prev.premHist, { t: nowTime(), v: prev.totalPremium + pp }],
    }));
    const netDetail = participantNets.map((n, i) => `P${i + 1}:${formatNum(n, 4)}`).join('/');
    get().addLog(
      i18n.t('store.newContract', { id: newCnt, name, flight, date }), ROLES.leader.color, 'new_contract',
      `L:${formatNum(lNet, 4)}/${netDetail}/R:${formatNum(rNet, 4)}`,
    );
  },

  clearContracts: () => {
    const n = get().participants.length;
    set({
      contracts: [],
      contractCount: 0,
      acc: makeInitialAcc(n),
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

    const tier = cancelled ? TIERS[3] : getTier(delay);
    if (!tier) {
      get().addLog(i18n.t('store.oracleNoTrigger', { delay }), '#22C55E', 'check_oracle');
      return { ok: true, msg: i18n.t('store.oracleNoTriggerMsg', { delay }), type: 'ok' as const };
    }

    const contract = st.contracts.find(c => c.id === contractId);
    if (!contract) return { ok: false, msg: i18n.t('store.contractNotFound', { id: contractId }), type: 'error' as const, code: 'E_CONTRACT_NOT_FOUND' };
    if (contract.status !== 'active') return { ok: false, msg: i18n.t('store.alreadyClaimed', { id: contractId }), type: 'error' as const, code: 'E_ALREADY_CLAIMED' };
    const ceded = st.cededRatioBps / 10000;
    const commRate = st.reinsCommissionBps / 10000;
    const reinsEff = st.reinsurer.enabled ? ceded * (1 - commRate) : 0;
    const newClCnt = st.claimCount + 1;
    const payout = st.payoutTiers[tier.key];
    const lS = st.leaderShare / 100;
    const insurerEff = 1 - reinsEff;
    const totRC = payout * reinsEff;
    const lNet = payout * insurerEff * lS;
    const participantNets = st.participants.map(p => payout * insurerEff * (p.share / 100));
    const rNet = totRC;

    const cl: Claim = {
      id: newClCnt, contractId, name: contract?.name || i18n.t('store.defaultName'), flight: contract?.flight || '—',
      delay, tier: tier.label, payout, lNet, participantNets, totRC, rNet,
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
        participantClaims: prev.acc.participantClaims.map((v, i) => v + (participantNets[i] ?? 0)),
        reinClaim: prev.acc.reinClaim + rNet,
      },
      contracts: prev.contracts.map(c => c.id === contractId ? { ...c, status: 'claimed' as const } : c),
      poolHist: [...prev.poolHist, { t: nowTime(), v: Math.max(0, prev.poolBalance - payout) }],
    }));

    const netDetail = participantNets.map((n, i) => `P${i + 1}:${formatNum(n, 2)}`).join('/');
    get().addLog(
      i18n.t('store.claimLog', { id: newClCnt, tier: tier.label, payout }), tier.color, 'create_claim',
      `L:${formatNum(lNet, 2)}/${netDetail}/RC:${formatNum(totRC, 2)}`,
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

  applyMasterAgreementDisplayNames: (payload) => {
    const displayNamesByWallet = Object.fromEntries([
      ...payload.participants.map(({ wallet, displayName }) => [wallet, displayName]),
      ...(payload.reinsurer ? [[payload.reinsurer.wallet, payload.reinsurer.displayName] as const] : []),
    ]);

    set(st => ({
      displayNamesByWallet,
      participants: st.participants.map((participant, index) => ({
        ...participant,
        name: displayNamesByWallet[participant.address] || participant.name || participantFallbackName(index),
      })),
      reinsurer: {
        ...st.reinsurer,
        name: st.reinsurer.address ? displayNamesByWallet[st.reinsurer.address] || st.reinsurer.name : st.reinsurer.name,
      },
    }));
  },

  setMasterAgreementPDA: (pda) => set({ masterAgreementPDA: pda }),

  setMasterAgreements: (list) => set({ masterAgreements: list }),

  selectMasterAgreement: (pda) => {
    const resetMirror = {
      masterActive: false,
      processStep: 0,
      policyStateIdx: -1,
      leaderShare: 50,
      participants: [{ ...DEFAULT_PARTICIPANT }] as Participant[],
      reinsurer: { enabled: true, address: '', confirmed: false } as ReinsurerConfig,
      contracts: [] as Contract[],
      claims: [] as Claim[],
      contractCount: 0,
      claimCount: 0,
    };
    if (pda === null) {
      set({ masterAgreementPDA: null, displayNamesByWallet: {}, ...resetMirror });
      get().addLog('새 마스터계약 생성 모드', '#94A3B8', 'select_master');
    } else {
      set({ masterAgreementPDA: pda, displayNamesByWallet: {}, ...resetMirror });
      get().addLog(`마스터계약 전환: ${pda.slice(0, 8)}...`, '#9945FF', 'select_master', '체인에서 상태 조회 중...');
    }
  },

  /* ── On-chain action callbacks (called by components after successful tx) ── */

  onChainSetTerms: (txSignature, opts) => {
    const { leaderShare, participants } = get();
    set({
      processStep: 1,
      policyStateIdx: 0,
      ...(opts?.cededRatioBps != null && { cededRatioBps: opts.cededRatioBps }),
      ...(opts?.reinsCommissionBps != null && { reinsCommissionBps: opts.reinsCommissionBps }),
      ...(opts?.premium != null && { premiumPerPolicy: opts.premium }),
      ...(opts?.payoutTiers != null && { payoutTiers: opts.payoutTiers }),
      ...(opts?.coverageDates != null && { coverageStart: opts.coverageDates.start, coverageEnd: opts.coverageDates.end }),
      ...(opts?.leaderShare != null && { leaderShare: opts.leaderShare }),
      ...(opts?.participants != null && { participants: opts.participants }),
      ...(opts?.reinsurer != null && { reinsurer: opts.reinsurer }),
      acc: makeInitialAcc((opts?.participants ?? participants).length),
    });
    const ls = opts?.leaderShare ?? leaderShare;
    const ps = opts?.participants ?? participants;
    const shareDetail = `L${ls}/${ps.map((p, i) => `P${i + 1}:${p.share}`).join('/')}`;
    get().addLog(
      i18n.t('store.termsSet'), '#9945FF', 'create_master_agreement',
      shareDetail,
      txSignature,
    );
  },

  onChainConfirm: (target, txSignature) => {
    if (target === 'rein') {
      set(st => {
        const reinsurer = { ...st.reinsurer, confirmed: true };
        const allPart = st.participants.every(p => p.confirmed);
        let step = st.processStep;
        if (allPart && step < 3) step = 3;
        if (allPart && reinsurer.confirmed && step < 4) step = 4;
        return { reinsurer, processStep: step };
      });
      get().addLog(
        i18n.t('store.confirmDone', { role: getRoleLabel('rein') }), REINSURER_COLOR, 'confirm_master',
        '', txSignature,
      );
    } else {
      set(st => {
        const participants = st.participants.map(p => p.id === target ? { ...p, confirmed: true } : p);
        const allPart = participants.every(p => p.confirmed);
        const somePart = participants.some(p => p.confirmed);
        const reinOk = !st.reinsurer.enabled || st.reinsurer.confirmed;
        let step = st.processStep;
        if (somePart && step < 2) step = 2;
        if (allPart && step < 3) step = 3;
        if (allPart && reinOk && step < 4) step = 4;
        return { participants, processStep: step };
      });
      const st = get();
      const p = st.participants.find(p => p.id === target);
      const idx = st.participants.findIndex(p => p.id === target);
      const label = p?.name || participantFallbackName(Math.max(idx, 0));
      get().addLog(
        i18n.t('store.confirmDone', { role: label }),
        PARTICIPANT_COLORS[idx] || '#14F195', 'confirm_master',
        '', txSignature,
      );
    }
  },

  onChainActivate: (txSignature, pda) => {
    set({ masterActive: true, policyStateIdx: 3, processStep: 5, masterAgreementPDA: pda });
    get().addLog(
      i18n.t('store.masterActivated'), '#14F195', 'activate_master',
      `PDA: ${pda.substring(0, 16)}...`, txSignature,
    );
  },

  onChainAddContract: (id, name, flight, date, txSignature) => {
    const st = get();
    const pp = st.premiumPerPolicy;
    const lS = st.leaderShare / 100;
    const ceded = st.cededRatioBps / 10000;
    const comm = st.reinsCommissionBps / 10000;
    const reinsEff = st.reinsurer.enabled ? ceded * (1 - comm) : 0;
    const lNet = lS * (1 - reinsEff) * pp;
    const participantNets = st.participants.map(p => (p.share / 100) * (1 - reinsEff) * pp);
    const rNet = reinsEff * pp;

    const ct: Contract = { id, name, flight, date, lNet, participantNets, rNet, status: 'active', ts: nowDate() };
    set(prev => ({
      contractCount: id,
      contracts: [...prev.contracts, ct],
      totalPremium: prev.totalPremium + pp,
      acc: {
        ...prev.acc,
        leaderPrem: prev.acc.leaderPrem + lNet,
        participantPrems: prev.acc.participantPrems.map((v, i) => v + (participantNets[i] ?? 0)),
        reinPrem: prev.acc.reinPrem + rNet,
      },
      premHist: [...prev.premHist, { t: nowTime(), v: prev.totalPremium + pp }],
    }));
    const netDetail = participantNets.map((n, i) => `P${i + 1}:${formatNum(n, 4)}`).join('/');
    get().addLog(
      i18n.t('store.newContract', { id, name, flight, date }), ROLES.leader.color, 'create_flight_policy',
      `L:${formatNum(lNet, 4)}/${netDetail}/R:${formatNum(rNet, 4)}`,
      txSignature,
    );
  },

  onChainResolve: (contractId, delay, cancelled, txSignature) => {
    const st = get();
    const contract = st.contracts.find(c => c.id === contractId);
    if (!contract) return;

    const tier = cancelled ? TIERS[3] : getTier(delay);
    if (!tier) {
      set(prev => ({
        contracts: prev.contracts.map(c => c.id === contractId ? { ...c, status: 'noClaim' as const } : c),
      }));
      get().addLog(
        i18n.t('store.noTrigger', { id: contractId }), '#22c55e', 'resolve_flight_delay',
        `delay=${delay}min (< 120min threshold)`, txSignature,
      );
      return;
    }

    const ceded = st.cededRatioBps / 10000;
    const commRate = st.reinsCommissionBps / 10000;
    const reinsEff = st.reinsurer.enabled ? ceded * (1 - commRate) : 0;
    const newClCnt = st.claimCount + 1;
    const payout = st.payoutTiers[tier.key];
    const lS = st.leaderShare / 100;
    const insurerEff = 1 - reinsEff;
    const totRC = payout * reinsEff;
    const lNet = payout * insurerEff * lS;
    const participantNets = st.participants.map(p => payout * insurerEff * (p.share / 100));
    const rNet = totRC;

    const cl: Claim = {
      id: newClCnt, contractId, name: contract.name, flight: contract.flight,
      delay, tier: tier.label, payout, lNet, participantNets, totRC, rNet,
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
        participantClaims: prev.acc.participantClaims.map((v, i) => v + (participantNets[i] ?? 0)),
        reinClaim: prev.acc.reinClaim + rNet,
      },
      contracts: prev.contracts.map(c => c.id === contractId ? { ...c, status: 'claimed' as const } : c),
      poolHist: [...prev.poolHist, { t: nowTime(), v: Math.max(0, prev.poolBalance - payout) }],
    }));

    const netDetail = participantNets.map((n, i) => `P${i + 1}:${formatNum(n, 2)}`).join('/');
    get().addLog(
      i18n.t('store.claimLog', { id: newClCnt, tier: tier.label, payout }), tier.color, 'resolve_flight_delay',
      `L:${formatNum(lNet, 2)}/${netDetail}/RC:${formatNum(totRC, 2)}`,
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
      contracts: prev.contracts.map(c =>
        c.id === contractId ? { ...c, status: 'settled' as const } : c,
      ),
      policyStateIdx: 6,
    }));
    get().addLog(
      i18n.t('store.settledOnchain', { id: contractId }), '#14F195', 'settle_flight_claim',
      '', txSignature,
    );
  },

  refreshPool: () => set(st => ({ poolRefreshKey: st.poolRefreshKey + 1 })),
  setPoolBalance: (balance) => set({ poolBalance: balance }),

  captureKpiSnapshot: () =>
    set(st => ({
      kpiSnapshot: st.kpiSnapshot ?? {
        poolBalance: st.poolBalance,
        claimCount: st.claimCount,
        flightPolicyCount: 0,
      },
    })),

  resetAll: () => {
    participantIdCounter = 1;
    set({
      masterActive: false, policyStateIdx: -1, processStep: 0,
      leaderShare: 50,
      participants: [{ ...DEFAULT_PARTICIPANT }],
      reinsurer: { enabled: true, address: '', confirmed: false },
      coverageStart: '2026-01-01', coverageEnd: '2026-12-31',
      premiumPerPolicy: 3, payoutTiers: { delay2h: 5, delay3h: 8, delay4to5h: 12, delay6hOrCancelled: 15 },
      cededRatioBps: 5000, reinsCommissionBps: 1000,
      poolBalance: 10000, totalPremium: 0, totalClaim: 0,
      contracts: [], claims: [], contractCount: 0, claimCount: 0,
      acc: makeInitialAcc(1),
      premHist: [], poolHist: [{ t: 'init', v: 10000 }],
      logs: [], logIdCounter: 0,
      masterAgreementPDA: null, lastTxSignature: null,
      kpiSnapshot: null,
      displayNamesByWallet: {},
    });
    get().addLog(i18n.t('store.resetMsg'), '#9945FF', 'system_init');
  },

  syncMasterFromChain: (data: MasterAgreementAccount) => {
    const isActive = data.status === MasterAgreementStatus.Active;

    // Map on-chain participants (leader is separate; participants[] contains only non-leaders).
    // Preserve existing store participant id/name by matching on address — this
    // prevents user-edited names from being overwritten on every poll and keeps
    // ids stable so addParticipant-generated ids never collide.
    const prevParticipants = get().participants;
    const displayNamesByWallet = get().displayNamesByWallet;
    const participants: Participant[] = data.participants.map((p, i) => {
      const address = p?.insurer?.toBase58() ?? '';
      const existing = address ? prevParticipants.find(x => x.address === address) : undefined;
      const fallbackExisting = prevParticipants[i];
      const backendDisplayName = address ? displayNamesByWallet[address] : undefined;
      return {
        id: existing?.id ?? fallbackExisting?.id ?? `p${i + 1}`,
        name: backendDisplayName || existing?.name || fallbackExisting?.name || participantFallbackName(i),
        share: Math.round((p?.shareBps ?? 0) / 100),
        address,
        confirmed: p?.confirmed ?? false,
      };
    });
    // Keep id counter ahead of any existing ids to avoid collisions on subsequent addParticipant calls.
    for (const p of participants) {
      const n = parseInt(p.id.replace(/^p/, ''), 10);
      if (Number.isFinite(n) && n > participantIdCounter) participantIdCounter = n;
    }

    const leaderShare = Math.round((data.leaderShareBps ?? 5000) / 100);

    const reinConfirmed = data.reinsurerConfirmed;
    const hasReinsurer = data.cededRatioBps > 0;
    const prevReinsurer = get().reinsurer;
    const reinsurerAddress = hasReinsurer ? (data.reinsurer?.toBase58() ?? '') : '';
    const reinsurer: ReinsurerConfig = {
      enabled: hasReinsurer,
      name: reinsurerAddress ? displayNamesByWallet[reinsurerAddress] || prevReinsurer.name : undefined,
      address: reinsurerAddress,
      confirmed: hasReinsurer && reinConfirmed,
    };

    const allPart = participants.every(p => p.confirmed);
    const somePart = participants.some(p => p.confirmed);
    const reinOk = !hasReinsurer || reinConfirmed;

    let processStep = 1;
    if (somePart) processStep = 2;
    if (allPart) processStep = 3;
    if (allPart && reinOk) processStep = 4;
    if (isActive) processStep = 5;

    const toDateStr = (ts: import('@coral-xyz/anchor').BN) => {
      const d = new Date(ts.toNumber() * 1000);
      return d.toISOString().slice(0, 10);
    };

    set({
      masterActive: isActive,
      leaderShare,
      participants,
      reinsurer,
      processStep,
      cededRatioBps: data.cededRatioBps,
      reinsCommissionBps: data.reinsCommissionBps,
      ...(data.premiumPerPolicy && { premiumPerPolicy: data.premiumPerPolicy.toNumber() / 1_000_000 }),
      ...(data.payoutDelay2H && {
        payoutTiers: {
          delay2h: data.payoutDelay2H.toNumber() / 1_000_000,
          delay3h: data.payoutDelay3H.toNumber() / 1_000_000,
          delay4to5h: data.payoutDelay4To5H.toNumber() / 1_000_000,
          delay6hOrCancelled: data.payoutDelay6HOrCancelled.toNumber() / 1_000_000,
        },
      }),
      ...(data.coverageStartTs && { coverageStart: toDateStr(data.coverageStartTs) }),
      ...(data.coverageEndTs && { coverageEnd: toDateStr(data.coverageEndTs) }),
      policyStateIdx: isActive ? 3 : processStep > 0 ? 0 : -1,
    });
  },

  syncFlightPoliciesFromChain: (policies: FlightPolicyWithKey[]) => {
    const st = get();
    const lS = st.leaderShare / 100;
    const participantShares = st.participants.map(p => p.share / 100);
    const ceded = st.cededRatioBps / 10000;
    const comm = st.reinsCommissionBps / 10000;

    const pp = st.premiumPerPolicy;
    const reinsEff = st.reinsurer.enabled ? ceded * (1 - comm) : 0;
    const ctLNet = lS * (1 - reinsEff) * pp;
    const ctParticipantNets = participantShares.map(s => s * (1 - reinsEff) * pp);
    const ctRNet = reinsEff * pp;

    const formatTs = (unixSec: number) =>
      new Date(unixSec * 1000).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });

    const contracts: Contract[] = [];
    const claims: Claim[] = [];
    let claimIdCounter = 0;

    for (const fp of policies) {
      const a = fp.account;
      const id = a.childPolicyId.toNumber();
      const isStillActive =
        a.status === FlightPolicyStatus.Issued ||
        a.status === FlightPolicyStatus.AwaitingOracle;
      const date = new Date(a.departureTs.toNumber() * 1000).toISOString().slice(0, 10);

      let contractStatus: Contract['status'];
      if (isStillActive) {
        contractStatus = 'active';
      } else if (a.status === FlightPolicyStatus.NoClaim) {
        contractStatus = 'noClaim';
      } else if (a.status === FlightPolicyStatus.Expired) {
        contractStatus = 'expired';
      } else if (a.status === FlightPolicyStatus.Paid) {
        contractStatus = 'paid';
      } else {
        contractStatus = 'claimed';
      }

      const ct: Contract = {
        id,
        name: a.subscriberRef,
        flight: a.flightNo,
        date,
        lNet: ctLNet,
        participantNets: ctParticipantNets,
        rNet: ctRNet,
        status: contractStatus,
        ts: formatTs(a.createdAt.toNumber()),
      };
      contracts.push(ct);

      if (
        a.status === FlightPolicyStatus.Claimable ||
        a.status === FlightPolicyStatus.Paid
      ) {
        claimIdCounter++;
        const delay = a.delayMinutes;
        const tier = a.cancelled ? TIERS[3] : getTier(delay);
        if (tier) {
          const payout = a.payoutAmount.toNumber() / 1_000_000;
          const insurerEff = 1 - reinsEff;
          const totRC = payout * reinsEff;
          const clLNet = payout * insurerEff * lS;
          const clParticipantNets = participantShares.map(s => payout * insurerEff * s);
          const clRNet = totRC;

          const cl: Claim = {
            id: claimIdCounter,
            contractId: id,
            name: a.subscriberRef,
            flight: a.flightNo,
            delay,
            tier: tier.label,
            payout,
            lNet: clLNet,
            participantNets: clParticipantNets,
            totRC,
            rNet: clRNet,
            status: a.status === FlightPolicyStatus.Paid ? 'settled' : 'claimable',
            ts: formatTs(a.updatedAt.toNumber()),
            color: tier.color,
          };
          claims.push(cl);
        }
      }
    }

    // Recalculate acc from all contracts + claims
    const acc = makeInitialAcc(st.participants.length);
    for (const ct of contracts) {
      acc.leaderPrem += ct.lNet;
      ct.participantNets.forEach((n, i) => { acc.participantPrems[i] = (acc.participantPrems[i] || 0) + n; });
      acc.reinPrem += ct.rNet;
    }
    for (const cl of claims) {
      acc.leaderClaim += cl.lNet;
      cl.participantNets.forEach((n, i) => { acc.participantClaims[i] = (acc.participantClaims[i] || 0) + n; });
      acc.reinClaim += cl.rNet;
    }

    const totalPremium = contracts.length * pp;
    const totalClaim = claims.reduce((s, c) => s + c.payout, 0);

    const resolvedPolicies = policies.filter(fp =>
      fp.account.status !== FlightPolicyStatus.Issued &&
      fp.account.status !== FlightPolicyStatus.AwaitingOracle
    );
    const lastDaemonActivityTs = resolvedPolicies.length > 0
      ? Math.max(...resolvedPolicies.map(fp => fp.account.updatedAt.toNumber()))
      : null;

    set({
      contracts,
      claims,
      contractCount: contracts.length,
      claimCount: claimIdCounter,
      acc,
      totalPremium,
      totalClaim,
      lastDaemonActivityTs,
    });
  },

}), {
  name: 'riskmesh-protocol',
  partialize: (state) => {
    const always = {
      mode: state.mode,
      role: state.role,
      masterAgreementPDA: state.masterAgreementPDA,
      leaderShare: state.leaderShare,
      cededRatioBps: state.cededRatioBps,
      reinsCommissionBps: state.reinsCommissionBps,
    };
    if (state.mode !== 'onchain') {
      return {
        ...always,
        // In simulation mode, participants/reinsurer are user-managed — persist them.
        // In on-chain mode they are authoritative from chain (syncMasterFromChain),
        // so we skip them to prevent stale confirmed state leaking across agreements.
        participants: state.participants,
        reinsurer: state.reinsurer,
        masterActive: state.masterActive,
        processStep: state.processStep,
        policyStateIdx: state.policyStateIdx,
        contracts: state.contracts,
        claims: state.claims,
        contractCount: state.contractCount,
        claimCount: state.claimCount,
        acc: state.acc,
        totalPremium: state.totalPremium,
        totalClaim: state.totalClaim,
        poolBalance: state.poolBalance,
        premHist: state.premHist,
        poolHist: state.poolHist,
      };
    }
    return always;
  },
  onRehydrateStorage: () => (state) => {
    // Restore participantIdCounter from persisted participants so that subsequent
    // addParticipant calls never produce ids that collide with rehydrated ones.
    if (state?.participants) {
      let max = 0;
      for (const p of state.participants) {
        const n = parseInt(p.id.replace(/^p/, ''), 10);
        if (Number.isFinite(n) && n > max) max = n;
      }
      if (max > participantIdCounter) participantIdCounter = max;
    }
  },
}));
