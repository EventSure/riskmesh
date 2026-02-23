import { Card, CardHeader, CardTitle, CardBody, SummaryRow, Divider } from '@/components/common';
import { useProtocolStore, fmt } from '@/store/useProtocolStore';

export function AccumulatedSummary() {
  const { contracts, totPrem, acc } = useProtocolStore();

  return (
    <Card>
      <CardHeader><CardTitle>누적 요약</CardTitle></CardHeader>
      <CardBody>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>총 계약 건수</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{contracts.length}건</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>총 보험료</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{fmt(totPrem, 2)} USDC</span>
        </SummaryRow>
        <Divider />
        <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 5, fontWeight: 700 }}>보험료 정산 (건당 실시간)</div>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>리더사 수취</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{fmt(acc.lP, 4)} USDC</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>참여사 A 수취</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{fmt(acc.aP, 4)} USDC</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>참여사 B 수취</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{fmt(acc.bP, 4)} USDC</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>재보험사 순수취</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{fmt(acc.rP, 4)} USDC</span>
        </SummaryRow>
      </CardBody>
    </Card>
  );
}
