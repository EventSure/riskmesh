import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { FormLabel } from '@/components/common';
import { SummaryRow } from '@/components/common';
import { Mono } from '@/components/common';

const TokenToggleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(153, 69, 255, 0.08);
  border: 1px solid rgba(153, 69, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 10px;
`;

const ToggleSwitch = styled.div<{ on?: boolean }>`
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: ${p => (p.on ? p.theme.colors.primary : p.theme.colors.border)};
  position: relative;
  transition: background 0.3s;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.3s;
    transform: ${p => (p.on ? 'translateX(14px)' : 'translateX(0)')};
  }
`;

const TokenLabel = styled.span`
  font-size: 11px;
  font-weight: 600;
`;

const TokenHint = styled.div`
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
  margin-top: 1px;
`;

export function RiskTokenToggle() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Token Mode (Phase 2 Preview)</CardTitle>
      </CardHeader>
      <CardBody>
        <TokenToggleWrap>
          <ToggleSwitch />
          <div>
            <TokenLabel>Enable Risk Token Mode</TokenLabel>
            <TokenHint>Phase 2 feature — not active in MVP</TokenHint>
          </div>
        </TokenToggleWrap>
        <div style={{ display: 'none' }}>
          <SummaryRow>
            <FormLabel as="span">token_supply</FormLabel>
            <Mono>—</Mono>
          </SummaryRow>
          <SummaryRow>
            <FormLabel as="span">token_value</FormLabel>
            <Mono>—</Mono>
          </SummaryRow>
          <SummaryRow>
            <FormLabel as="span">market_cap</FormLabel>
            <Mono>—</Mono>
          </SummaryRow>
          <canvas
            style={{
              width: '100%',
              height: 80,
              marginTop: 8,
              background: 'var(--card2)',
              borderRadius: 6,
            }}
          />
        </div>
      </CardBody>
    </Card>
  );
}
