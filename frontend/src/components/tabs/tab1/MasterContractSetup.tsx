import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';

export function MasterContractSetup() {
  const { masterActive, cStep, setTerms } = useProtocolStore();
  const { toast } = useToast();

  const handleSetTerms = () => {
    const result = setTerms();
    if (!result.ok) { toast(result.msg!, 'd'); return; }
    toast('약관 세팅 완료', 'i');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>마스터 계약 설정</CardTitle>
        <Tag variant={masterActive ? 'accent' : 'subtle'}>{masterActive ? '활성' : '미체결'}</Tag>
      </CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>담보 기간 시작</FormLabel>
          <FormInput defaultValue="2026-01-01" />
        </FormGroup>
        <FormGroup>
          <FormLabel>담보 기간 종료</FormLabel>
          <FormInput defaultValue="2026-12-31" />
        </FormGroup>
        <FormGroup>
          <FormLabel>담보 항목</FormLabel>
          <FormInput value="항공기 출발 지연 보험" readOnly style={{ opacity: 0.6 }} />
        </FormGroup>
        <FormGroup>
          <FormLabel>건당 보험료 (USDC)</FormLabel>
          <FormInput type="number" defaultValue={1} min={1} style={{ fontFamily: "'DM Mono', monospace" }} />
        </FormGroup>
        <Divider />
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 6 }}>
          지연 구간별 보험금
        </div>
        <TierItem label="2h~2h59m" value="40 USDC" color="#F59E0B" />
        <TierItem label="3h~3h59m" value="60 USDC" color="#f97316" />
        <TierItem label="4h~5h59m" value="80 USDC" color="#EF4444" />
        <TierItem label="6h+ / 결항" value="100 USDC" color="#fca5a5" />
        <Divider />
        <Button variant="primary" fullWidth onClick={handleSetTerms} disabled={cStep >= 1}>
          📄 약관 세팅 &amp; 요율 산정
        </Button>
      </CardBody>
    </Card>
  );
}
