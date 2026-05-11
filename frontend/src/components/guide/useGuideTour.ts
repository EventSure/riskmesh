import { create } from 'zustand';
import i18n from '@/i18n';
import { useProtocolStore } from '@/store/useProtocolStore';
import { TOTAL_STEPS } from './guideSteps';

const STORAGE_KEY = 'riskmesh-guide-completed';

interface GuideTourStore {
  currentStep: number | null;
  showComplete: boolean;
  /**
   * Guide 시작 — 항상 simulation 모드 + 초기 상태에서 step 1부터.
   * 진행 중인 simulation이 있으면 confirm으로 사용자 의사를 한 번 확인한다.
   */
  startTour: () => void;
  nextStep: () => void;
  skipTour: () => void;
  dismissComplete: () => void;
}

export const useGuideTour = create<GuideTourStore>((set, get) => ({
  currentStep: null,
  showComplete: false,

  startTour: () => {
    const protocol = useProtocolStore.getState();
    if (protocol.mode !== 'simulation') {
      protocol.setMode('simulation');
    }
    const dirty = protocol.processStep > 0 || protocol.masterActive
      || protocol.contracts.length > 0 || protocol.claims.length > 0;
    if (dirty) {
      const ok = window.confirm(i18n.t('guide.startConfirmReset'));
      if (!ok) return;
      protocol.resetAll();
    }
    // role을 leader로 강제 (setTerms/activate가 leader 권한 요구)
    if (protocol.role !== 'leader' && protocol.role !== 'operator') {
      protocol.setRole('leader');
    }
    set({ currentStep: 0, showComplete: false });
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep === null) return;
    if (currentStep >= TOTAL_STEPS - 1) {
      set({ currentStep: null, showComplete: true });
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      set({ currentStep: currentStep + 1 });
    }
  },

  skipTour: () => {
    set({ currentStep: null, showComplete: false });
    localStorage.setItem(STORAGE_KEY, 'true');
  },

  dismissComplete: () => set({ showComplete: false }),
}));

export const isGuideCompleted = () => localStorage.getItem(STORAGE_KEY) === 'true';
