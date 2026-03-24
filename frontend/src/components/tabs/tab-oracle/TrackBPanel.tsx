import { useState, useMemo, Fragment } from 'react';
import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useTranslation } from 'react-i18next';
import { Button, Divider, FormGroup, FormLabel, FormInput, Tag, useToast } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useProgram } from '@/hooks/useProgram';
import { useCreatePolicy } from '@/hooks/useCreatePolicy';
import { useOpenUnderwriting } from '@/hooks/useOpenUnderwriting';
import { useActivatePolicy } from '@/hooks/useActivatePolicy';
import { useAcceptShare } from '@/hooks/useAcceptShare';
import { useRejectShare } from '@/hooks/useRejectShare';
import { useExpirePolicy } from '@/hooks/useExpirePolicy';
import { useRefundAfterExpiry } from '@/hooks/useRefundAfterExpiry';
import { useRegisterPolicyholder } from '@/hooks/useRegisterPolicyholder';
import { useTrackBSettle } from '@/hooks/useTrackBSettle';
import { useUnderwriting } from '@/hooks/useUnderwriting';
import { useCheckOracle } from '@/hooks/useCheckOracle';
import {
  PolicyState,
  UnderwritingStatus,
  ParticipantStatus,
  POLICY_STATE_LABELS,
  UNDERWRITING_STATUS_LABELS,
  PARTICIPANT_STATUS_LABELS,
} from '@/lib/idl/open_parametric';
import type { PolicyholderEntryInput } from '@/lib/idl/open_parametric';
import { CURRENCY_MINT } from '@/lib/constants';

/* ── Styled ── */

const Section = styled.div`
  margin-bottom: 16px;
`;

const SectionLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: ${p => p.theme.colors.sub};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  margin-top: 4px;
`;

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

const Mono = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
`;

const StatusBadge = styled.span<{ clr: string }>`
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

const ActionBtn = styled.button<{ variant?: 'primary' | 'danger' | 'default' }>`
  font-size: 10px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 5px;
  border: 1px solid ${p =>
    p.variant === 'danger' ? 'var(--danger)' :
    p.variant === 'primary' ? p.theme.colors.primary :
    p.theme.colors.border};
  background: ${p =>
    p.variant === 'danger' ? 'rgba(239,68,68,0.08)' :
    p.variant === 'primary' ? 'rgba(153,69,255,0.08)' :
    'transparent'};
  color: ${p =>
    p.variant === 'danger' ? 'var(--danger)' :
    p.variant === 'primary' ? p.theme.colors.primary :
    p.theme.colors.text};
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover { opacity: 0.8; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ExpandRow = styled.tr`
  td {
    padding: 8px 12px !important;
    background: ${p => p.theme.colors.surface2};
  }
`;

const ParticipantRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
  border-bottom: 1px solid ${p => p.theme.colors.border};
  &:last-child { border-bottom: none; }
`;

const FormRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-bottom: 8px;
`;

const SmallInput = styled(FormInput)`
  font-size: 11px;
  padding: 5px 8px;
  font-family: 'DM Mono', monospace;
  color-scheme: dark;
`;

const STATE_COLORS: Record<number, string> = {
  [PolicyState.Draft]: '#94A3B8',
  [PolicyState.Open]: '#F59E0B',
  [PolicyState.Funded]: '#38BDF8',
  [PolicyState.Active]: '#14F195',
  [PolicyState.Claimable]: '#9945FF',
  [PolicyState.Approved]: '#9945FF',
  [PolicyState.Settled]: '#22C55E',
  [PolicyState.Expired]: '#64748B',
};

/* ── Subcomponents ── */

function UWDetail({ policyPubkey }: { policyPubkey: PublicKey }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { wallet } = useProgram();
  const { account: uw, loading: uwLoading } = useUnderwriting(policyPubkey);
  const { acceptShare, loading: acceptLoading } = useAcceptShare();
  const { rejectShare, loading: rejectLoading } = useRejectShare();
  const [depositAmount, setDepositAmount] = useState('');

  if (uwLoading || !uw) return <Mono style={{ color: 'var(--sub)' }}>Loading...</Mono>;

  const walletKey = wallet?.publicKey?.toBase58();

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <SectionLabel style={{ margin: 0 }}>{t('oracle.trackBUWStatus')}</SectionLabel>
        <StatusBadge clr={uw.status === UnderwritingStatus.Finalized ? '#22C55E' : '#F59E0B'}>
          {UNDERWRITING_STATUS_LABELS[uw.status] || String(uw.status)}
        </StatusBadge>
      </div>
      <SectionLabel style={{ marginTop: 8 }}>{t('oracle.trackBParticipantList')}</SectionLabel>
      {uw.participants.map((p, i) => {
        const isMe = walletKey === p.insurer.toBase58();
        const isPending = p.status === ParticipantStatus.Pending;
        return (
          <ParticipantRow key={i}>
            <Mono style={{ flex: 1, color: isMe ? 'var(--accent)' : 'var(--sub)' }}>
              {p.insurer.toBase58().slice(0, 8)}… {isMe && '(me)'}
            </Mono>
            <Tag variant="subtle" style={{ fontSize: 9 }}>{p.ratioBps} bps</Tag>
            <StatusBadge clr={
              p.status === ParticipantStatus.Accepted ? '#22C55E' :
              p.status === ParticipantStatus.Rejected ? '#EF4444' : '#F59E0B'
            }>
              {PARTICIPANT_STATUS_LABELS[p.status] || String(p.status)}
            </StatusBadge>
            {isMe && isPending && uw.status === UnderwritingStatus.Open && (
              <>
                <SmallInput
                  type="number"
                  placeholder={t('oracle.trackBDepositAmount')}
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  style={{ width: 100 }}
                />
                <ActionBtn
                  variant="primary"
                  disabled={acceptLoading || !depositAmount}
                  onClick={async () => {
                    const res = await acceptShare(policyPubkey, i, new BN(depositAmount));
                    if (res.success) toast(t('oracle.trackBAcceptDone'), 's');
                    else toast(res.error || '', 'd');
                  }}
                >
                  {t('oracle.trackBAcceptShare')}
                </ActionBtn>
                <ActionBtn
                  variant="danger"
                  disabled={rejectLoading}
                  onClick={async () => {
                    const res = await rejectShare(policyPubkey, i);
                    if (res.success) toast(t('oracle.trackBRejectDone'), 's');
                    else toast(res.error || '', 'd');
                  }}
                >
                  {t('oracle.trackBRejectShare')}
                </ActionBtn>
              </>
            )}
          </ParticipantRow>
        );
      })}
    </div>
  );
}

