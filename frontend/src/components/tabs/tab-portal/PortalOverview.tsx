import { useState } from 'react';
import styled from '@emotion/styled';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Mono, Tag, Button, FormGroup, FormLabel, FormInput } from '@/components/common';
import { useToast } from '@/components/common';
import { KVRow } from './KVRow';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useProgram } from '@/hooks/useProgram';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';
import { MasterPolicyStatus } from '@/lib/idl/open_parametric';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
`;

const BigValue = styled(Mono)`
  font-size: 20px;
  font-weight: 700;
  display: block;
  margin: 4px 0;
`;

const STATUS_LABELS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: 'Draft',
  [MasterPolicyStatus.PendingConfirm]: 'PendingConfirm',
  [MasterPolicyStatus.Active]: 'Active',
  [MasterPolicyStatus.Closed]: 'Closed',
  [MasterPolicyStatus.Cancelled]: 'Cancelled',
};

const STATUS_COLORS: Record<number, string> = {
  [MasterPolicyStatus.Draft]: '#94A3B8',
  [MasterPolicyStatus.PendingConfirm]: '#F59E0B',
  [MasterPolicyStatus.Active]: '#22C55E',
  [MasterPolicyStatus.Closed]: '#64748B',
  [MasterPolicyStatus.Cancelled]: '#EF4444',
};

interface PortalOverviewProps {
  participantInfo: ParticipantInfo;
  allRoles?: ParticipantInfo[];
  masterPDA?: PublicKey | null;
}

export function PortalOverview({ participantInfo, allRoles, masterPDA }: PortalOverviewProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { program, provider, wallet } = useProgram();
  const { policyStateIdx, poolBalance, totalPremium, totalClaim } = useProtocolStore();
  const [fundAmount, setFundAmount] = useState('');
  const [fundLoading, setFundLoading] = useState(false);

  const roles = allRoles && allRoles.length > 0 ? allRoles : [participantInfo];
  // Sum shareBps across participant roles only (partA/partB/rein) — leader 10000 is not additive
  const participantRoles = roles.filter(r => r.role !== 'leader');
  const effectiveRoles = participantRoles.length > 0 ? participantRoles : roles;
  const totalShareBps = effectiveRoles.reduce((sum, r) => sum + r.shareBps, 0);
  const totalSharePct = (totalShareBps / 100).toFixed(1);
  const myPremium = totalPremium * (totalShareBps / 10000);
  const myClaim = totalClaim * (totalShareBps / 10000);
  const poolHealth = poolBalance + totalClaim > 0
    ? Math.min(100, (poolBalance / (poolBalance + totalClaim)) * 100)
    : 100;

  const handleFundMyPool = async () => {
    if (!masterPDA || !wallet || !program || !provider) {
      toast(t('portal.fundNoWallet'), 'd');
      return;
    }
    const amountUsdc = parseFloat(fundAmount);
    if (!amountUsdc || amountUsdc <= 0) {
      toast(t('portal.fundInvalidAmount'), 'd');
      return;
    }

    setFundLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const masterData = await (program as any).account.masterPolicy.fetch(masterPDA);
      const currencyMint: PublicKey = masterData.currencyMint;
      const myATA = await getAssociatedTokenAddress(currencyMint, wallet.publicKey);

      // 온체인에서 내 poolWallet 찾기
      const walletKey = wallet.publicKey;
      let myPoolWallet: PublicKey | null = null;

      // participants 배열에서 찾기
      for (const p of masterData.participants) {
        if (p.insurer.equals(walletKey) && p.poolWallet) {
          myPoolWallet = p.poolWallet;
          break;
        }
      }
      // reinsurer인 경우
      if (!myPoolWallet && masterData.reinsurer.equals(walletKey)) {
        myPoolWallet = masterData.reinsurerPoolWallet;
      }

      if (!myPoolWallet) {
        toast(t('portal.fundNoPool'), 'd');
        setFundLoading(false);
        return;
      }

      const amountRaw = Math.floor(amountUsdc * 1_000_000);
      const ix = createTransferInstruction(myATA, myPoolWallet, walletKey, amountRaw);
      const tx = new Transaction().add(ix);
      const sig = await provider.sendAndConfirm(tx, []);
      toast(`${t('portal.fundSuccess')} TX: ${sig.slice(0, 8)}...`, 's');
      setFundAmount('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`${t('portal.fundFailed')}: ${message}`, 'd');
    } finally {
      setFundLoading(false);
    }
  };

  return (
    <div style={{ padding: 14 }}>
      <Grid>
        <Card>
          <CardHeader>
            <CardTitle>{t('portal.policyStatus')}</CardTitle>
            <Tag variant="subtle" style={{ color: STATUS_COLORS[policyStateIdx] || '#94A3B8' }}>
              {STATUS_LABELS[policyStateIdx] || 'Unknown'}
            </Tag>
          </CardHeader>
          <CardBody>
            <KVRow label={t('portal.poolBalance')} value={formatNum(poolBalance, 2) + ' USDC'} />
            <KVRow label={t('portal.poolHealth')} value={formatNum(poolHealth, 1) + '%'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.myShare')}</CardTitle>
            <Tag variant="accent">{totalSharePct}%</Tag>
          </CardHeader>
          <CardBody>
            <BigValue>{totalSharePct}%</BigValue>
            {roles.map(r => (
              <KVRow
                key={r.role}
                label={t(`portal.role.${r.role}`, r.role ?? '—')}
                value={`${(r.shareBps / 100).toFixed(1)}% (${r.shareBps} bps) · ${r.confirmed ? t('portal.confirmed') : t('portal.pendingConfirm')}`}
              />
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.myPremium')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--success)' }}>{formatNum(myPremium, 2)} USDC</BigValue>
            <KVRow label={t('portal.totalPremium')} value={formatNum(totalPremium, 2) + ' USDC'} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.myClaim')}</CardTitle>
          </CardHeader>
          <CardBody>
            <BigValue style={{ color: 'var(--danger)' }}>{formatNum(myClaim, 2)} USDC</BigValue>
            <KVRow label={t('portal.totalClaim')} value={formatNum(totalClaim, 2) + ' USDC'} />
          </CardBody>
        </Card>
      </Grid>

      {masterPDA && (
        <Card style={{ marginTop: 10 }}>
          <CardHeader>
            <CardTitle>{t('portal.fundMyPool')}</CardTitle>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <FormGroup style={{ flex: 1, marginBottom: 0 }}>
                <FormLabel>{t('portal.fundAmount')}</FormLabel>
                <FormInput
                  type="number"
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  style={{ fontFamily: "'DM Mono', monospace" }}
                />
              </FormGroup>
              <Button
                variant="primary"
                onClick={handleFundMyPool}
                disabled={fundLoading || !fundAmount}
                style={{ whiteSpace: 'nowrap', marginBottom: 0 }}
              >
                {fundLoading ? t('portal.funding') : t('portal.fundBtn')}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
