import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody, Button } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';

const StepItem = styled.div<{ active?: boolean; done?: boolean }>`
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 6px;
  transition: all 0.3s;
  ${p => p.active && `border-color: var(--primary); background: rgba(153,69,255,.05);`}
  ${p => p.done && `border-color: var(--success); background: rgba(34,197,94,.04);`}
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 3px;
`;

const StepNum = styled.div<{ done?: boolean; cur?: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${p => p.done ? 'var(--success)' : p.cur ? 'var(--primary)' : 'var(--border)'};
  color: ${p => (p.done || p.cur) ? '#0B1120' : 'inherit'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  flex-shrink: 0;
`;

const StepName = styled.span`
  font-size: 11px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
`;

const StepRole = styled.span`
  font-size: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.1);
  color: var(--sub);
  border: 1px solid rgba(148, 163, 184, 0.2);
`;

const StepDesc = styled.div`
  font-size: 9px;
  color: var(--sub);
  line-height: 1.5;
  padding-left: 25px;
`;

export function ContractProcess() {
  const { processStep, resetAll } = useProtocolStore();
  const { toast } = useToast();
  const { t } = useTranslation();

  const STEPS = [
    { n: 1, name: t('process.step1.name'), role: t('process.step1.role'), desc: t('process.step1.desc') },
    { n: 2, name: t('process.step2.name'), role: t('process.step2.role'), desc: t('process.step2.desc') },
    { n: 3, name: t('process.step3.name'), role: t('process.step3.role'), desc: t('process.step3.desc') },
    { n: 4, name: t('process.step4.name'), role: t('process.step4.role'), desc: t('process.step4.desc') },
    { n: 5, name: t('process.step5.name'), role: t('process.step5.role'), desc: t('process.step5.desc') },
  ];

  const handleReset = () => {
    resetAll();
    toast(t('toast.resetDone'), 'i');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('process.title')}</CardTitle>
        <Button variant="outline" size="sm" onClick={handleReset}>{t('common.reset')}</Button>
      </CardHeader>
      <CardBody style={{ padding: 10 }}>
        {STEPS.map((s, i) => {
          const done = i < processStep;
          const cur = i === processStep;
          return (
            <StepItem key={s.n} active={cur} done={done}>
              <StepHeader>
                <StepNum done={done} cur={cur}>{done ? '✓' : s.n}</StepNum>
                <StepName>{s.name}</StepName>
                <StepRole>{s.role}</StepRole>
              </StepHeader>
              <StepDesc>{s.desc}</StepDesc>
            </StepItem>
          );
        })}
      </CardBody>
    </Card>
  );
}
