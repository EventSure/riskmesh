import { Card, CardHeader, CardTitle, CardBody, Button, SummaryRow, Divider } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';

export function ClaimApproval() {
  const { role, claims, approveClaims, settleClaims } = useProtocolStore();
  const { toast } = useToast();

  const pendCnt = claims.filter(c => c.status === 'claimable').length;
  const appCnt = claims.filter(c => c.status === 'approved').length;
  const setlCnt = claims.filter(c => c.status === 'settled').length;
  const canAct = role === 'leader' || role === 'operator';

  const handleApprove = () => {
    const n = approveClaims();
    if (n === 0) { toast('승인할 클레임 없음', 'w'); return; }
    toast(`${n}건 승인 완료`, 's');
  };

  const handleSettle = () => {
    const n = settleClaims();
    if (n === 0) { toast('정산할 클레임 없음', 'w'); return; }
    toast(`${n}건 정산 완료!`, 's');
  };

  return (
    <Card>
      <CardHeader><CardTitle>클레임 승인 &amp; 정산</CardTitle></CardHeader>
      <CardBody>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>클레임 대기</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{pendCnt}건</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>승인 완료</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{appCnt}건</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>정산 완료</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{setlCnt}건</span>
        </SummaryRow>
        <Divider />
        <Button variant="warning" fullWidth onClick={handleApprove} disabled={!canAct || pendCnt === 0} style={{ marginBottom: 6 }}>
          ✅ approve_claim (전체)
        </Button>
        <Button variant="accent" fullWidth onClick={handleSettle} disabled={!canAct || appCnt === 0}>
          💸 settle_claim (전체)
        </Button>
      </CardBody>
    </Card>
  );
}
