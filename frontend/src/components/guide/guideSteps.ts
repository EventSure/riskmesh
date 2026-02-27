export interface GuideStep {
  step: number;
  target: string;
  titleKey: string;
  descKey: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export const GUIDE_STEPS: GuideStep[] = [
  { step: 1, target: 'set-terms-btn', titleKey: 'guide.step1.title', descKey: 'guide.step1.desc', position: 'right' },
  { step: 2, target: 'role-select', titleKey: 'guide.step2.title', descKey: 'guide.step2.desc', position: 'bottom' },
  { step: 3, target: 'confirm-partA', titleKey: 'guide.step3.title', descKey: 'guide.step3.desc', position: 'right' },
  { step: 4, target: 'role-select', titleKey: 'guide.step4.title', descKey: 'guide.step4.desc', position: 'bottom' },
  { step: 5, target: 'confirm-partB', titleKey: 'guide.step5.title', descKey: 'guide.step5.desc', position: 'right' },
  { step: 6, target: 'role-select', titleKey: 'guide.step6.title', descKey: 'guide.step6.desc', position: 'bottom' },
  { step: 7, target: 'confirm-rein', titleKey: 'guide.step7.title', descKey: 'guide.step7.desc', position: 'right' },
  { step: 8, target: 'role-select', titleKey: 'guide.step8.title', descKey: 'guide.step8.desc', position: 'bottom' },
  { step: 9, target: 'activate-btn', titleKey: 'guide.step9.title', descKey: 'guide.step9.desc', position: 'right' },
  { step: 10, target: 'fund-pool-btn', titleKey: 'guide.step10.title', descKey: 'guide.step10.desc', position: 'right' },
  { step: 11, target: 'tab-feed', titleKey: 'guide.step11.title', descKey: 'guide.step11.desc', position: 'bottom' },
  { step: 12, target: 'create-contract-btn', titleKey: 'guide.step12.title', descKey: 'guide.step12.desc', position: 'right' },
  { step: 13, target: 'tab-oracle', titleKey: 'guide.step13.title', descKey: 'guide.step13.desc', position: 'bottom' },
  { step: 14, target: 'select-contract', titleKey: 'guide.step14.title', descKey: 'guide.step14.desc', position: 'right' },
  { step: 15, target: 'resolve-btn', titleKey: 'guide.step15.title', descKey: 'guide.step15.desc', position: 'right' },
  { step: 16, target: 'settle-btn', titleKey: 'guide.step16.title', descKey: 'guide.step16.desc', position: 'right' },
  { step: 17, target: 'tab-settlement', titleKey: 'guide.step17.title', descKey: 'guide.step17.desc', position: 'bottom' },
];

export const TOTAL_STEPS = GUIDE_STEPS.length;
