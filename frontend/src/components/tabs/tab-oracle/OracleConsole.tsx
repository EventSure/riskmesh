import { useState } from 'react';
import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, FormSelect, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';

const MsgBox = styled.div<{ variant: 'error' | 'ok' }>`
  padding: 8px 10px;
  border-radius: 7px;
  margin-bottom: 9px;
  ${p => p.variant === 'error' && `border:1px solid var(--danger);background:rgba(239,68,68,.07);`}
  ${p => p.variant === 'ok' && `border:1px solid var(--success);background:rgba(34,197,94,.07);`}
`;

const MsgCode = styled.div`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  color: var(--danger);
`;

const MsgText = styled.div<{ variant: 'error' | 'ok' }>`
  font-size: ${p => p.variant === 'error' ? '9px' : '10px'};
  color: ${p => p.variant === 'error' ? 'var(--sub)' : 'var(--success)'};
  font-weight: ${p => p.variant === 'ok' ? 700 : 400};
`;

export function OracleConsole() {
  const { contracts, masterActive, runOracle } = useProtocolStore();
  const { toast } = useToast();
  const [contractId, setContractId] = useState<number>(0);
  const [delay, setDelay] = useState(130);
  const [fresh, setFresh] = useState(5);
  const [result, setResult] = useState<{ type: 'error' | 'ok'; msg: string; code?: string } | null>(null);

  const handleRun = () => {
    if (contractId === 0) { toast('계약을 선택하세요', 'w'); return; }
    setResult(null);
    const res = runOracle(contractId, delay, fresh);
    if (res.type === 'error') {
      setResult({ type: 'error', msg: res.msg, code: res.code });
      toast(res.code || 'Error', 'd');
    } else if (res.type === 'ok') {
      setResult({ type: 'ok', msg: res.msg });
      toast(res.msg.includes('트리거') ? `클레임 생성!` : '트리거 미해당', res.msg.includes('트리거') ? 'w' : 's');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>오라클 콘솔</CardTitle>
        <Tag variant="subtle">Switchboard</Tag>
      </CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>대상 계약</FormLabel>
          <FormSelect value={contractId} onChange={e => setContractId(parseInt(e.target.value) || 0)} style={{ cursor: 'pointer' }}>
            <option value={0}>-- 계약 선택 --</option>
            {contracts.filter(c => c.status === 'active').map(c => (
              <option key={c.id} value={c.id}>#{c.id} {c.name} — {c.flight} ({c.date})</option>
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup>
          <FormLabel>실제 지연 (분) — 0 이상, 10의 배수</FormLabel>
          <FormInput type="number" step={10} min={0} value={delay} onChange={e => setDelay(parseInt(e.target.value) || 0)} style={{ fontFamily: "'DM Mono', monospace" }} />
        </FormGroup>
        <FormGroup>
          <FormLabel>데이터 경과 시간 (분 전)</FormLabel>
          <FormInput type="number" min={0} value={fresh} onChange={e => setFresh(parseInt(e.target.value) || 0)} style={{ fontFamily: "'DM Mono', monospace" }} />
        </FormGroup>
        <Divider />
        <TierItem label="120~179분" value="→ 40 USDC" color="#F59E0B" />
        <TierItem label="180~239분" value="→ 60 USDC" color="#f97316" />
        <TierItem label="240~359분" value="→ 80 USDC" color="#EF4444" />
        <TierItem label="360분+ / 결항" value="→ 100 USDC" color="#fca5a5" />
        <Divider />
        {result?.type === 'error' && (
          <MsgBox variant="error">
            <MsgCode>{result.code}</MsgCode>
            <MsgText variant="error">{result.msg}</MsgText>
          </MsgBox>
        )}
        {result?.type === 'ok' && (
          <MsgBox variant="ok">
            <MsgText variant="ok">{result.msg}</MsgText>
          </MsgBox>
        )}
        <Button variant="primary" fullWidth onClick={handleRun} disabled={!masterActive || contractId === 0}>
          🔮 check_oracle_and_create_claim
        </Button>
      </CardBody>
    </Card>
  );
}
