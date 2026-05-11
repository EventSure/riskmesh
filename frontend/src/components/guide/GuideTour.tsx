import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import { useGuideTour } from './useGuideTour';
import {
  GUIDE_ANCHORS,
  GUIDE_STEPS,
  TOTAL_STEPS,
  type GuideStateSnapshot,
  type GuideContext,
} from './guideSteps';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import type { TabId } from '@/components/layout/TabBar';

interface Props {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

/* ── Animations ── */

const noticeFadeIn = keyframes`
  from { opacity: 0; transform: translate(-50%, calc(-50% + 6px)); }
  to { opacity: 1; transform: translate(-50%, -50%); }
`;

const completeFadeIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

/* ── Styled ── */

/**
 * Tooltip은 항상 mount된 채로 opacity/transform 으로만 표시 전환.
 * 같은 인스턴스를 유지해야 위치(top/left) 보정이 transition으로 자연스럽게 흐른다.
 *
 * smoothPos:
 *   true → 같은 step 내 위치 보정 (scroll, post-scroll 재측정)에서 부드럽게 슬라이드
 *   false → step 전환 직후엔 transition을 꺼서 이전→새 위치 사이를 날아다니지 않게
 */
const TooltipWrap = styled.div<{ visible: boolean; smoothPos: boolean }>`
  position: fixed;
  z-index: 9999;
  min-width: 240px;
  max-width: 300px;
  background: rgba(17, 24, 39, 0.98);
  border: 1px solid rgba(153, 69, 255, 0.4);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(153,69,255,0.12);
  pointer-events: ${p => (p.visible ? 'auto' : 'none')};
  opacity: ${p => (p.visible ? 1 : 0)};
  transition: ${p => p.smoothPos
    ? 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), top 0.32s cubic-bezier(0.4, 0, 0.2, 1), left 0.32s cubic-bezier(0.4, 0, 0.2, 1)'
    : 'opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1)'};
`;

const StepBadge = styled.span`
  display: inline-block;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  color: #9945FF;
  background: rgba(153, 69, 255, 0.12);
  padding: 2px 8px;
  border-radius: 10px;
  margin-bottom: 6px;
`;

const TooltipTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #F8FAFC;
  margin-bottom: 4px;
`;

const TooltipDesc = styled.div`
  font-size: 11px;
  color: #94A3B8;
  line-height: 1.5;
  margin-bottom: 10px;
`;

const TooltipFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const SkipBtn = styled.button`
  background: none;
  border: none;
  color: #64748B;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  transition: color 0.2s;
  &:hover { color: #94A3B8; }
`;

const NextBtn = styled.button`
  background: rgba(153, 69, 255, 0.15);
  border: 1px solid rgba(153, 69, 255, 0.3);
  color: #9945FF;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: rgba(153, 69, 255, 0.25); }
`;

const Arrow = styled.div<{ position: 'top' | 'bottom' | 'left' | 'right' }>`
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;

  ${p => p.position === 'right' && `
    left: -16px;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: rgba(17, 24, 39, 0.98);
  `}
  ${p => p.position === 'bottom' && `
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    border-bottom-color: rgba(17, 24, 39, 0.98);
  `}
  ${p => p.position === 'left' && `
    right: -16px;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: rgba(17, 24, 39, 0.98);
  `}
  ${p => p.position === 'top' && `
    bottom: -16px;
    left: 50%;
    transform: translateX(-50%);
    border-top-color: rgba(17, 24, 39, 0.98);
  `}
`;

/* ── 화면 중앙에 띄우는 안내(앵커 미발견 시) ── */

const CenterNotice = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  background: rgba(17, 24, 39, 0.98);
  border: 1px solid rgba(245, 158, 11, 0.45);
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 12px;
  color: #FCD34D;
  text-align: center;
  animation: ${noticeFadeIn} 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);
`;

/* ── Completion overlay ── */

const CompleteOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CompleteCard = styled.div`
  background: #111827;
  border: 1px solid rgba(20, 241, 149, 0.4);
  border-radius: 16px;
  padding: 32px 40px;
  text-align: center;
  box-shadow: 0 0 40px rgba(20, 241, 149, 0.15);
  animation: ${completeFadeIn} 0.3s ease;
`;

const CompleteEmoji = styled.div`
  font-size: 40px;
  margin-bottom: 12px;
`;

const CompleteText = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #F8FAFC;
  margin-bottom: 16px;
  white-space: pre-line;
`;

const CompleteBtn = styled.button`
  background: rgba(20, 241, 149, 0.15);
  border: 1px solid rgba(20, 241, 149, 0.3);
  color: #14F195;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: rgba(20, 241, 149, 0.25); }
`;

/* ── Helpers ── */

function getTooltipStyle(rect: DOMRect, position: string): React.CSSProperties {
  const gap = 16;
  switch (position) {
    case 'right':
      return { top: rect.top + rect.height / 2, left: rect.right + gap, transform: 'translateY(-50%)' };
    case 'bottom':
      return { top: rect.bottom + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' };
    case 'left':
      return { top: rect.top + rect.height / 2, left: rect.left - gap, transform: 'translate(-100%, -50%)' };
    case 'top':
      return { top: rect.top - gap, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' };
    default:
      return { top: rect.bottom + gap, left: rect.left };
  }
}

const STEP_FADE_OUT_MS = 240;             // step 전환 시 의도적 hidden 시간 (탭 전환/리렌더 grace)
const ANCHOR_RETRY_INTERVAL_MS = 90;      // anchor 폴링 간격
const ANCHOR_MISSING_GRACE_MS = 2200;     // anchor 못 찾으면 안내 띄우기 전 대기
const ANCHOR_MISSING_SKIP_MS = 6000;      // 그래도 못 찾으면 다음 단계로

/* ── Component ── */

export function GuideTour({ activeTab, setActiveTab }: Props) {
  const { currentStep, showComplete, nextStep, skipTour, dismissComplete } = useGuideTour();
  const { t } = useTranslation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [missingAnchor, setMissingAnchor] = useState(false);
  // step 전환 직후엔 false → 이전 위치에서 새 위치로 날아가지 않게.
  // 첫 rect가 자리잡은 직후 true로 → 같은 step 내 후속 rect 변경(post-scroll, resize)은 부드럽게.
  const [smoothPos, setSmoothPos] = useState(false);

  const { processStep, masterActive, participants, reinsurer, contracts, claims } = useProtocolStore(
    useShallow(s => ({
      processStep: s.processStep,
      masterActive: s.masterActive,
      participants: s.participants,
      reinsurer: s.reinsurer,
      contracts: s.contracts,
      claims: s.claims,
    })),
  );

  // step 진입 시점의 baseline (contracts/claims 카운트 비교용)
  const baselineRef = useRef<GuideStateSnapshot | null>(null);

  const snapshot: GuideStateSnapshot = {
    processStep,
    masterActive,
    reinsurerEnabled: reinsurer.enabled,
    reinsurerConfirmed: reinsurer.confirmed,
    firstParticipantConfirmed: participants[0]?.confirmed ?? false,
    contractsCount: contracts.length,
    claimsCount: claims.length,
    anySettled: claims.some(c => c.status === 'settled'),
    activeTab,
  };

  const ctx: GuideContext = { setActiveTab };

  const step = currentStep !== null ? GUIDE_STEPS[currentStep] : null;

  /* ── 진입 시: 이전 tooltip 잠깐 fade-out → prepare → 일정 grace 후 anchor 폴링 시작 ── */

  useEffect(() => {
    if (!step) { setTargetRect(null); setMissingAnchor(false); setSmoothPos(false); return; }
    baselineRef.current = { ...snapshot };
    // 이전 step의 tooltip을 즉시 fade-out (opacity transition만 작동, 위치는 transition off로 이동)
    setTargetRect(null);
    setMissingAnchor(false);
    setSmoothPos(false); // 새 step 시작 → 위치 transition off (날아다님 방지)
    step.prepare?.(ctx);

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let postScrollTimer: ReturnType<typeof setTimeout> | null = null;
    let smoothEnableTimer: ReturnType<typeof setTimeout> | null = null;
    const pollForAnchor = () => {
      if (cancelled) return;
      const el = document.querySelector(`[data-guide="${step.anchor}"]`);
      if (el) {
        // block:'center'로 화면 중앙에 배치하여 사용자가 즉시 인지 가능하게.
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 스크롤 시작 직후 rect — 위치 transition이 꺼져 있어 즉시 새 자리에 표시
        requestAnimationFrame(() => {
          if (cancelled) return;
          setTargetRect(el.getBoundingClientRect());
          // 첫 rect 적용 후 transition 다시 활성화 → post-scroll 재측정 시 부드럽게 슬라이드
          smoothEnableTimer = setTimeout(() => {
            if (!cancelled) setSmoothPos(true);
          }, 60);
        });
        // smooth scroll이 완료된 시점에 한 번 더 측정 → 최종 위치로 tooltip 슬라이드
        postScrollTimer = setTimeout(() => {
          if (cancelled) return;
          setTargetRect(el.getBoundingClientRect());
        }, 480);
        return;
      }
      retryTimer = setTimeout(pollForAnchor, ANCHOR_RETRY_INTERVAL_MS);
    };
    // prepare(탭 전환) 후 DOM이 안정될 때까지 의도적 grace
    const startTimer = setTimeout(pollForAnchor, STEP_FADE_OUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (postScrollTimer) clearTimeout(postScrollTimer);
      if (smoothEnableTimer) clearTimeout(smoothEnableTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /* ── 같은 step 내 위치 보정 (scroll/resize) ── */

  const updateRect = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-guide="${step.anchor}"]`);
    if (el) {
      // 위치만 갱신, 못 찾으면 이전 rect 유지하여 깜빡임 방지
      setTargetRect(el.getBoundingClientRect());
    }
  }, [step]);

  useEffect(() => {
    if (currentStep === null) return;
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [currentStep, updateRect]);

  /* ── precondition false면 즉시 skip (optional step) ── */

  useEffect(() => {
    if (!step || !baselineRef.current) return;
    if (step.optional && step.precondition && !step.precondition(snapshot)) {
      const t = setTimeout(nextStep, 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /* ── 앵커가 끝까지 안 잡히는 경우의 안내 + 자동 skip ── */

  useEffect(() => {
    if (currentStep === null || targetRect) return;
    const noticeTimer = setTimeout(() => setMissingAnchor(true), ANCHOR_MISSING_GRACE_MS);
    const skipTimer = setTimeout(() => {
      const el = document.querySelector(`[data-guide="${GUIDE_STEPS[currentStep]!.anchor}"]`);
      if (!el) nextStep();
    }, ANCHOR_MISSING_SKIP_MS);
    return () => {
      clearTimeout(noticeTimer);
      clearTimeout(skipTimer);
    };
  }, [currentStep, targetRect, nextStep]);

  /* ── store/탭 변화로 자동 다음 진행 ── */

  useEffect(() => {
    if (!step || !baselineRef.current) return;
    if (step.isComplete(snapshot, baselineRef.current)) {
      const t = setTimeout(nextStep, 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStep, processStep, masterActive,
    participants, reinsurer.enabled, reinsurer.confirmed,
    contracts.length, claims, activeTab, nextStep,
  ]);

  /* ── select-contract step: DOM change 리스너 ── */

  useEffect(() => {
    if (!step || step.anchor !== GUIDE_ANCHORS.SELECT_CONTRACT) return;
    const el = document.querySelector(`[data-guide="${GUIDE_ANCHORS.SELECT_CONTRACT}"]`) as HTMLSelectElement | null;
    if (!el) return;
    const handler = () => {
      if (el.value !== '0') setTimeout(nextStep, 350);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [currentStep, step, nextStep]);

  /* ── Completion overlay ── */

  if (showComplete) {
    return createPortal(
      <CompleteOverlay onClick={dismissComplete}>
        <CompleteCard onClick={e => e.stopPropagation()}>
          <CompleteEmoji>🎉</CompleteEmoji>
          <CompleteText>{t('guide.complete')}</CompleteText>
          <CompleteBtn onClick={dismissComplete}>{t('guide.closeBtn')}</CompleteBtn>
        </CompleteCard>
      </CompleteOverlay>,
      document.body,
    );
  }

  /* ── 활성 step 없음 ── */

  if (currentStep === null || !step) return null;

  const showNext = step.manualNext === true;
  const visible = !!targetRect;
  const tooltipStyle = targetRect
    ? getTooltipStyle(targetRect, step.position)
    : { top: -9999, left: -9999 } as React.CSSProperties; // off-screen 유지 (transition 부드럽게)

  return createPortal(
    <>
      <TooltipWrap visible={visible} smoothPos={smoothPos} style={tooltipStyle}>
        <Arrow position={step.position} />
        <StepBadge>{step.step} / {TOTAL_STEPS}</StepBadge>
        <TooltipTitle>{t(step.titleKey)}</TooltipTitle>
        <TooltipDesc>{t(step.descKey)}</TooltipDesc>
        <TooltipFooter>
          <SkipBtn onClick={skipTour}>{t('guide.skip')}</SkipBtn>
          {showNext && <NextBtn onClick={nextStep}>{t('guide.next')}</NextBtn>}
        </TooltipFooter>
      </TooltipWrap>
      {!visible && missingAnchor && (
        <CenterNotice>
          <div style={{ marginBottom: 8 }}>
            {t('guide.anchorMissing', { step: step.step, total: TOTAL_STEPS })}
          </div>
          <SkipBtn onClick={skipTour}>{t('guide.skip')}</SkipBtn>
        </CenterNotice>
      )}
    </>,
    document.body,
  );
}
