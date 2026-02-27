import { create } from 'zustand';
import { TOTAL_STEPS } from './guideSteps';

const STORAGE_KEY = 'riskmesh-guide-completed';

interface GuideTourStore {
  currentStep: number | null;
  showComplete: boolean;
  startTour: () => void;
  nextStep: () => void;
  skipTour: () => void;
  dismissComplete: () => void;
}

export const useGuideTour = create<GuideTourStore>((set, get) => ({
  currentStep: null,
  showComplete: false,

  startTour: () => set({ currentStep: 0, showComplete: false }),

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
