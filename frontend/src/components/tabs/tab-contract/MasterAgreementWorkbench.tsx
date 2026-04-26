import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Tag } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { MasterContractSetup } from './MasterContractSetup';
import { MasterAgreementNameEditor } from './MasterAgreementNameEditor';
import { MasterAgreementReviewPanel, type MasterAgreementReviewStep } from './MasterAgreementReviewPanel';
import { ParticipantConfirm } from './ParticipantConfirm';

type StepStatus = 'done' | 'active' | 'locked';

const WorkbenchRoot = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(153, 69, 255, 0.08) 0%, rgba(153, 69, 255, 0) 100%),
    var(--bg);

  @media (max-width: 767px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const TitleBlock = styled.div`
  min-width: 0;
`;

const Eyebrow = styled.div`
  margin-bottom: 4px;
  color: var(--sub);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Title = styled.h2`
  margin: 0;
  color: var(--text);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
`;

const StatusWrap = styled.div`
  flex-shrink: 0;
`;

const StepBar = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(11, 17, 32, 0.35);

  @media (max-width: 767px) {
    grid-template-columns: 1fr;
  }
`;

const StepButton = styled.button<{ status: StepStatus }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.72);
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;

  ${({ status }) => status === 'active' && `
    border-color: rgba(20, 241, 149, 0.38);
    background: rgba(20, 241, 149, 0.08);
  `}

  ${({ status }) => status === 'done' && `
    border-color: rgba(153, 69, 255, 0.34);
    background: rgba(153, 69, 255, 0.08);
  `}

  ${({ status }) => status === 'locked' && `
    opacity: 0.52;
    cursor: not-allowed;
  `}

  &:hover {
    transform: ${({ status }) => (status === 'locked' ? 'none' : 'translateY(-1px)')};
    border-color: ${({ status }) => (status === 'locked' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(20, 241, 149, 0.38)')};
  }
`;

const StepText = styled.div`
  min-width: 0;
`;

const StepKicker = styled.div`
  margin-bottom: 4px;
  color: var(--sub);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const StepLabel = styled.div`
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
`;

const StepBadge = styled.span<{ status: StepStatus }>`
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${({ status }) => (status === 'locked' ? 'var(--sub)' : 'var(--text)')};
  background: ${({ status }) => {
    if (status === 'active') return 'rgba(20, 241, 149, 0.15)';
    if (status === 'done') return 'rgba(153, 69, 255, 0.15)';
    return 'rgba(148, 163, 184, 0.12)';
  }};
`;

const Body = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.75fr) minmax(280px, 0.9fr);
  gap: 20px;
  flex: 1;
  min-height: 0;
  padding: 20px;

  @media (max-width: 1199px) {
    grid-template-columns: 1fr;
  }
`;

const MainColumn = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
`;

const ReviewColumn = styled.aside`
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;

  @media (max-width: 767px) {
    display: none;
  }
`;

const WorkArea = styled.div`
  min-height: 0;
`;

const EditorWrap = styled.div`
  margin-bottom: 16px;
`;

function getRecommendedStep(processStep: number, masterActive: boolean): MasterAgreementReviewStep {
  if (masterActive || processStep >= 4) {
    return 'activate';
  }

  if (processStep >= 1) {
    return 'participants';
  }

  return 'basic';
}

function getStepStatus(step: MasterAgreementReviewStep, processStep: number, masterActive: boolean): StepStatus {
  if (step === 'basic') {
    return processStep >= 1 ? 'done' : 'active';
  }

  if (step === 'participants') {
    if (processStep < 1) {
      return 'locked';
    }

    return processStep >= 4 || masterActive ? 'done' : 'active';
  }

  if (processStep < 4 && !masterActive) {
    return 'locked';
  }

  return masterActive ? 'done' : 'active';
}

function StepContent({
  step,
  onTermsSet,
  onActivated,
}: {
  step: MasterAgreementReviewStep;
  onTermsSet: () => void;
  onActivated: () => void;
}) {
  if (step === 'basic') {
    return <MasterContractSetup onTermsSet={onTermsSet} />;
  }

  return <ParticipantConfirm onActivated={onActivated} />;
}

export function MasterAgreementWorkbench() {
  const { t } = useTranslation();
  const { processStep, masterActive, role, masterAgreementPDA } = useProtocolStore(useShallow(state => ({
    processStep: state.processStep,
    masterActive: state.masterActive,
    role: state.role,
    masterAgreementPDA: state.masterAgreementPDA,
  })));
  const [activeStep, setActiveStep] = useState<MasterAgreementReviewStep>(() => getRecommendedStep(processStep, masterActive));
  const handleTermsSet = () => setActiveStep('participants');
  const handleActivated = () => setActiveStep('activate');
  const canEditName = !!masterAgreementPDA && (role === 'leader' || role === 'operator');

  useEffect(() => {
    setActiveStep(getRecommendedStep(processStep, masterActive));
  }, [processStep, masterActive]);

  const steps: Array<{ id: MasterAgreementReviewStep; label: string }> = [
    { id: 'basic', label: t('master.step.basic') },
    { id: 'participants', label: t('master.step.participants') },
    { id: 'activate', label: t('master.step.activate') },
  ];

  return (
    <WorkbenchRoot data-testid="master-agreement-workbench">
      <Header>
        <TitleBlock>
          <Eyebrow>Master Agreement</Eyebrow>
          <Title>{t('master.title')}</Title>
        </TitleBlock>
        <StatusWrap>
          <Tag variant={masterActive ? 'accent' : 'warning'}>
            {masterActive ? t('common.active') : t('common.inactive')}
          </Tag>
        </StatusWrap>
      </Header>

      <StepBar aria-label={t('master.workbench.steps')}>
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, processStep, masterActive);
          const selected = activeStep === step.id;

          return (
            <StepButton
              key={step.id}
              type="button"
              status={selected ? 'active' : status}
              disabled={status === 'locked'}
              onClick={() => setActiveStep(step.id)}
            >
              <StepText>
                <StepKicker>{`Step ${index + 1}`}</StepKicker>
                <StepLabel>{step.label}</StepLabel>
              </StepText>
              <StepBadge status={selected ? 'active' : status}>{status}</StepBadge>
            </StepButton>
          );
        })}
      </StepBar>

      <Body>
        <MainColumn>
          {canEditName && (
            <EditorWrap>
              <MasterAgreementNameEditor />
            </EditorWrap>
          )}
          <WorkArea>
            <StepContent step={activeStep} onTermsSet={handleTermsSet} onActivated={handleActivated} />
          </WorkArea>
        </MainColumn>
        <ReviewColumn>
          <MasterAgreementReviewPanel selectedStep={activeStep} />
        </ReviewColumn>
      </Body>
    </WorkbenchRoot>
  );
}
