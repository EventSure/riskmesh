/**
 * Guide tour step definitions (simulation 모드 전용).
 *
 * - GUIDE_ANCHORS: 컴포넌트와 가이드가 공유하는 단일 source-of-truth.
 *   컴포넌트는 `data-guide={GUIDE_ANCHORS.XXX}`로 등록하고, 가이드는 같은 상수를 참조한다.
 *   anchor를 변경할 일이 생기면 enum만 고치면 grep 한 번으로 모든 사용처가 잡힌다.
 *
 * - GuideStep:
 *   - prepare(ctx)  → step 진입 시 호출, 탭/모드 등 환경 정렬
 *   - isComplete(s) → store/탭 변화로 자동 다음 step 진행
 *   - optional      → 조건이 안 맞으면 자동 skip (예: reinsurer 미사용)
 *   - manualNext    → 사용자가 [Next] 버튼 직접 눌러야 진행 (auto-advance가 모호한 경우)
 */

import type { TabId } from '@/components/layout/TabBar';

export const GUIDE_ANCHORS = {
  // tab-contract
  SET_TERMS: 'set-terms-btn',
  CONFIRM_P1: 'confirm-p1',
  CONFIRM_REIN: 'confirm-rein',
  ACTIVATE: 'activate-btn',
  // tab-feed
  CREATE_CONTRACT: 'create-contract-btn',
  // tab-oracle
  SELECT_CONTRACT: 'select-contract',
  RESOLVE: 'resolve-btn',
  SETTLE: 'settle-btn',
  // sidebar tabs (DashboardSidebar는 data-guide={tab.id}로 등록되어 id가 곧 anchor)
  TAB_FEED: 'tab-feed',
  TAB_ORACLE: 'tab-oracle',
  TAB_SETTLEMENT: 'tab-settlement',
} as const;

export type GuideAnchor = typeof GUIDE_ANCHORS[keyof typeof GUIDE_ANCHORS];

export type GuidePhase = 'setup' | 'issue' | 'resolve' | 'settle';

export interface GuideContext {
  setActiveTab: (tab: TabId) => void;
}

export interface GuideStateSnapshot {
  processStep: number;
  masterActive: boolean;
  reinsurerEnabled: boolean;
  reinsurerConfirmed: boolean;
  firstParticipantConfirmed: boolean;
  contractsCount: number;
  claimsCount: number;
  anySettled: boolean;
  activeTab: TabId;
}

export interface GuideStep {
  step: number;                                                   // 1-based
  phase: GuidePhase;
  anchor: GuideAnchor;
  titleKey: string;
  descKey: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  prepare?: (ctx: GuideContext) => void;
  precondition?: (s: GuideStateSnapshot) => boolean;
  isComplete: (s: GuideStateSnapshot, baseline: GuideStateSnapshot) => boolean;
  optional?: boolean;
  manualNext?: boolean;
}

export const GUIDE_STEPS: GuideStep[] = [
  // ── Phase 1: Setup ─────────────────────────────────────────
  {
    step: 1,
    phase: 'setup',
    anchor: GUIDE_ANCHORS.SET_TERMS,
    titleKey: 'guide.step1.title',
    descKey: 'guide.step1.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-contract'),
    isComplete: s => s.processStep >= 1,
  },
  {
    step: 2,
    phase: 'setup',
    anchor: GUIDE_ANCHORS.CONFIRM_P1,
    titleKey: 'guide.step2.title',
    descKey: 'guide.step2.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-contract'),
    isComplete: s => s.firstParticipantConfirmed,
  },
  {
    step: 3,
    phase: 'setup',
    anchor: GUIDE_ANCHORS.CONFIRM_REIN,
    titleKey: 'guide.step3.title',
    descKey: 'guide.step3.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-contract'),
    precondition: s => s.reinsurerEnabled,
    isComplete: s => !s.reinsurerEnabled || s.reinsurerConfirmed,
    optional: true,
  },
  {
    step: 4,
    phase: 'setup',
    anchor: GUIDE_ANCHORS.ACTIVATE,
    titleKey: 'guide.step4.title',
    descKey: 'guide.step4.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-contract'),
    isComplete: s => s.masterActive,
  },

  // ── Phase 2: Issue ─────────────────────────────────────────
  {
    step: 5,
    phase: 'issue',
    anchor: GUIDE_ANCHORS.CREATE_CONTRACT,
    titleKey: 'guide.step5.title',
    descKey: 'guide.step5.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-feed'),
    isComplete: (s, baseline) => s.contractsCount > baseline.contractsCount,
  },

  // ── Phase 3: Resolve ───────────────────────────────────────
  {
    step: 6,
    phase: 'resolve',
    anchor: GUIDE_ANCHORS.SELECT_CONTRACT,
    titleKey: 'guide.step6.title',
    descKey: 'guide.step6.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-oracle'),
    // 사용자가 select에서 값을 변경할 때 GuideTour의 별도 DOM 리스너가 nextStep 호출
    isComplete: () => false,
    manualNext: false,
  },
  {
    step: 7,
    phase: 'resolve',
    anchor: GUIDE_ANCHORS.RESOLVE,
    titleKey: 'guide.step7.title',
    descKey: 'guide.step7.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-oracle'),
    isComplete: (s, baseline) => s.claimsCount > baseline.claimsCount,
  },

  // ── Phase 4: Settle ────────────────────────────────────────
  {
    step: 8,
    phase: 'settle',
    anchor: GUIDE_ANCHORS.SETTLE,
    titleKey: 'guide.step8.title',
    descKey: 'guide.step8.desc',
    position: 'right',
    prepare: ctx => ctx.setActiveTab('tab-oracle'),
    isComplete: s => s.anySettled,
  },
  {
    step: 9,
    phase: 'settle',
    anchor: GUIDE_ANCHORS.TAB_SETTLEMENT,
    titleKey: 'guide.step9.title',
    descKey: 'guide.step9.desc',
    position: 'right',
    isComplete: s => s.activeTab === 'tab-settlement',
  },
];

export const TOTAL_STEPS = GUIDE_STEPS.length;