/* ── Main Panel ── */

export function TrackBPanel() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { wallet } = useProgram();
  const { trackBPolicies, trackBClaims, lastDaemonActivityTs } = useProtocolStore();

  // Hooks
  const { createPolicy, loading: createLoading } = useCreatePolicy();
  const { openUnderwriting, loading: openUWLoading } = useOpenUnderwriting();
  const { activatePolicy, loading: activateLoading } = useActivatePolicy();
  const { expirePolicy, loading: expireLoading } = useExpirePolicy();
  const { refundAfterExpiry, loading: refundLoading } = useRefundAfterExpiry();
  const { registerPolicyholder, loading: registerLoading } = useRegisterPolicyholder();
  const { approveClaim, settleClaim, loading: settleLoading } = useTrackBSettle();
  const { checkOracle, loading: oracleCheckLoading } = useCheckOracle();

  // UI state
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create policy form state
  const [cpId, setCpId] = useState('1');
  const [cpRoute, setCpRoute] = useState('');
  const [cpFlightNo, setCpFlightNo] = useState('');
  const [cpDepDate, setCpDepDate] = useState('');
  const [cpPayout, setCpPayout] = useState('');
  const [cpOracleFeed, setCpOracleFeed] = useState('');
  const [cpActiveFrom, setCpActiveFrom] = useState('');
  const [cpActiveTo, setCpActiveTo] = useState('');
  const [cpReinsurer, setCpReinsurer] = useState('');
  const [cpCededBps, setCpCededBps] = useState('0');
  const [cpReinsBps, setCpReinsBps] = useState('0');
  const [cpMint, setCpMint] = useState(CURRENCY_MINT.toBase58());
  const [cpParticipants, setCpParticipants] = useState<{ insurer: string; ratioBps: string }[]>([
    { insurer: '', ratioBps: '10000' },
  ]);

  // Register policyholder form
  const [showRegister, setShowRegister] = useState<string | null>(null);
  const [regRef, setRegRef] = useState('');
  const [regPolicyId, setRegPolicyId] = useState('');
  const [regFlightNo, setRegFlightNo] = useState('');
  const [regDepDate, setRegDepDate] = useState('');
  const [regPassengers, setRegPassengers] = useState('1');
  const [regPremium, setRegPremium] = useState('');
  const [regCoverage, setRegCoverage] = useState('');

  // Oracle trigger form
  const [oraclePolicyKey, setOraclePolicyKey] = useState('');

  const daemonStatus = useMemo(() => {
    if (lastDaemonActivityTs == null) return { active: false, label: t('oracle.daemonNoData') };
    const nowSec = Math.floor(Date.now() / 1000);
    const diffMin = Math.floor((nowSec - lastDaemonActivityTs) / 60);
    if (diffMin > 30) return { active: false, label: t('oracle.daemonInactive') };
    return { active: true, label: t('oracle.daemonLastActive', { minutes: diffMin }) };
  }, [lastDaemonActivityTs, t]);

  const ratioSum = cpParticipants.reduce((s, p) => s + (parseInt(p.ratioBps) || 0), 0);

  const handleCreatePolicy = async () => {
    if (!wallet) return;
    try {
      const mint = new PublicKey(cpMint);
      const params = {
        policyId: new BN(cpId),
        route: cpRoute,
        flightNo: cpFlightNo,
        departureDate: new BN(Math.floor(new Date(cpDepDate).getTime() / 1000)),
        delayThresholdMin: 120,
        payoutAmount: new BN(cpPayout),
        oracleFeed: new PublicKey(cpOracleFeed),
        activeFrom: new BN(Math.floor(new Date(cpActiveFrom).getTime() / 1000)),
        activeTo: new BN(Math.floor(new Date(cpActiveTo).getTime() / 1000)),
        participants: cpParticipants.map(p => ({
          insurer: new PublicKey(p.insurer),
          ratioBps: parseInt(p.ratioBps),
        })),
      };
      const res = await createPolicy(params, mint);
      if (res.success) { toast(t('oracle.trackBCreated'), 's'); setShowCreateForm(false); }
      else toast(res.error || '', 'd');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'd');
    }
  };

  const handleRegisterPH = async (policyPK: string) => {
    try {
      const entry: PolicyholderEntryInput = {
        externalRef: regRef,
        policyId: new BN(regPolicyId),
        flightNo: regFlightNo,
        departureDate: new BN(Math.floor(new Date(regDepDate).getTime() / 1000)),
        passengerCount: parseInt(regPassengers),
        premiumPaid: new BN(regPremium),
        coverageAmount: new BN(regCoverage),
      };
      const res = await registerPolicyholder(new PublicKey(policyPK), entry);
      if (res.success) { toast(t('oracle.trackBRegisterPHDone'), 's'); setShowRegister(null); }
      else toast(res.error || '', 'd');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'd');
    }
  };

  return (
    <>
      {/* Daemon badge */}
      <DaemonBadge active={daemonStatus.active}>
        <DaemonDot active={daemonStatus.active} />
        <span>
          <strong>{t('oracle.trackBDaemonBadge')}</strong>
          &nbsp;·&nbsp;{daemonStatus.label}
        </span>
      </DaemonBadge>

      {/* Policy monitor table */}
      <SectionLabel>{t('oracle.trackBMonitor')}</SectionLabel>
      {trackBPolicies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--sub)' }}>
          {t('oracle.trackBNoPolicies')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 300 }}>
          <MiniTable>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('oracle.th.flight')}</th>
                <th>{t('oracle.th.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {trackBPolicies.map(p => {
                const pKey = p.publicKey.toBase58();
                const claim = trackBClaims.find(c => c.account.policy.toBase58() === pKey);
                const stateNum = p.account.state;
                const clr = STATE_COLORS[stateNum] || '#94A3B8';
                const stateLabel = POLICY_STATE_LABELS[stateNum] || String(stateNum);
                const isExpanded = expandedKey === pKey;
                const nowSec = Math.floor(Date.now() / 1000);
                const canExpire = stateNum === PolicyState.Active && p.account.activeTo.toNumber() < nowSec;

                return (
                  <Fragment key={pKey}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedKey(isExpanded ? null : pKey)}>
                      <td><Mono style={{ color: 'var(--accent)', fontWeight: 700 }}>#{p.account.policyId.toNumber()}</Mono></td>
                      <td><Mono style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.account.flightNo || pKey.slice(0, 8)}</Mono></td>
                      <td><StatusBadge clr={clr}>{stateLabel}</StatusBadge></td>
                      <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {/* Draft → Open UW */}
                        {stateNum === PolicyState.Draft && (
                          <ActionBtn variant="primary" disabled={openUWLoading}
                            onClick={async (e) => { e.stopPropagation(); setActionLoading(`uw-${pKey}`);
                              const res = await openUnderwriting(p.publicKey);
                              setActionLoading(null);
                              if (res.success) toast(t('oracle.trackBOpenUWDone'), 's');
                              else toast(res.error || '', 'd');
                            }}>
                            {actionLoading === `uw-${pKey}` ? '…' : t('oracle.trackBOpenUW')}
                          </ActionBtn>
                        )}
                        {/* Funded → Activate */}
                        {stateNum === PolicyState.Funded && (
                          <ActionBtn variant="primary" disabled={activateLoading}
                            onClick={async (e) => { e.stopPropagation(); setActionLoading(`act-${pKey}`);
                              const res = await activatePolicy(p.publicKey);
                              setActionLoading(null);
                              if (res.success) toast(t('oracle.trackBActivateDone'), 's');
                              else toast(res.error || '', 'd');
                            }}>
                            {actionLoading === `act-${pKey}` ? '…' : t('oracle.trackBActivate')}
                          </ActionBtn>
                        )}
                        {/* Active + expired time → Expire */}
                        {canExpire && (
                          <ActionBtn disabled={expireLoading}
                            onClick={async (e) => { e.stopPropagation(); setActionLoading(`exp-${pKey}`);
                              const res = await expirePolicy(p.publicKey);
                              setActionLoading(null);
                              if (res.success) toast(t('oracle.trackBExpireDone'), 's');
                              else toast(res.error || '', 'd');
                            }}>
                            {actionLoading === `exp-${pKey}` ? '…' : t('oracle.trackBExpire')}
                          </ActionBtn>
                        )}
                        {/* Claimable → Approve */}
                        {stateNum === PolicyState.Claimable && claim && (
                          <ActionBtn variant="primary" disabled={settleLoading}
                            onClick={async (e) => { e.stopPropagation(); setActionLoading(`apr-${pKey}`);
                              const res = await approveClaim(p.publicKey, claim.publicKey);
                              setActionLoading(null);
                              if (res.success) toast(t('oracle.trackBApproved'), 's');
                              else toast(res.error || '', 'd');
                            }}>
                            {actionLoading === `apr-${pKey}` ? '…' : t('oracle.trackBApproveBtn')}
                          </ActionBtn>
                        )}
                        {/* Approved → Settle */}
                        {stateNum === PolicyState.Approved && claim && (
                          <ActionBtn variant="primary" disabled={settleLoading}
                            onClick={async (e) => { e.stopPropagation(); setActionLoading(`stl-${pKey}`);
                              const res = await settleClaim(p.publicKey, claim.publicKey);
                              setActionLoading(null);
                              if (res.success) toast(t('oracle.trackBSettled'), 's');
                              else toast(res.error || '', 'd');
                            }}>
                            {actionLoading === `stl-${pKey}` ? '…' : t('oracle.trackBSettleBtn')}
                          </ActionBtn>
                        )}
                        {/* Expired → Refund */}
                        {stateNum === PolicyState.Expired && (
                          <ActionBtn disabled={refundLoading}
                            onClick={async (e) => { e.stopPropagation(); setActionLoading(`ref-${pKey}`);
                              const res = await refundAfterExpiry(p.publicKey, 0);
                              setActionLoading(null);
                              if (res.success) toast(t('oracle.trackBRefundDone'), 's');
                              else toast(res.error || '', 'd');
                            }}>
                            {actionLoading === `ref-${pKey}` ? '…' : t('oracle.trackBRefund')}
                          </ActionBtn>
                        )}
                        {/* Register PH */}
                        <ActionBtn onClick={(e) => { e.stopPropagation(); setShowRegister(showRegister === pKey ? null : pKey); }}>
                          {t('oracle.trackBRegisterPH')}
                        </ActionBtn>
                      </td>
                    </tr>
                    {/* Expanded: UW detail */}
                    {isExpanded && (
                      <ExpandRow key={`${pKey}-uw`}>
                        <td colSpan={4}>
                          <UWDetail policyPubkey={p.publicKey} />
                        </td>
                      </ExpandRow>
                    )}
                    {/* Register PH form */}
                    {showRegister === pKey && (
                      <ExpandRow key={`${pKey}-reg`}>
                        <td colSpan={4}>
                          <SectionLabel>{t('oracle.trackBRegisterPH')}</SectionLabel>
                          <FormRow>
                            <SmallInput placeholder={t('oracle.trackBExternalRef')} value={regRef} onChange={e => setRegRef(e.target.value)} style={{ flex: 1 }} />
                            <SmallInput placeholder={t('oracle.trackBPolicyId')} type="number" value={regPolicyId} onChange={e => setRegPolicyId(e.target.value)} style={{ width: 80 }} />
                          </FormRow>
                          <FormRow>
                            <SmallInput placeholder={t('oracle.trackBFlightNo')} value={regFlightNo} onChange={e => setRegFlightNo(e.target.value)} style={{ flex: 1 }} />
                            <SmallInput type="date" value={regDepDate} onChange={e => setRegDepDate(e.target.value)} style={{ flex: 1 }} />
                          </FormRow>
                          <FormRow>
                            <SmallInput placeholder={t('oracle.trackBPassengerCount')} type="number" value={regPassengers} onChange={e => setRegPassengers(e.target.value)} style={{ width: 80 }} />
                            <SmallInput placeholder={t('oracle.trackBPremiumPaid')} type="number" value={regPremium} onChange={e => setRegPremium(e.target.value)} style={{ flex: 1 }} />
                            <SmallInput placeholder={t('oracle.trackBCoverageAmount')} type="number" value={regCoverage} onChange={e => setRegCoverage(e.target.value)} style={{ flex: 1 }} />
                          </FormRow>
                          <ActionBtn variant="primary" disabled={registerLoading} onClick={() => handleRegisterPH(pKey)}>
                            {registerLoading ? '…' : t('oracle.trackBRegisterPH')}
                          </ActionBtn>
                        </td>
                      </ExpandRow>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </MiniTable>
        </div>
      )}

      <Divider />

      {/* Policy creation form */}
      <Section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>{t('oracle.trackBCreatePolicy')}</SectionLabel>
          <ActionBtn variant="primary" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? '−' : '+'}
          </ActionBtn>
        </div>
        {showCreateForm && (
          <div style={{ marginTop: 8 }}>
            <FormRow>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBPolicyId')}</FormLabel>
                <SmallInput type="number" value={cpId} onChange={e => setCpId(e.target.value)} />
              </FormGroup>
              <FormGroup style={{ flex: 2, marginBottom: 0 }}>
                <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBRoute')}</FormLabel>
                <SmallInput value={cpRoute} onChange={e => setCpRoute(e.target.value)} placeholder="ICN-NRT" />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBFlightNo')}</FormLabel>
                <SmallInput value={cpFlightNo} onChange={e => setCpFlightNo(e.target.value)} placeholder="KE001" />
              </FormGroup>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBPayoutAmount')}</FormLabel>
                <SmallInput type="number" value={cpPayout} onChange={e => setCpPayout(e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormRow>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBDepartureDate')}</FormLabel>
                <SmallInput type="date" value={cpDepDate} onChange={e => setCpDepDate(e.target.value)} />
              </FormGroup>
            </FormRow>
            <FormGroup>
              <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBActiveFrom')}</FormLabel>
              <SmallInput type="date" value={cpActiveFrom} onChange={e => setCpActiveFrom(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBActiveTo')}</FormLabel>
              <SmallInput type="date" value={cpActiveTo} onChange={e => setCpActiveTo(e.target.value)} />
            </FormGroup>
            <FormGroup>
              <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBOracleFeed')}</FormLabel>
              <SmallInput value={cpOracleFeed} onChange={e => setCpOracleFeed(e.target.value)} placeholder="Pubkey..." />
            </FormGroup>
            <FormGroup>
              <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBCurrencyMint')}</FormLabel>
              <SmallInput value={cpMint} onChange={e => setCpMint(e.target.value)} />
            </FormGroup>

            {/* Reinsurer */}
            <SectionLabel>{t('oracle.trackBReinsurer')}</SectionLabel>
            <FormGroup>
              <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBReinsurerAddr')}</FormLabel>
              <SmallInput value={cpReinsurer} onChange={e => setCpReinsurer(e.target.value)} placeholder="Pubkey..." />
            </FormGroup>
            <FormRow>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBCededBps')}</FormLabel>
                <SmallInput type="number" value={cpCededBps} onChange={e => setCpCededBps(e.target.value)} placeholder="0" />
              </FormGroup>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel style={{ fontSize: 10 }}>{t('oracle.trackBReinsBps')}</FormLabel>
                <SmallInput type="number" value={cpReinsBps} onChange={e => setCpReinsBps(e.target.value)} placeholder="0" />
              </FormGroup>
            </FormRow>

            {/* Participants */}
            <SectionLabel style={{ marginTop: 8 }}>{t('oracle.trackBParticipants')}</SectionLabel>
            {cpParticipants.map((p, i) => (
              <FormRow key={i}>
                <SmallInput
                  placeholder={t('oracle.trackBInsurer')}
                  value={p.insurer}
                  onChange={e => {
                    const val = e.target.value;
                    setCpParticipants(prev => prev.map((item, j) =>
                      j === i ? { insurer: val, ratioBps: item.ratioBps } : item,
                    ));
                  }}
                  style={{ flex: 3 }}
                />
                <SmallInput
                  type="number"
                  placeholder={t('oracle.trackBRatioBps')}
                  value={p.ratioBps}
                  onChange={e => {
                    const val = e.target.value;
                    setCpParticipants(prev => prev.map((item, j) =>
                      j === i ? { insurer: item.insurer, ratioBps: val } : item,
                    ));
                  }}
                  style={{ width: 80 }}
                />
                {cpParticipants.length > 1 && (
                  <ActionBtn variant="danger" onClick={() => setCpParticipants(cpParticipants.filter((_, j) => j !== i))}>
                    {t('oracle.trackBRemoveParticipant')}
                  </ActionBtn>
                )}
              </FormRow>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <ActionBtn onClick={() => setCpParticipants([...cpParticipants, { insurer: '', ratioBps: '' }])}>
                {t('oracle.trackBAddParticipant')}
              </ActionBtn>
              <Mono style={{ color: ratioSum === 10000 ? 'var(--success)' : 'var(--warning)' }}>
                {t('oracle.trackBRatioSum', { sum: ratioSum })}
              </Mono>
            </div>

            <Button
              variant="primary"
              fullWidth
              disabled={createLoading || ratioSum !== 10000 || !cpRoute || !cpFlightNo}
              onClick={handleCreatePolicy}
            >
              {createLoading ? '…' : t('oracle.trackBCreateBtn')}
            </Button>
          </div>
        )}
      </Section>

      <Divider />

      {/* Manual oracle trigger */}
      <Section>
        <SectionLabel>{t('oracle.trackBManualTrigger')}</SectionLabel>
        <FormRow>
          <FormGroup style={{ flex: 2, marginBottom: 0 }}>
            <FormLabel style={{ fontSize: 10 }}>Policy</FormLabel>
            <SmallInput
              as="select"
              value={oraclePolicyKey}
              onChange={e => setOraclePolicyKey(e.target.value)}
            >
              <option value="">—</option>
              {trackBPolicies
                .filter(p => p.account.state === PolicyState.Active)
                .map(p => (
                  <option key={p.publicKey.toBase58()} value={p.publicKey.toBase58()}>
                    #{p.account.policyId.toNumber()} {p.account.flightNo}
                  </option>
                ))}
            </SmallInput>
          </FormGroup>
        </FormRow>
        <ActionBtn
          variant="primary"
          disabled={!oraclePolicyKey || oracleCheckLoading}
          style={{ marginTop: 4 }}
          onClick={async () => {
            if (!oraclePolicyKey) return;
            try {
              const res = await checkOracle(new PublicKey(oraclePolicyKey));
              if (res.success) {
                toast(t('oracle.trackBOracleSuccess'), 's');
              } else {
                toast(t('oracle.trackBOracleFail', { error: res.error }), 'd');
              }
            } catch {
              toast(t('oracle.trackBOracleFail', { error: 'Switchboard SDK error' }), 'd');
            }
          }}
        >
          {oracleCheckLoading ? '…' : t('oracle.trackBCheckOracleBtn')}
        </ActionBtn>
        <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 4 }}>
          {t('oracle.trackBManualHint')}
        </div>
      </Section>
    </>
  );
}
