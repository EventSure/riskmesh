import { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, FormSelect, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useResolveFlightDelay } from '@/hooks/useResolveFlightDelay';
import { useSettleFlight } from '@/hooks/useSettleFlight';
import { useProgram } from '@/hooks/useProgram';
import { getFlightPolicyPDA } from '@/lib/pda';

/* ── Styled Components ── */

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

const SectionLabel = styled.div`
  font-size: 9px;
  font-weight: 600;
  color: var(--sub);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  margin-top: 4px;
`;

const DaemonBadge = styled.div<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 500;
  margin-bottom: 8px;
  border: 1px solid ${p => p.active ? 'var(--success)' : 'var(--warning, #F59E0B)'};
  background: ${p => p.active ? 'rgba(34,197,94,.06)' : 'rgba(245,158,11,.06)'};
  color: ${p => p.active ? 'var(--success)' : 'var(--warning, #F59E0B)'};
`;

const DaemonDot = styled.span<{ active: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${p => p.active ? 'var(--success)' : 'var(--warning, #F59E0B)'};
`;

/* ── PolicyStatusRow: generic, reusable for Track B ── */

export interface PolicyStatusRowProps {
  id: number;
  name: string;
  status: string;
  delay?: number;
  payout?: number;
  onSettle?: () => void;
  settleLabel?: string;
  settleLoading?: boolean;
}

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  &:last-child { border-bottom: none; }
`;

const StatusInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
`;

const StatusId = styled.span`
  font-family: 'DM Mono', monospace;
  font-weight: 600;
  color: var(--accent);
  font-size: 9px;
`;

