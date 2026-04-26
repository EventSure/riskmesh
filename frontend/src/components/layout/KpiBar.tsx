import styled from '@emotion/styled';
import { useShallow } from 'zustand/react/shallow';
import { useProtocolStore } from '@/store/useProtocolStore';

const Bar = styled.div`
  display: flex;
  background: ${p => p.theme.colors.card2};
  border-bottom: 1px solid ${p => p.theme.colors.border};
  position: sticky;
  top: 48px;
  z-index: 150;
  flex-shrink: 0;
`;

const Item = styled.div`
  flex: 1;
  padding: 10px 24px;
  border-right: 1px solid ${p => p.theme.colors.border};
  &:last-child { border-right: none; }
`;

const Label = styled.div`
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${p => p.theme.colors.sub};
  margin-bottom: 3px;
`;

const ValueRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const Value = styled.span<{ color: string }>`
  font-size: 20px;
  font-weight: 700;
  font-family: ${p => p.theme.fonts.mono};
  line-height: 1.1;
  color: ${p => p.color};
`;

const Delta = styled.span<{ positive: boolean }>`
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background: ${p => p.positive
    ? 'rgba(20,241,149,0.08)'
    : 'rgba(239,68,68,0.08)'};
  color: ${p => p.positive
    ? p.theme.colors.accent
    : p.theme.colors.danger};
`;

function formatPool(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v}`;
}

export function KpiBar() {
  const { poolBalance, claimCount, masterActive, coverageEnd, kpiSnapshot } =
    useProtocolStore(useShallow(s => ({
      poolBalance: s.poolBalance,
      claimCount: s.claimCount,
      masterActive: s.masterActive,
      coverageEnd: s.coverageEnd,
      kpiSnapshot: s.kpiSnapshot,
    })));

  const poolDelta = kpiSnapshot ? poolBalance - kpiSnapshot.poolBalance : 0;
  const claimDelta = kpiSnapshot ? claimCount - kpiSnapshot.claimCount : 0;

  const masterLabel = masterActive ? 'Active' : 'Inactive';
  const masterSub = masterActive && coverageEnd
    ? `~${coverageEnd.slice(0, 7)}`
    : '';

  return (
    <Bar>
      <Item>
        <Label>총 풀 규모</Label>
        <ValueRow>
          <Value color="#9945FF">{formatPool(poolBalance)}</Value>
          {poolDelta !== 0 && (
            <Delta positive={poolDelta > 0}>
              {poolDelta > 0 ? '↑' : '↓'} {formatPool(Math.abs(poolDelta))}
            </Delta>
          )}
        </ValueRow>
      </Item>
      <Item>
        <Label>활성 증권</Label>
        <ValueRow>
          <Value color="#14F195">{claimCount}</Value>
        </ValueRow>
      </Item>
      <Item>
        <Label>미결 클레임</Label>
        <ValueRow>
          <Value color="#F59E0B">{claimCount}</Value>
          {claimDelta !== 0 && (
            <Delta positive={false}>
              ↑ {claimDelta} 신규
            </Delta>
          )}
        </ValueRow>
      </Item>
      <Item>
        <Label>마스터 계약</Label>
        <ValueRow>
          <Value color="#38BDF8">{masterLabel}</Value>
          {masterSub && (
            <span style={{ fontSize: 9, color: '#4B5563', fontFamily: 'DM Mono, monospace' }}>
              {masterSub}
            </span>
          )}
        </ValueRow>
      </Item>
    </Bar>
  );
}
