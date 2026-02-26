import { create } from 'zustand';

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

const nowTime = () =>
  new Date().toLocaleTimeString('ko-KR', { hour12: false });

const nowDate = () =>
  new Date().toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

/* ── Store ── */
interface ProtocolState {
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

  // Actions
  setRole: (r: Role) => void;
  setShares: (s: Partial<Shares>) => void;
  setTerms: () => { ok: boolean; msg?: string };
  confirmParty: (key: 'partA' | 'partB' | 'rein') => void;
  activateMaster: () => { ok: boolean; msg?: string };
  addContract: (name?: string, flight?: string, date?: string) => void;
  clearContracts: () => void;
  runOracle: (contractId: number, delay: number, fresh: number) => { ok: boolean; msg: string; type: 'error' | 'ok' | 'info'; code?: string };
  approveClaims: () => number;
  settleClaims: () => number;
  addLog: (msg: string, color: string, instruction: string, detail?: string) => void;
  resetAll: () => void;
}

const INITIAL_ACC: Acc = { leaderPrem: 0, partAPrem: 0, partBPrem: 0, reinPrem: 0, leaderClaim: 0, partAClaim: 0, partBClaim: 0, reinClaim: 0 };

export const useProtocolStore = create<ProtocolState>((set, get) => ({
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

  setRole: (r) => {
    set({ role: r });
    get().addLog('역할 전환 → ' + ROLES[r].label, ROLES[r].color, 'role_switch');
  },

  setShares: (s) => set(st => ({ shares: { ...st.shares, ...s } })),

  setTerms: () => {
    const { role, shares } = get();
    if (role !== 'leader' && role !== 'operator') return { ok: false, msg: '리더사만 가능합니다' };
    if (shares.leader + shares.partA + shares.partB !== 100) return { ok: false, msg: '지분 합계가 100이어야 합니다' };
    set({ processStep: 1, policyStateIdx: 0 });
    get().addLog(
      '약관 세팅 완료. 참여사·재보험사 컨펌 요청', '#9945FF', 'set_terms',
      `담보:2026-01-01~12-31|보험료:1USDC|지분 L${shares.leader}/A${shares.partA}/B${shares.partB}`,
    );
    return { ok: true };
  },

  confirmParty: (key) => {
    const step = key === 'partA' ? 2 : key === 'partB' ? 3 : 4;
    set(st => ({
      confirms: { ...st.confirms, [key]: true },
      processStep: Math.max(st.processStep, step),
    }));
    get().addLog(ROLES[key].label + ' 컨펌 완료', ROLES[key].color, 'confirm_party');
  },

  activateMaster: () => {
    const { role, confirms } = get();
    if (role !== 'leader' && role !== 'operator') return { ok: false, msg: '리더사만 가능합니다' };
    if (!confirms.partA || !confirms.partB || !confirms.rein) return { ok: false, msg: '모든 참여사·재보험사 컨펌이 필요합니다' };
    set({ masterActive: true, policyStateIdx: 3, processStep: 5 });
    get().addLog(
      '마스터 계약 온체인 기록 완료. 실시간 계약 수락 시작', '#14F195', 'activate_master',
      `PDA:${masterPDA().substring(0, 16)}...|Pool:10,000USDC`,
    );
    return { ok: true };
  },

  addContract: (autoName, autoFlight, autoDate) => {
    const st = get();
    if (!st.masterActive) return;
    const newCnt = st.contractCount + 1;
    const name = autoName || '계약자';
    const flight = autoFlight || 'KE081';
    const date = autoDate || '2026-01-15';
    const lS = st.shares.leader / 100;
    const aS = st.shares.partA / 100;
    const bS = st.shares.partB / 100;
    const lRaw = lS, aRaw = aS, bRaw = bS;
    const lToR = lRaw * 0.5, aToR = aRaw * 0.5, bToR = bRaw * 0.5;
    const comm = 0.10;
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
      `계약 #${newCnt}: ${name}|${flight}|${date}`, ROLES.leader.color, 'new_contract',
      `보험료 1USDC → L:${formatNum(lNet, 4)} A:${formatNum(aNet, 4)} B:${formatNum(bNet, 4)} R:${formatNum(rNet, 4)}`,
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

  runOracle: (contractId, delay, fresh) => {
    const st = get();
    if (fresh < 0 || fresh > 30) return { ok: false, msg: `데이터가 ${fresh}분 전. 0~30분 이내만 유효.`, type: 'error' as const, code: 'E_ORACLE_STALE' };
    if (delay < 0 || delay % 10 !== 0) return { ok: false, msg: `delay_min은 0이상 10의 배수여야 함. 입력:${delay}`, type: 'error' as const, code: 'E_ORACLE_FORMAT' };

    const tier = getTier(delay);
    if (!tier) {
      get().addLog(`오라클: 지연 ${delay}분 — 트리거 미해당`, '#22C55E', 'check_oracle');
      return { ok: true, msg: `지연 ${delay}분 — 트리거 미해당 (120분 미만). 계약 유지.`, type: 'ok' as const };
    }

    const contract = st.contracts.find(c => c.id === contractId);
    if (!contract) return { ok: false, msg: `계약 #${contractId}을 찾을 수 없습니다`, type: 'error' as const, code: 'E_CONTRACT_NOT_FOUND' };
    if (contract.status === 'claimed') return { ok: false, msg: `계약 #${contractId}은 이미 클레임 처리됨`, type: 'error' as const, code: 'E_ALREADY_CLAIMED' };
    const newClCnt = st.claimCount + 1;
    const payout = tier.p;
    const lS = st.shares.leader / 100, aS = st.shares.partA / 100, bS = st.shares.partB / 100;
    const lPay = payout * lS, aPay = payout * aS, bPay = payout * bS;
    const lRC = lPay * 0.5, aRC = aPay * 0.5, bRC = bPay * 0.5, totRC = lRC + aRC + bRC;
    const clComm = payout * 0.10;
    const lNet = lPay - lRC + clComm * lS;
    const aNet = aPay - aRC + clComm * aS;
    const bNet = bPay - bRC + clComm * bS;
    const rNet = totRC - clComm;

    const cl: Claim = {
      id: newClCnt, contractId, name: contract?.name || '계약자', flight: contract?.flight || '—',
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
      `클레임 #${newClCnt} — ${tier.label} → ${payout} USDC`, tier.color, 'create_claim',
      `L:${formatNum(lNet, 2)} A:${formatNum(aNet, 2)} B:${formatNum(bNet, 2)} 재보:${formatNum(totRC, 2)}`,
    );

    return { ok: true, msg: `트리거! 지연 ${delay}분 (${tier.label}) → 보험금 ${payout} USDC 클레임 생성`, type: 'ok' as const };
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
    get().addLog(`클레임 ${pend.length}건 승인 by ${ROLES[st.role].label}`, '#22C55E', 'approve_claim');
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
      `클레임 ${appr.length}건 정산 완료. Pool→계약자 이체`, '#14F195', 'settle_claim',
      `총 지급:${formatNum(st.totalClaim, 2)}USDC|Pool 잔액:${formatNum(st.poolBalance, 2)}USDC`,
    );
    return appr.length;
  },

  addLog: (msg, color, instruction, detail = '') => {
    set(prev => ({
      logIdCounter: prev.logIdCounter + 1,
      logs: [{ id: prev.logIdCounter + 1, msg, color, instruction, detail, time: nowTime() }, ...prev.logs].slice(0, 80),
    }));
  },

  resetAll: () => {
    set({
      masterActive: false, policyStateIdx: -1, processStep: 0,
      confirms: { partA: false, partB: false, rein: false },
      shares: { leader: 50, partA: 30, partB: 20 },
      poolBalance: 10000, totalPremium: 0, totalClaim: 0,
      contracts: [], claims: [], contractCount: 0, claimCount: 0,
      acc: { ...INITIAL_ACC },
      premHist: [], poolHist: [{ t: 'init', v: 10000 }],
      logs: [], logIdCounter: 0,
    });
    get().addLog('프로토콜 초기화. 마스터 계약 체결부터 시작하세요.', '#9945FF', 'system_init');
  },
}));
