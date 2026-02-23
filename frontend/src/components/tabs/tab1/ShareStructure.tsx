import { Card, CardHeader, CardTitle, CardBody, FormGroup, FormLabel, FormInput, SummaryRow } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';

export function ShareStructure() {
  const { shares, setShares } = useProtocolStore();
  const total = shares.leader + shares.partA + shares.partB;
  const valid = total === 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle>책임 구조 (지분 세팅)</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 7 }}>
          원수사 50% : 재보험사 50% | 수수료 10%
        </div>
        <FormGroup>
          <FormLabel>리더사 지분 (원수사 내 %)</FormLabel>
          <FormInput
            type="number" min={1} max={100} value={shares.leader}
            onChange={e => setShares({ leader: parseInt(e.target.value) || 0 })}
            style={{ fontFamily: "'DM Mono', monospace" }}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>참여사 A 지분 (원수사 내 %)</FormLabel>
          <FormInput
            type="number" min={1} max={100} value={shares.partA}
            onChange={e => setShares({ partA: parseInt(e.target.value) || 0 })}
            style={{ fontFamily: "'DM Mono', monospace" }}
          />
        </FormGroup>
        <FormGroup>
          <FormLabel>참여사 B 지분 (원수사 내 %)</FormLabel>
          <FormInput
            type="number" min={1} max={100} value={shares.partB}
            onChange={e => setShares({ partB: parseInt(e.target.value) || 0 })}
            style={{ fontFamily: "'DM Mono', monospace" }}
          />
        </FormGroup>
        <div style={{ fontSize: 10, color: valid ? 'var(--success)' : 'var(--danger)', fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>
          합계: {total}% {valid ? '✓' : '❌'}
        </div>
        <SummaryRow><span style={{ fontSize: 10, color: 'var(--sub)' }}>재보험사 수수료율</span><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>10%</span></SummaryRow>
        <SummaryRow><span style={{ fontSize: 10, color: 'var(--sub)' }}>원수사→재보험사 출재율</span><span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>각 지분의 50%</span></SummaryRow>
      </CardBody>
    </Card>
  );
}
