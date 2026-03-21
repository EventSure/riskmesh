import { useState, useMemo } from 'react';
import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, FormSelect, Divider, Tag, TierItem } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';
import { useResolveFlightDelay } from '@/hooks/useResolveFlightDelay';
import { useProgram } from '@/hooks/useProgram';
import { useSettleFlight } from '@/hooks/useSettleFlight';
import { useMasterPolicyAccount } from '@/hooks/useMasterPolicyAccount';
import { getFlightPolicyPDA } from '@/lib/pda';
import { TrackBPanel } from './TrackBPanel';

/* ── Types ── */

type OracleControlMode = 'manual' | 'trackA' | 'trackB';

/* ── Segmented Control ── */

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

/* ── Daemon badge ── */

const DaemonBadge = styled.div<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
  border: 1px solid ${p => p.active ? 'var(--success)' : 'var(--warning, #F59E0B)'};
  background: ${p => p.active ? 'rgba(34,197,94,.06)' : 'rgba(245,158,11,.06)'};
  color: ${p => p.active ? 'var(--success)' : 'var(--warning, #F59E0B)'};
`;

const DaemonDot = styled.span<{ active: boolean }>`
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: ${p => p.active ? 'var(--success)' : 'var(--warning, #F59E0B)'};
  box-shadow: ${p => p.active ? '0 0 6px rgba(34,197,94,0.6)' : 'none'};
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

const MiniTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    padding: 4px 8px;
    text-align: left;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${p => p.theme.colors.sub};
    border-bottom: 1px solid ${p => p.theme.colors.border};
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
    background: ${p => p.theme.colors.surface1};
  }

  td {
    padding: 5px 8px;
    border-bottom: 1px solid ${p => p.theme.colors.border};
    font-size: 11px;
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: ${p => p.theme.colors.surface2}; }
`;

const MiniMono = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
`;

const MiniStatusBadge = styled.span<{ clr: string }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: 'DM Mono', monospace;
  background: ${p => p.clr}1a;
  color: ${p => p.clr};
  border: 1px solid ${p => p.clr}44;
