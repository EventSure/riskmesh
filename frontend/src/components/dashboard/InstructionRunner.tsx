import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Button } from '@/components/common';

type StepStatus = 'active' | 'done' | 'error' | 'default';
type NumStatus = 'done' | 'cur' | 'default';

const StepItem = styled.div<{ status?: StepStatus }>`
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  transition: all .3s;

  ${p => p.status === 'active' && `
    border-color: var(--primary);
    background: rgba(153,69,255,.06);
  `}
  ${p => p.status === 'done' && `
    border-color: var(--success);
    background: rgba(34,197,94,.05);
  `}
  ${p => p.status === 'error' && `
    border-color: var(--danger);
  `}
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
`;

const StepNum = styled.div<{ status?: NumStatus }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${p =>
    p.status === 'done'
      ? 'var(--success)'
      : p.status === 'cur'
      ? 'var(--primary)'
      : 'var(--border)'};
  color: ${p =>
    p.status === 'done'
      ? '#0B1120'
      : p.status === 'cur'
      ? '#fff'
      : 'inherit'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
`;

const StepName = styled.span`
  font-size: 12px;
  font-weight: 700;
  font-family: 'DM Mono', monospace;
`;

const StepRole = styled.span`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-family: 'DM Mono', monospace;
`;

const StepDetail = styled.div`
  font-size: 10px;
  color: var(--sub);
  line-height: 1.6;
  padding-left: 28px;
`;


interface Step { num: number; name: string; role: string; roleColor: string; detail: string; }
const steps: Step[] = [
  { num: 1, name: 'create_policy', role: 'leader', roleColor: '#9945FF', detail: 'Initializes Policy PDA. Sets all parameters.' },
  { num: 2, name: 'open_underwriting', role: 'leader', roleColor: '#9945FF', detail: 'Creates Underwriting PDA. Opens acceptance window.' },
  { num: 3, name: 'accept_share (Leader)', role: 'leader', roleColor: '#9945FF', detail: 'Leader auto-accepts 4000 bps + deposits escrow to vault.' },
  { num: 4, name: 'accept_share (Participant A)', role: 'partA', roleColor: '#14F195', detail: 'Participant A accepts 3500 bps + deposits escrow.' },
  { num: 5, name: 'accept_share (Participant B)', role: 'partB', roleColor: '#F59E0B', detail: 'Participant B accepts 2500 bps + deposits escrow.' },
  { num: 6, name: 'activate_policy', role: 'leader', roleColor: '#9945FF', detail: 'Verifies total_ratio==10000 & vault funded. Sets Active.' },
  { num: 7, name: 'check_oracle_and_create_claim', role: 'public', roleColor: '#94A3B8', detail: 'Reads oracle feed. Validates freshness & format. Creates Claim if delay>=threshold.' },
  { num: 8, name: 'approve_claim', role: 'leader/op', roleColor: '#EF4444', detail: 'Leader/Operator reviews and approves Claim manually.' },
  { num: 9, name: 'settle_claim', role: 'leader/op', roleColor: '#EF4444', detail: 'Transfers payout from vault. Deducts losses proportionally.' },
];

export function InstructionRunner() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Instruction Runner</CardTitle>
        <Button variant="outline" size="sm">&#8634; Reset</Button>
      </CardHeader>
      <CardBody>
        {steps.map((step, i) => (
          <StepItem key={step.num} status={i === 0 ? 'active' : 'default'}>
            <StepHeader>
              <StepNum status={i === 0 ? 'cur' : 'default'}>{step.num}</StepNum>
              <StepName>{step.name}</StepName>
              <StepRole
                style={{
                  background: `${step.roleColor}20`,
                  color: step.roleColor,
                  border: `1px solid ${step.roleColor}40`,
                }}
              >
                {step.role}
              </StepRole>
            </StepHeader>
            <StepDetail>{step.detail}</StepDetail>
          </StepItem>
        ))}
      </CardBody>
    </Card>
  );
}
