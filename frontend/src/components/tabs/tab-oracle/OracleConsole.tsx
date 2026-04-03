import { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, FormSelect, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useResolveFlightDelay } from '@/hooks/useResolveFlightDelay';
import { useProgram } from '@/hooks/useProgram';
import { getFlightPolicyPDA } from '@/lib/pda';

/* ── Segmented Control (resolve type) ── */

const SegmentWrap = styled.div`
  display: flex;
  background: ${p => p.theme.colors.surface2};
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
  margin-bottom: 18px;
`;

const Segment = styled.button<{ active?: boolean }>`
  flex: 1;
  padding: 7px 6px;
  font-size: 11px;
  font-weight: 700;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
  background: ${p => p.active ? p.theme.colors.surface1 : 'transparent'};
  color: ${p => p.active ? p.theme.colors.text : p.theme.colors.sub};
  box-shadow: ${p => p.active ? '0 1px 4px rgba(0,0,0,0.3)' : 'none'};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.colors.primary};
    outline-offset: 1px;
  }
`;

/* ── Result message ── */

const MsgBox = styled.div<{ variant: 'error' | 'ok' }>`
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  ${p => p.variant === 'error' && `border:1px solid var(--danger);background:rgba(239,68,68,.07);`}
  ${p => p.variant === 'ok' && `border:1px solid var(--success);background:rgba(34,197,94,.07);`}
`;

const MsgCode = styled.div`
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--danger);
  margin-bottom: 3px;
`;

const MsgText = styled.div<{ variant: 'error' | 'ok' }>`
  font-size: 11px;
  color: ${p => p.variant === 'error' ? 'var(--sub)' : 'var(--success)'};
  font-weight: ${p => p.variant === 'ok' ? 700 : 400};
`;


/* ── Policy monitor ── */

const SectionLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: ${p => p.theme.colors.sub};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  margin-top: 4px;
`;

/* ── Info note ── */

const InfoNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
  border: 1px solid rgba(99,179,237,0.3);
  background: rgba(99,179,237,0.06);
  color: ${p => p.theme.colors.sub};
`;

const InfoDot = styled.span`
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(99,179,237,0.6);
`;

/* ── OracleConsole ── */

