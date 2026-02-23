import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Button } from '@/components/common';
import { Tag } from '@/components/common';
import { FormGroup, FormLabel, FormInput } from '@/components/common';
import { SummaryRow } from '@/components/common';
import { Divider } from '@/components/common';

const CmpGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
`;

const CmpTitle = styled.div`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 7px;
`;

const CmpItem = styled.div`
  font-size: 10px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 5px;

  &::before {
    content: '';
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }
`;

const CmpPanel = styled.div<{ variant: 'trad' | 'chain' }>`
  border-radius: 10px;
  padding: 12px;
  border: 1px solid;
  ${({ variant, theme }) =>
    variant === 'trad'
      ? `
    border-color: rgba(148,163,184,.25);
    background: rgba(148,163,184,.04);
    ${CmpTitle} { color: ${theme.colors.sub}; }
    ${CmpItem} { color: ${theme.colors.danger}; }
  `
      : `
    border-color: rgba(153,69,255,.35);
    background: rgba(153,69,255,.07);
    ${CmpTitle} { color: ${theme.colors.primary}; }
    ${CmpItem} { color: ${theme.colors.success}; }
  `}
`;

export function OracleConsole() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Oracle Console</CardTitle>
        <Tag variant="subtle">Switchboard-like</Tag>
      </CardHeader>
      <CardBody>
        <SummaryRow style={{ gap: 8, alignItems: 'flex-end' }}>
          <FormGroup style={{ flex: 1 }}>
            <FormLabel>Delay (min) — must be ≥0, ×10</FormLabel>
            <FormInput type="number" step={10} min={0} defaultValue={130} />
          </FormGroup>
          <FormGroup style={{ flex: 1 }}>
            <FormLabel>Freshness (min ago)</FormLabel>
            <FormInput type="number" min={0} max={60} defaultValue={5} />
          </FormGroup>
        </SummaryRow>
        <Button variant="primary" fullWidth style={{ marginTop: 8 }}>
          🔮 check_oracle_and_create_claim (public)
        </Button>
        <Divider />
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 8 }}>
          Why On-chain?
        </div>
        <CmpGrid>
          <CmpPanel variant="trad">
            <CmpTitle>Traditional</CmpTitle>
            <CmpItem>3–14 day settlement</CmpItem>
            <CmpItem>Manual claims review</CmpItem>
            <CmpItem>Counterparty risk</CmpItem>
            <CmpItem>No audit trail</CmpItem>
          </CmpPanel>
          <CmpPanel variant="chain">
            <CmpTitle>On-Chain (MVP)</CmpTitle>
            <CmpItem>Sub-1s settlement</CmpItem>
            <CmpItem>Oracle-verified trigger</CmpItem>
            <CmpItem>Pre-funded vault</CmpItem>
            <CmpItem>Immutable audit log</CmpItem>
          </CmpPanel>
        </CmpGrid>
      </CardBody>
    </Card>
  );
}