`;

const SettleBtn = styled.button`
  font-size: 10px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  border: 1px solid ${p => p.theme.colors.primary};
  background: rgba(153,69,255,0.08);
  color: ${p => p.theme.colors.primary};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover { background: rgba(153,69,255,0.18); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
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

/* ── Coming Soon placeholder ── */

const ComingSoonWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  text-align: center;
`;

const ComingSoonIcon = styled.div`
  font-size: 32px;
`;

const ComingSoonTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
`;

const ComingSoonSub = styled.div`
  font-size: 12px;
  color: ${p => p.theme.colors.sub};
  line-height: 1.5;
`;


/* ── OracleConsole ── */

export function OracleConsole() {
  const { t } = useTranslation();
  const {
    mode, contracts, claims, masterActive, masterPolicyPDA, payoutTiers,
    runOracle, onChainResolve, onChainSettle, lastDaemonActivityTs,
  } = useProtocolStore();
  const { toast } = useToast();
  const { resolveFlightDelay, loading } = useResolveFlightDelay();
  const { wallet } = useProgram();

  const masterPK = masterPolicyPDA ? new PublicKey(masterPolicyPDA) : null;
  const { account: masterAccount } = useMasterPolicyAccount(masterPK);
  const { settleFlightClaim, settleFlightNoClaim, buildSettleAccounts, loading: settleLoading } = useSettleFlight();
  const [settleLoadingId, setSettleLoadingId] = useState<number | null>(null);

  const handleSettleClaim = async (cid: number) => {
    if (!masterPK || !masterAccount) { toast(t('toast.walletNotAvailable'), 'd'); return; }
    setSettleLoadingId(cid);
    const [flightPDA] = getFlightPolicyPDA(masterPK, new BN(cid));
    const accs = buildSettleAccounts(masterAccount);
    const res = await settleFlightClaim({ masterPolicy: masterPK, flightPolicy: flightPDA, leaderDepositToken: accs.leaderDepositWallet, reinsurerPoolToken: accs.reinsurerPoolWallet, participantPoolWallets: accs.participantPoolWallets });
    setSettleLoadingId(null);
    if (!res.success) { toast(t('oracle.txFailedMsg', { error: res.error }), 'd'); }
    else { onChainSettle(cid, res.signature); toast(t('oracle.settleClaimBtn'), 's'); }
  };

  const handleSettleNoClaim = async (cid: number) => {
    if (!masterPK || !masterAccount) { toast(t('toast.walletNotAvailable'), 'd'); return; }
    setSettleLoadingId(cid);
    const [flightPDA] = getFlightPolicyPDA(masterPK, new BN(cid));
    const accs = buildSettleAccounts(masterAccount);
    const res = await settleFlightNoClaim({ masterPolicy: masterPK, flightPolicy: flightPDA, leaderDepositToken: accs.leaderDepositWallet, reinsurerDepositToken: accs.reinsurerDepositWallet, participantDepositWallets: accs.participantDepositWallets });
    setSettleLoadingId(null);
    if (!res.success) { toast(t('oracle.txFailedMsg', { error: res.error }), 'd'); }
    else { onChainSettle(cid, res.signature); toast(t('oracle.settleNoClaimBtn'), 's'); }
  };

  const [oracleMode, setOracleMode] = useState<OracleControlMode>('manual');
  const [contractId, setContractId] = useState<number>(0);
  const [resolveType, setResolveType] = useState<'delay' | 'noDelay'>('delay');
  const [delay, setDelay] = useState(130);
  const [fresh, setFresh] = useState(5);
  const [cancelled, setCancelled] = useState(false);
  const [result, setResult] = useState<{ type: 'error' | 'ok'; msg: string; code?: string } | null>(null);

  const daemonStatus = useMemo(() => {
    if (lastDaemonActivityTs == null) return { active: false, label: t('oracle.daemonNoData') };
    const nowSec = Math.floor(Date.now() / 1000);
    const diffMin = Math.floor((nowSec - lastDaemonActivityTs) / 60);
    if (diffMin > 30) return { active: false, label: t('oracle.daemonInactive') };
    return { active: true, label: t('oracle.daemonLastActive', { minutes: diffMin }) };
  }, [lastDaemonActivityTs, t]);

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
        <Tag variant="subtle">{mode === 'onchain' ? t('oracle.modeOnchain') : t('oracle.modeSwitchboard')}</Tag>
      </CardHeader>
      <CardBody>
        {/* Oracle control mode selector */}
        <SegmentWrap role="tablist" aria-label="Oracle control mode">
          <Segment
            role="tab"
            aria-selected={oracleMode === 'manual'}
            active={oracleMode === 'manual'}
            onClick={() => setOracleMode('manual')}
          >
            {t('oracle.tabManual')}
          </Segment>
          <Segment
            role="tab"
            aria-selected={oracleMode === 'trackA'}
            active={oracleMode === 'trackA'}
            onClick={() => setOracleMode('trackA')}
          >
            {t('oracle.tabTrackA')}
          </Segment>
          <Segment
            role="tab"
            aria-selected={oracleMode === 'trackB'}
            active={oracleMode === 'trackB'}
            onClick={() => setOracleMode('trackB')}
          >
            {t('oracle.tabTrackB')}
          </Segment>
        </SegmentWrap>

        {/* ── Manual ── */}
        {oracleMode === 'manual' && (
          <>
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
          </>
        )}

        {/* ── Track A ── */}
        {oracleMode === 'trackA' && (
          <>
            {mode === 'onchain' ? (
              <>
                <DaemonBadge active={daemonStatus.active}>
                  <DaemonDot active={daemonStatus.active} />
                  <span>
                    <strong>{t('oracle.daemonBadge')}</strong>
                    &nbsp;·&nbsp;
                    {daemonStatus.label}
                  </span>
                </DaemonBadge>
                <SectionLabel>{t('oracle.policyMonitor')}</SectionLabel>
                {contracts.length === 0 ? (
                  <ComingSoonSub style={{ textAlign: 'center', padding: '8px 0' }}>{t('oracle.noContracts')}</ComingSoonSub>
                ) : (
                  <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 220 }}>
                    <MiniTable>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t('oracle.th.flight')}</th>
                          <th>{t('oracle.th.status')}</th>
                          <th>{t('oracle.th.delay')}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {contracts.map(c => {
                          const clr = STATUS_COLORS[c.status] || '#94A3B8';
                          const icon = STATUS_ICONS[c.status] || '';
                          const claim = claims.find(cl => cl.contractId === c.id);
                          const isLoading = settleLoadingId === c.id && settleLoading;
                          return (
                            <tr key={c.id}>
                              <td><MiniMono style={{ color: 'var(--accent)', fontWeight: 700 }}>#{c.id}</MiniMono></td>
                              <td><MiniMono style={{ color: 'var(--accent)', fontWeight: 600 }}>{c.flight}</MiniMono></td>
                              <td><MiniStatusBadge clr={clr}>{icon} {c.status.toUpperCase()}</MiniStatusBadge></td>
                              <td>
                                <MiniMono style={{ color: claim?.delay ? 'var(--warning)' : 'var(--sub)' }}>
                                  {claim?.delay ? `${claim.delay}${t('common.min')}` : '—'}
                                </MiniMono>
                              </td>
                              <td>
                                {c.status === 'claimed' && (
                                  <SettleBtn onClick={() => handleSettleClaim(c.id)} disabled={isLoading}>
                                    {isLoading ? '…' : t('oracle.settleClaimBtn')}
                                  </SettleBtn>
                                )}
                                {c.status === 'noClaim' && (
                                  <SettleBtn onClick={() => handleSettleNoClaim(c.id)} disabled={isLoading}>
                                    {isLoading ? '…' : t('oracle.settleNoClaimBtn')}
                                  </SettleBtn>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </MiniTable>
                  </div>
                )}
              </>
            ) : (
              <ComingSoonWrap>
                <ComingSoonIcon>🤖</ComingSoonIcon>
                <ComingSoonTitle>{t('oracle.trackASimTitle')}</ComingSoonTitle>
                <ComingSoonSub style={{ whiteSpace: 'pre-line' }}>{t('oracle.trackASimDesc')}</ComingSoonSub>
              </ComingSoonWrap>
            )}
          </>
        )}

        {/* ── Track B ── */}
        {oracleMode === 'trackB' && <TrackBPanel />}
      </CardBody>
    </Card>
  );
}