const StatusName = styled.span`
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const STATUS_COLORS: Record<string, string> = {
  active: '#14F195',
  claimed: '#9945FF',
  noClaim: '#94A3B8',
  expired: '#64748B',
};

const STATUS_ICONS: Record<string, string> = {
  active: '⏳',
  claimed: '✅',
  noClaim: '──',
  expired: '⏰',
};

const SettleBtn = styled.button`
  font-size: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  white-space: nowrap;
  &:hover { background: rgba(153,69,255,0.1); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

export function PolicyStatusRow({ id, name, status, delay, onSettle, settleLabel, settleLoading }: PolicyStatusRowProps) {
  return (
    <StatusRow>
      <StatusInfo>
        <StatusId>#{id}</StatusId>
        <StatusName>{name}</StatusName>
        <Tag variant="subtle" style={{ fontSize: 8, color: STATUS_COLORS[status] || 'var(--sub)' }}>
          {STATUS_ICONS[status] || ''} {status}
          {delay != null && delay > 0 ? ` (${delay}min)` : ''}
        </Tag>
      </StatusInfo>
      {onSettle && (
        <SettleBtn onClick={onSettle} disabled={settleLoading}>
          {settleLabel || 'Settle'}
        </SettleBtn>
      )}
    </StatusRow>
  );
}

/* ── OracleConsole ── */

export function OracleConsole() {
  const { t } = useTranslation();
  const {
    mode, contracts, claims, masterActive, masterPolicyPDA, payoutTiers,
    runOracle, onChainResolve, onChainSettle, lastDaemonActivityTs,
  } = useProtocolStore();
  const { toast } = useToast();
  const { resolveFlightDelay, loading } = useResolveFlightDelay();
  const { settleFlightClaim, settleFlightNoClaim, buildSettleAccounts, loading: settleLoading } = useSettleFlight();
  const { wallet, program } = useProgram();
  const [contractId, setContractId] = useState<number>(0);
  const [delay, setDelay] = useState(130);
  const [fresh, setFresh] = useState(5);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<{ type: 'error' | 'ok'; msg: string; code?: string } | null>(null);

  // Daemon activity badge
  const daemonStatus = useMemo(() => {
    if (lastDaemonActivityTs == null) return { active: false, label: t('oracle.daemonNoData') };
    const nowSec = Math.floor(Date.now() / 1000);
    const diffMin = Math.floor((nowSec - lastDaemonActivityTs) / 60);
    if (diffMin > 30) return { active: false, label: t('oracle.daemonInactive') };
    return { active: true, label: t('oracle.daemonLastActive', { minutes: diffMin }) };
  }, [lastDaemonActivityTs, t]);

  // Contracts with settle-eligible statuses for the monitor
  const monitorContracts = useMemo(() => {
    return contracts.map(c => {
      const claim = claims.find(cl => cl.contractId === c.id);
      return { ...c, delay: claim?.delay, payout: claim?.payout };
    });
  }, [contracts, claims]);

  const handleRun = async () => {
    if (contractId === 0) { toast(t('toast.selectContract'), 'w'); return; }
    setResult(null);

    if (mode === 'simulation') {
      const res = runOracle(contractId, delay, fresh, cancelled);
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
      toast(t('toast.walletNotAvailable'), 'd');
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
      setResult({ type: 'error', msg: txResult.error || t('oracle.txFailed'), code: 'TX_FAILED' });
      toast(t('oracle.txFailedMsg', { error: txResult.error }), 'd');
      return;
    }

    onChainResolve(contractId, delay, cancelled, txResult.signature);
    setContractId(0);
    setResult({ type: 'ok', msg: t('oracle.resolvedOnChain', { tx: txResult.signature.slice(0, 16) }) });
    toast(t('oracle.resolvedSuccess'), 's');
  };

  const handleSettleClaim = async (cId: number) => {
    if (!masterPolicyPDA || !wallet || !program) {
      toast(t('toast.walletNotAvailable'), 'd');
      return;
    }
    const masterPK = new PublicKey(masterPolicyPDA);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masterData = await (program as any).account.masterPolicy.fetch(masterPK);
    const { participantPoolWallets, reinsurerPoolWallet, leaderDepositWallet } = buildSettleAccounts(masterData);
    const [flightPolicyPDA] = getFlightPolicyPDA(masterPK, new BN(cId));

    const res = await settleFlightClaim({
      masterPolicy: masterPK,
      flightPolicy: flightPolicyPDA,
      leaderDepositToken: leaderDepositWallet,
      reinsurerPoolToken: reinsurerPoolWallet,
      participantPoolWallets,
    });

    if (res.success) {
      onChainSettle(cId, res.signature);
      toast(t('oracle.settleClaimBtn') + ' OK', 's');
    } else {
      toast(res.error || 'Settle failed', 'd');
    }
  };

  const handleSettleNoClaim = async (cId: number) => {
    if (!masterPolicyPDA || !wallet || !program) {
      toast(t('toast.walletNotAvailable'), 'd');
      return;
    }
    const masterPK = new PublicKey(masterPolicyPDA);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const masterData = await (program as any).account.masterPolicy.fetch(masterPK);
    const accts = buildSettleAccounts(masterData);
    const [flightPolicyPDA] = getFlightPolicyPDA(masterPK, new BN(cId));

    const res = await settleFlightNoClaim({
      masterPolicy: masterPK,
      flightPolicy: flightPolicyPDA,
      leaderDepositToken: accts.leaderDepositWallet,
      reinsurerDepositToken: accts.reinsurerDepositWallet,
      participantDepositWallets: accts.participantDepositWallets,
    });

    if (res.success) {
      onChainSettle(cId, res.signature);
      toast(t('oracle.settleNoClaimBtn') + ' OK', 's');
    } else {
      toast(res.error || 'Settle failed', 'd');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('oracle.title')}</CardTitle>
        <Tag variant="subtle">{mode === 'onchain' ? t('oracle.modeOnchain') : t('oracle.modeSwitchboard')}</Tag>
      </CardHeader>
      <CardBody>
        {/* Daemon activity badge + Policy monitor (onchain mode only) */}
        {mode === 'onchain' && masterActive && (
          <>
            <DaemonBadge active={daemonStatus.active}>
              <DaemonDot active={daemonStatus.active} />
              {t('oracle.daemonBadge')}: {daemonStatus.label}
            </DaemonBadge>

            {monitorContracts.length > 0 && (
              <>
                <SectionLabel>{t('oracle.policyMonitor')}</SectionLabel>
                {monitorContracts.map(c => (
                  <PolicyStatusRow
                    key={c.id}
                    id={c.id}
                    name={`${c.flight} (${c.date})`}
                    status={c.status}
                    delay={c.delay}
                    payout={c.payout}
                    onSettle={
                      c.status === 'claimed'
                        ? () => handleSettleClaim(c.id)
                        : c.status === 'noClaim'
                          ? () => handleSettleNoClaim(c.id)
                          : undefined
                    }
                    settleLabel={
                      c.status === 'claimed' ? t('oracle.settleClaimBtn')
                        : c.status === 'noClaim' ? t('oracle.settleNoClaimBtn')
                          : undefined
                    }
                    settleLoading={settleLoading}
                  />
                ))}
                <Divider />
              </>
            )}
          </>
        )}

        {/* Manual Resolve form (always visible) */}
        {mode === 'onchain' && (
          <SectionLabel>{t('oracle.manualResolve')}</SectionLabel>
        )}
        <FormGroup>
          <FormLabel>{t('oracle.targetContract')}</FormLabel>
          <FormSelect value={contractId} onChange={e => setContractId(parseInt(e.target.value) || 0)} style={{ cursor: 'pointer' }} data-guide="select-contract">
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
        <FormGroup>
          <FormLabel>{t('oracle.cancelledLabel')}</FormLabel>
          <FormSelect value={cancelled ? 'true' : 'false'} onChange={e => setCancelled(e.target.value === 'true')} style={{ cursor: 'pointer' }}>
            <option value="false">{t('oracle.cancelledNo')}</option>
            <option value="true">{t('oracle.cancelledYes')}</option>
          </FormSelect>
        </FormGroup>
        {mode === 'simulation' && (
          <FormGroup>
            <FormLabel>{t('oracle.freshnessLabel')}</FormLabel>
            <FormInput type="number" min={0} value={fresh} onChange={e => setFresh(parseInt(e.target.value) || 0)} style={{ fontFamily: "'DM Mono', monospace" }} />
          </FormGroup>
        )}
        <Divider />
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
        <Button variant="primary" fullWidth onClick={handleRun} disabled={!masterActive || contractId === 0 || loading} data-guide="resolve-btn">
          {loading ? t('oracle.sendingTx') : mode === 'onchain' ? t('oracle.runBtnOnchain') : t('oracle.runBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}
