import { useState } from 'react';
import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, FormSelect, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useResolveFlightDelay } from '@/hooks/useResolveFlightDelay';
import { useProgram } from '@/hooks/useProgram';
import { getFlightPolicyPDA } from '@/lib/pda';

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
  const { t } = useTranslation();
  const { mode, contracts, masterActive, masterPolicyPDA, runOracle, onChainResolve } = useProtocolStore();
  const { toast } = useToast();
  const { resolveFlightDelay, loading } = useResolveFlightDelay();
  const { wallet } = useProgram();
  const [contractId, setContractId] = useState<number>(0);
  const [delay, setDelay] = useState(130);
  const [fresh, setFresh] = useState(5);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<{ type: 'error' | 'ok'; msg: string; code?: string } | null>(null);

  const handleRun = async () => {
    if (contractId === 0) { toast(t('toast.selectContract'), 'w'); return; }
    setResult(null);

    if (mode === 'simulation') {
      const res = runOracle(contractId, delay, fresh);
      if (res.type === 'error') {
        setResult({ type: 'error', msg: res.msg, code: res.code });
        toast(res.code || 'Error', 'd');
      } else if (res.type === 'ok') {
        const hasClaim = res.msg.includes('USDC');
        setResult({ type: 'ok', msg: res.msg });
        toast(hasClaim ? t('toast.claimCreated') : t('toast.noTrigger'), hasClaim ? 'w' : 's');
      }
      return;
    }

    // On-chain mode
    if (!masterPolicyPDA || !wallet) {
      toast('Wallet or master policy not available', 'd');
      return;
    }

    const masterPK = new PublicKey(masterPolicyPDA);
    const [flightPolicyPDA] = getFlightPolicyPDA(masterPK, new BN(contractId));

    const txResult = await resolveFlightDelay({
      masterPolicy: masterPK,
      flightPolicy: flightPolicyPDA,
      delayMinutes: delay,
      cancelled,
    });

    if (!txResult.success) {
      setResult({ type: 'error', msg: txResult.error || 'TX failed', code: 'TX_FAILED' });
      toast(`TX failed: ${txResult.error}`, 'd');
      return;
    }

    onChainResolve(contractId, delay, txResult.signature);
    setContractId(0);
    setResult({ type: 'ok', msg: `Resolved on-chain. TX: ${txResult.signature.slice(0, 16)}...` });
    toast('Flight delay resolved on-chain!', 's');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('oracle.title')}</CardTitle>
        <Tag variant="subtle">{mode === 'onchain' ? 'On-chain' : 'Switchboard'}</Tag>
      </CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>{t('oracle.targetContract')}</FormLabel>
          <FormSelect value={contractId} onChange={e => setContractId(parseInt(e.target.value) || 0)} style={{ cursor: 'pointer' }}>
            <option value={0}>{t('oracle.selectContract')}</option>
            {contracts.filter(c => c.status === 'active').map(c => (
              <option key={c.id} value={c.id}>#{c.id} {c.name} — {c.flight} ({c.date})</option>
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('oracle.delayLabel')}</FormLabel>
          <FormInput type="number" step={10} min={0} value={delay} onChange={e => setDelay(parseInt(e.target.value) || 0)} style={{ fontFamily: "'DM Mono', monospace" }} />
        </FormGroup>
        {mode === 'onchain' && (
          <FormGroup>
            <FormLabel>Cancelled?</FormLabel>
            <FormSelect value={cancelled ? 'true' : 'false'} onChange={e => setCancelled(e.target.value === 'true')} style={{ cursor: 'pointer' }}>
              <option value="false">No</option>
              <option value="true">Yes (Flight cancelled)</option>
            </FormSelect>
          </FormGroup>
        )}
        {mode === 'simulation' && (
          <FormGroup>
            <FormLabel>{t('oracle.freshnessLabel')}</FormLabel>
            <FormInput type="number" min={0} value={fresh} onChange={e => setFresh(parseInt(e.target.value) || 0)} style={{ fontFamily: "'DM Mono', monospace" }} />
          </FormGroup>
        )}
        <Divider />
        <TierItem label={t('oracle.tier120')} value="→ 40 USDC" color="#F59E0B" />
        <TierItem label={t('oracle.tier180')} value="→ 60 USDC" color="#f97316" />
        <TierItem label={t('oracle.tier240')} value="→ 80 USDC" color="#EF4444" />
        <TierItem label={t('oracle.tier360')} value="→ 100 USDC" color="#fca5a5" />
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
        <Button variant="primary" fullWidth onClick={handleRun} disabled={!masterActive || contractId === 0 || loading}>
          {loading ? 'Sending TX...' : mode === 'onchain' ? 'resolve_flight_delay' : '🔮 check_oracle_and_create_claim'}
        </Button>
      </CardBody>
    </Card>
  );
}
