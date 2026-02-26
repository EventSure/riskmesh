import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody, Button } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';

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

const STEPS = [
  { n: 1, name: '약관 세팅 & 요율 산정', role: '리더사', desc: '리더사가 담보 조건, 보험료, 지분 구조를 세팅합니다.' },
  { n: 2, name: '참여사 A 컨펌', role: '참여사A', desc: '참여사 A가 조건 및 요율을 검토하고 컨펌합니다.' },
  { n: 3, name: '참여사 B 컨펌', role: '참여사B', desc: '참여사 B가 조건 및 요율을 검토하고 컨펌합니다.' },
  { n: 4, name: '재보험사 컨펌', role: '재보험사', desc: '재보험사가 조건 및 요율을 검토하고 컨펌합니다.' },
  { n: 5, name: '마스터 계약 활성화', role: '리더사', desc: '모든 컨펌 완료. 마스터 계약이 온체인에 기록됩니다.' },
];

export function ContractProcess() {
  const { processStep, resetAll } = useProtocolStore();
  const { toast } = useToast();

  const handleReset = () => {
    resetAll();
    toast('전체 초기화 완료', 'i');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>계약 체결 프로세스</CardTitle>
        <Button variant="outline" size="sm" onClick={handleReset}>↺ 초기화</Button>
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
