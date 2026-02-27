import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { keyframes } from '@emotion/react';
import { useTranslation } from 'react-i18next';
import { useGuideTour } from './useGuideTour';
import { GUIDE_STEPS, TOTAL_STEPS } from './guideSteps';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import type { TabId } from '@/components/layout/TabBar';

interface Props {
  activeTab: TabId;
}

/* ── Animations ── */

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

// const pulse = keyframes`
//   0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.6); }
//   50% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.65); }
// `;

const completeFadeIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

/* ── Styled ── */

// const Spotlight = styled.div`
//   position: fixed;
//   z-index: 9998;
//   border-radius: 8px;
//   box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
//   pointer-events: none;
//   transition: top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease;
//   animation: ${pulse} 3s ease-in-out infinite;
// `;

const TooltipWrap = styled.div`
  position: fixed;
  z-index: 9999;
  min-width: 240px;
  max-width: 300px;
  background: rgba(17, 24, 39, 0.98);
  border: 1px solid rgba(153, 69, 255, 0.4);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(153,69,255,0.12);
  animation: ${fadeIn} 0.25s ease;
  pointer-events: auto;
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

/* ── Completion overlay ── */

const CompleteOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9998;
  /* background: rgba(0, 0, 0, 0.7); */
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

/* Steps that need a manual "Next" button (auto-advance not reliable) */
const MANUAL_STEPS = new Set([10, 14]);

/* ── Component ── */

export function GuideTour({ activeTab }: Props) {
  const { currentStep, showComplete, nextStep, skipTour, dismissComplete } = useGuideTour();
  const { t } = useTranslation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const { processStep, role, confirms, masterActive, contracts, claims } = useProtocolStore(
    useShallow(s => ({
      processStep: s.processStep,
      role: s.role,
      confirms: s.confirms,
      masterActive: s.masterActive,
      contracts: s.contracts,
      claims: s.claims,
    })),
  );

  const contractsAtStart = useRef(0);
  const claimsAtStart = useRef(0);

  const step = currentStep !== null ? GUIDE_STEPS[currentStep] : null;

  /* ── Find & track target element ── */

  const updateRect = useCallback(() => {
    if (!step) { setTargetRect(null); return; }
    const el = document.querySelector(`[data-guide="${step.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      requestAnimationFrame(() => {
        setTargetRect(el.getBoundingClientRect());
      });
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (currentStep === null) { setTargetRect(null); return; }
    const timer = setTimeout(updateRect, 150);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [currentStep, updateRect]);

  /* ── Auto-skip when target not found (e.g. Fund Pool in sim mode) ── */

  useEffect(() => {
    if (currentStep === null || targetRect) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-guide="${GUIDE_STEPS[currentStep]!.target}"]`);
      if (!el) nextStep();
    }, 600);
    return () => clearTimeout(timer);
  }, [currentStep, targetRect, nextStep]);

  /* ── Snapshot counts when step changes ── */

  useEffect(() => {
    contractsAtStart.current = contracts.length;
    claimsAtStart.current = claims.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /* ── Auto-advance based on store state ── */

  useEffect(() => {
    if (currentStep === null) return;
    const sn = GUIDE_STEPS[currentStep]!.step;
    let ok = false;
    switch (sn) {
      case 1: ok = processStep >= 1; break;
      case 2: ok = role === 'partA'; break;
      case 3: ok = confirms.partA; break;
      case 4: ok = role === 'partB'; break;
      case 5: ok = confirms.partB; break;
      case 6: ok = role === 'rein'; break;
      case 7: ok = confirms.rein; break;
      case 8: ok = role === 'leader'; break;
      case 9: ok = masterActive; break;
      case 11: ok = activeTab === 'tab-feed'; break;
      case 12: ok = contracts.length > contractsAtStart.current; break;
      case 13: ok = activeTab === 'tab-oracle'; break;
      case 15: ok = claims.length > claimsAtStart.current; break;
      case 16: ok = claims.some(c => c.status === 'settled'); break;
      case 17: ok = activeTab === 'tab-settlement'; break;
    }
    if (ok) {
      const timer = setTimeout(nextStep, 350);
      return () => clearTimeout(timer);
    }
  }, [currentStep, processStep, role, confirms, masterActive, activeTab, contracts.length, claims, nextStep]);

  /* ── Step 14: DOM event listener for select change ── */

  useEffect(() => {
    if (currentStep === null || GUIDE_STEPS[currentStep]!.step !== 14) return;
    const el = document.querySelector('[data-guide="select-contract"]') as HTMLSelectElement;
    if (!el) return;
    const handler = () => {
      if (el.value !== '0') setTimeout(nextStep, 350);
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [currentStep, nextStep]);

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

  /* ── No active step ── */

  if (currentStep === null || !step || !targetRect) return null;

  const showNext = MANUAL_STEPS.has(step.step);

  return createPortal(
    <>
      {/* <Spotlight
        style={{
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
        }}
      /> */}
      <TooltipWrap key={currentStep} style={getTooltipStyle(targetRect, step.position)}>
        <Arrow position={step.position} />
        <StepBadge>{step.step} / {TOTAL_STEPS}</StepBadge>
        <TooltipTitle>{t(step.titleKey)}</TooltipTitle>
        <TooltipDesc>{t(step.descKey)}</TooltipDesc>
        <TooltipFooter>
          <SkipBtn onClick={skipTour}>{t('guide.skip')}</SkipBtn>
          {showNext && <NextBtn onClick={nextStep}>{t('guide.next')}</NextBtn>}
        </TooltipFooter>
      </TooltipWrap>
    </>,
    document.body,
  );
}
