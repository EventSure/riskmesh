import { useState } from 'react';
import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, useToast } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useSettleFlight } from '@/hooks/useSettleFlight';
import { useMasterAgreementAccount } from '@/hooks/useMasterAgreementAccount';
import { getFlightPolicyPDA } from '@/lib/pda';

/* ── Styles ── */

const MonTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    padding: 5px 10px;
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
    padding: 6px 10px;
    border-bottom: 1px solid ${p => p.theme.colors.border};
    font-size: 11px;
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: ${p => p.theme.colors.surface2}; }
`;

const StatusBadge = styled.span<{ clr: string }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
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

const Mono = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
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

const STATUS_COLOR: Record<string, string> = {
  active: '#14F195',
  claimed: '#F59E0B',
  paid: '#9945FF',
  noClaim: '#94A3B8',
  expired: '#64748B',
  settled: '#22C55E',
};

const STATUS_ICON: Record<string, string> = {
  active: '⏳',
  claimed: '⚠',
  paid: '✅',
  noClaim: '──',
  expired: '⏰',
  settled: '💸',
};

/* ── Component ── */

export function PolicyMonitorTable() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { contracts, claims, masterAgreementPDA, onChainSettle } = useProtocolStore();
  const masterPK = masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null;
  const { account: masterAccount } = useMasterAgreementAccount(masterPK);
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

  if (contracts.length === 0) return null;

  return (
    <Card style={{ marginBottom: 12 }}>
      <CardHeader>
        <CardTitle>{t('oracle.policyMonitor')}</CardTitle>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px',
          borderRadius: 10, background: 'rgba(20,241,149,.10)',
          color: 'var(--accent)', border: '1px solid rgba(20,241,149,.25)',
        }}>
          {t('common.count', { count: contracts.length })}
        </span>
      </CardHeader>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 196 }}>
        <MonTable>
          <thead>
            <tr>
              <th>#</th>
              <th>{t('oracle.th.flight')}</th>
              <th>{t('oracle.th.contract')}</th>
              <th>{t('oracle.th.date')}</th>
              <th>{t('oracle.th.status')}</th>
              <th>{t('oracle.th.delay')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...contracts].reverse().map(c => {
              const claim = claims.find(cl => cl.contractId === c.id);
              const clr = STATUS_COLOR[c.status] || '#94A3B8';
              const icon = STATUS_ICON[c.status] || '';
              const isLoading = settleLoadingId === c.id && settleLoading;
              return (
                <tr key={c.id}>
                  <td>
                    <Mono style={{ color: 'var(--accent)', fontWeight: 700 }}>#{c.id}</Mono>
                  </td>
                  <td>
                    <Mono style={{ color: 'var(--accent)', fontWeight: 600 }}>{c.flight}</Mono>
                  </td>
                  <td style={{ color: 'var(--text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </td>
                  <td>
                    <Mono style={{ color: 'var(--sub)' }}>{c.date}</Mono>
                  </td>
                  <td>
                    <StatusBadge clr={clr}>{icon} {t(`common.${c.status}`)}</StatusBadge>
                  </td>
                  <td>
                    <Mono style={{ color: claim?.delay ? 'var(--warning)' : 'var(--sub)' }}>
                      {claim?.delay ? `${claim.delay}${t('common.min')}` : '—'}
                    </Mono>
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
        </MonTable>
      </div>
    </Card>
  );
}
