import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody, Divider, SummaryRow } from '@/components/common';

const ComparisonItem = styled.div<{ variant: 'bad' | 'good' }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 10px;
  ${p => p.variant === 'bad' && `
    border: 1px solid rgba(239,68,68,.25);
    background: rgba(239,68,68,.04);
    color: var(--danger);
  `}
  ${p => p.variant === 'good' && `
    border: 1px solid rgba(20,241,149,.25);
    background: rgba(20,241,149,.04);
    color: var(--accent);
  `}
`;

export function ComparisonPanel() {
  return (
    <Card>
      <CardHeader><CardTitle>Traditional vs On-Chain</CardTitle></CardHeader>
      <CardBody>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: 6 }}>기존 방식</div>
        <ComparisonItem variant="bad">⏳ 월별 일괄 정산</ComparisonItem>
        <ComparisonItem variant="bad">📋 수동 검토 및 승인</ComparisonItem>
        <ComparisonItem variant="bad">⚠️ 정산 오류 위험</ComparisonItem>
        <ComparisonItem variant="bad" style={{ marginBottom: 10 }}>🕐 T+14~30일</ComparisonItem>

        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 6 }}>OpenParametric</div>
        <ComparisonItem variant="good">⚡ 건당 실시간 정산</ComparisonItem>
        <ComparisonItem variant="good">🔮 오라클 자동 검증</ComparisonItem>
        <ComparisonItem variant="good">📝 온체인 불변 기록</ComparisonItem>
        <ComparisonItem variant="good" style={{ marginBottom: 10 }}>⚡ T+0 즉시 정산</ComparisonItem>

        <Divider />
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>절약 시간</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>14~30일</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>정산 오류율</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--success)' }}>0%</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>감사 추적</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>실시간 온체인</span>
        </SummaryRow>
      </CardBody>
    </Card>
  );
}
