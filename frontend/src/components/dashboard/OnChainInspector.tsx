import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { Mono } from '@/components/common';

export const InspectorAccount = styled.div`
  background: ${p => p.theme.colors.card2};
  border: 1px solid ${p => p.theme.colors.border};
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
`;

export const IaHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

export const IaIcon = styled.div`
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(153, 69, 255, 0.15);
  border: 1px solid rgba(153, 69, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
`;

export const IaName = styled.div`
  font-size: 11px;
  font-weight: 700;
  font-family: ${p => p.theme.fonts.mono};
`;

export const IaPda = styled.div`
  font-size: 9px;
  color: ${p => p.theme.colors.sub};
  font-family: ${p => p.theme.fonts.mono};
  margin-top: 1px;
  word-break: break-all;
`;

export const IaField = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 3px 0;
  border-bottom: 1px solid rgba(31, 41, 55, 0.5);
  &:last-child {
    border-bottom: none;
  }
`;

export const IaKey = styled.div`
  font-size: 10px;
  color: ${p => p.theme.colors.sub};
  font-family: ${p => p.theme.fonts.mono};
  flex-shrink: 0;
  margin-right: 8px;
`;

type IaValVariant = 'default' | 'accent' | 'warn' | 'danger';

export const IaVal = styled.div<{ variant?: IaValVariant }>`
  font-size: 10px;
  font-family: ${p => p.theme.fonts.mono};
  text-align: right;
  word-break: break-all;
  color: ${p => {
    switch (p.variant) {
      case 'accent': return p.theme.colors.accent;
      case 'warn':   return p.theme.colors.warning;
      case 'danger': return p.theme.colors.danger;
      default:       return p.theme.colors.text;
    }
  }};
`;

export const PdaSeed = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
`;

export const SeedChip = styled.span`
  padding: 2px 7px;
  background: rgba(153, 69, 255, 0.1);
  border: 1px solid rgba(153, 69, 255, 0.25);
  border-radius: 4px;
  font-size: 9px;
  font-family: ${p => p.theme.fonts.mono};
  color: ${p => p.theme.colors.primary};
`;

export function OnChainInspector() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>On-chain Inspector</CardTitle>
        <Mono style={{ fontSize: '9px', color: 'var(--sub)' }}>PDAs</Mono>
      </CardHeader>
      <CardBody style={{ padding: '10px' }}>
        <div style={{ fontSize: '10px', color: 'var(--sub)', textAlign: 'center', padding: '20px' }}>
          Create a policy to inspect accounts.
        </div>
      </CardBody>
    </Card>
  );
}