export function OracleConsole() {
  const { t } = useTranslation();
  const {
    mode, contracts, masterActive, masterPolicyPDA, payoutTiers,
    runOracle, onChainResolve, lastDaemonActivityTs,
  } = useProtocolStore();
  const { toast } = useToast();
  const { resolveFlightDelay, loading } = useResolveFlightDelay();
  const { wallet } = useProgram();

  const [contractId, setContractId] = useState<number>(0);
  const [resolveType, setResolveType] = useState<'delay' | 'noDelay'>('delay');
  const [delay, setDelay] = useState(130);
  const [fresh, setFresh] = useState(5);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<{ type: 'error' | 'ok'; msg: string; code?: string } | null>(null);

  const SCHEDULER_INTERVAL_MIN = 15;
  const nextRunLabel = useMemo(() => {
    if (lastDaemonActivityTs == null) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const minsLeft = Math.ceil((lastDaemonActivityTs + SCHEDULER_INTERVAL_MIN * 60 - nowSec) / 60);
    return minsLeft > 0 ? `(${minsLeft}분 후)` : '(잠시 후)';
  }, [lastDaemonActivityTs]);

  const handleRun = async () => {
    if (contractId === 0) { toast(t('toast.selectContract'), 'w'); return; }
    setResult(null);

    const resolvedDelay = resolveType === 'noDelay' ? 0 : delay;
    const resolvedCancelled = resolveType === 'noDelay' ? false : cancelled;

    if (mode === 'simulation') {
      const res = runOracle(contractId, resolvedDelay, fresh, resolvedCancelled);
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

    if (!masterPolicyPDA || !wallet) { toast(t('toast.walletNotAvailable'), 'd'); return; }
    const masterPK = new PublicKey(masterPolicyPDA);
    const [flightPolicyPDA] = getFlightPolicyPDA(masterPK, new BN(contractId));
    const txResult = await resolveFlightDelay({ masterPolicy: masterPK, flightPolicy: flightPolicyPDA, delayMinutes: resolvedDelay, cancelled: resolvedCancelled });
    if (!txResult.success) {
      setResult({ type: 'error', msg: txResult.error || t('oracle.txFailed'), code: 'TX_FAILED' });
      toast(t('oracle.txFailedMsg', { error: txResult.error }), 'd');
      return;
    }
    onChainResolve(contractId, resolvedDelay, resolvedCancelled, txResult.signature);
    setContractId(0);
    setResult({ type: 'ok', msg: t('oracle.resolvedOnChain', { tx: txResult.signature.slice(0, 16) }) });
    toast(t('oracle.resolvedSuccess'), 's');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('oracle.title')}</CardTitle>
        <Tag variant="subtle">{t('oracle.tagManual')}</Tag>
      </CardHeader>
      <CardBody>
        <InfoNote>
          <InfoDot />
          <span>
            {t('oracle.manualNote')}
            {mode === 'onchain' && nextRunLabel && <> <span style={{ opacity: 0.6 }}>{nextRunLabel}</span></>}
          </span>
        </InfoNote>

        <FormGroup>
              <FormLabel>{t('oracle.targetContract')}</FormLabel>
              <FormSelect
                value={contractId}
                onChange={e => setContractId(parseInt(e.target.value) || 0)}
                style={{ cursor: 'pointer' }}
                data-guide="select-contract"
              >
                <option value={0}>{t('oracle.selectContract')}</option>
                {contracts.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>#{c.id} {c.name} — {c.flight} ({c.date})</option>
                ))}
              </FormSelect>
            </FormGroup>

            {/* 해소 유형 선택 */}
            <FormGroup>
              <FormLabel>{t('oracle.resolveType')}</FormLabel>
              <SegmentWrap role="tablist" aria-label="Resolve type" style={{ marginBottom: 0 }}>
                <Segment
                  role="tab"
                  aria-selected={resolveType === 'delay'}
                  active={resolveType === 'delay'}
                  onClick={() => setResolveType('delay')}
                >
                  {t('oracle.resolveDelay')}
                </Segment>
                <Segment
                  role="tab"
                  aria-selected={resolveType === 'noDelay'}
                  active={resolveType === 'noDelay'}
                  onClick={() => setResolveType('noDelay')}
                >
                  {t('oracle.resolveNoDelay')}
                </Segment>
              </SegmentWrap>
            </FormGroup>

            {resolveType === 'noDelay' ? (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.25)', marginBottom: 12, fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
                {t('oracle.noDelayDesc')}<br />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--success)' }}>{t('oracle.noDelayHint')}</span>
              </div>
            ) : (
              <>
                <FormGroup>
                  <FormLabel>{t('oracle.delayLabel')}</FormLabel>
                  <FormInput
                    type="number"
                    step={10}
                    min={0}
                    value={delay}
                    onChange={e => setDelay(parseInt(e.target.value) || 0)}
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  />
                </FormGroup>
                <FormGroup>
                  <FormLabel>{t('oracle.cancelledLabel')}</FormLabel>
                  <FormSelect
                    value={cancelled ? 'true' : 'false'}
                    onChange={e => setCancelled(e.target.value === 'true')}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="false">{t('oracle.cancelledNo')}</option>
                    <option value="true">{t('oracle.cancelledYes')}</option>
                  </FormSelect>
                </FormGroup>
              </>
            )}

            {mode === 'simulation' && (
              <FormGroup>
                <FormLabel>{t('oracle.freshnessLabel')}</FormLabel>
                <FormInput
                  type="number"
                  min={0}
                  value={fresh}
                  onChange={e => setFresh(parseInt(e.target.value) || 0)}
                  style={{ fontFamily: "'DM Mono', monospace" }}
                />
              </FormGroup>
            )}
            <Divider />
            <SectionLabel>{t('oracle.tierSection')}</SectionLabel>
            <TierItem label={t('oracle.tier120')} value={`→ ${payoutTiers.delay2h} USDC`} color="#F59E0B" />
            <TierItem label={t('oracle.tier180')} value={`→ ${payoutTiers.delay3h} USDC`} color="#f97316" />
            <TierItem label={t('oracle.tier240')} value={`→ ${payoutTiers.delay4to5h} USDC`} color="#EF4444" />
            <TierItem label={t('oracle.tier360')} value={`→ ${payoutTiers.delay6hOrCancelled} USDC`} color="#fca5a5" />
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
            <Button
              variant="primary"
              fullWidth
              onClick={handleRun}
              disabled={!masterActive || contractId === 0 || loading}
              data-guide="resolve-btn"
            >
              {loading
                ? t('oracle.sendingTx')
                : resolveType === 'noDelay'
                  ? (mode === 'onchain' ? t('oracle.runBtnNoDelayOnchain') : t('oracle.runBtnNoDelay'))
                  : (mode === 'onchain' ? t('oracle.runBtnOnchain') : t('oracle.runBtn'))}
            </Button>
      </CardBody>
    </Card>
  );
}
