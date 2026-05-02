import { useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeAccount3Instruction,
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import BN from 'bn.js';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag, Divider, TierItem, useToast } from '@/components/common';
import { ConfirmRole } from '@/lib/idl/open_parametric';
import { KVRow } from './KVRow';
import { useProgram } from '@/hooks/useProgram';
import { useConfirmMaster } from '@/hooks/useConfirmMaster';
import { useFundPool } from '@/hooks/useFundPool';
import { usePoolCollateralStatus } from '@/hooks/usePoolCollateralStatus';
import { formatNum } from '@/store/useProtocolStore';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

const MICRO_USDC_FACTOR = 1_000_000;

const ConfirmBadge = styled.div<{ confirmed: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid ${p => p.confirmed ? p.theme.colors.success : p.theme.colors.warning};
  background: ${p => p.confirmed ? 'rgba(34,197,94,.06)' : 'rgba(245,158,11,.06)'};
  color: ${p => p.confirmed ? p.theme.colors.success : p.theme.colors.warning};
  font-size: 11px;
  font-weight: 700;
  margin-bottom: 12px;
`;

interface PortalConfirmProps {
  masterPDA: PublicKey;
  participantInfo: ParticipantInfo;
  allRoles?: ParticipantInfo[];
  onSuccess?: () => void;
}

function isRegisteredTokenAccount(account: PublicKey | null | undefined): account is PublicKey {
  return !!account && !account.equals(PublicKey.default);
}

function usdcToAmountRaw(amount: number): BN {
  return new BN(Math.max(0, Math.round(amount * MICRO_USDC_FACTOR)));
}

function formatUsdc(amount: number): string {
  return `${formatNum(amount, 2)} USDC`;
}

function participantPartyId(index: number): string | undefined {
  return index >= 0 ? `participant-${index + 1}` : undefined;
}

export function PortalConfirm({ masterPDA, participantInfo, allRoles, onSuccess }: PortalConfirmProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { program, provider, wallet } = useProgram();
  const { confirmMaster } = useConfirmMaster();
  const { fundPool } = useFundPool();
  const { status, activePartyId, masterData } = usePoolCollateralStatus(masterPDA, wallet?.publicKey ?? null);
  const [loading, setLoading] = useState(false);
  const [confirmedLocally, setConfirmedLocally] = useState(false);
  const [registeredActorPoolToken, setRegisteredActorPoolToken] = useState<PublicKey | null>(null);

  const isReinsurer = participantInfo.role === 'rein';
  const confirmRole = isReinsurer ? ConfirmRole.Reinsurer : ConfirmRole.Participant;
  const fallbackPartyId = isReinsurer ? 'reinsurer' : participantPartyId(participantInfo.participantIndex);

  useEffect(() => {
    setRegisteredActorPoolToken(null);
  }, [masterPDA, participantInfo.participantIndex, participantInfo.role]);

  const currentParty = useMemo(() => {
    if (!status) return null;
    return status.parties.find(p => p.id === activePartyId)
      ?? (fallbackPartyId ? status.parties.find(p => p.id === fallbackPartyId) : null)
      ?? null;
  }, [activePartyId, fallbackPartyId, status]);

  const deficitRaw = useMemo(
    () => usdcToAmountRaw(currentParty?.deficit ?? 0),
    [currentParty?.deficit],
  );
  const hasDeficit = !deficitRaw.isZero();
  const isConfirmed = participantInfo.confirmed || confirmedLocally;

  const sharePct = (participantInfo.shareBps / 100).toFixed(1);
  const roleLabels = (allRoles && allRoles.length > 0 ? allRoles : [participantInfo])
    .map(r => r.role ? t(`portal.role.${r.role}`) : '—')
    .join(' / ');

  const confirmButtonLabel = hasDeficit
    ? t('portal.confirmFundDeficitBtn', { amount: formatNum(currentParty?.deficit ?? 0, 2) })
    : t('portal.confirmBtn');

  const topUpButtonLabel = t('portal.topUpDeficitBtn', { amount: formatNum(currentParty?.deficit ?? 0, 2) });

  const resolveActorPoolToken = () => {
    if (!masterData) return null;

    if (isReinsurer) {
      return isRegisteredTokenAccount(masterData.reinsurerPoolWallet) ? masterData.reinsurerPoolWallet : null;
    }

    const participant = masterData.participants[participantInfo.participantIndex];
    if (isRegisteredTokenAccount(participant?.poolWallet)) {
      return participant.poolWallet;
    }

    return registeredActorPoolToken;
  };

  const ensureActorAccounts = async () => {
    if (!program || !provider || !wallet || !masterData) {
      throw new Error(t('portal.fundNoWallet'));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prog = program as any;
    const actorSourceToken = await getAssociatedTokenAddress(masterData.currencyMint, wallet.publicKey);
    const setupTx = new Transaction().add(
      createAssociatedTokenAccountIdempotentInstruction(
        wallet.publicKey,
        actorSourceToken,
        wallet.publicKey,
        masterData.currencyMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );

    let actorPoolToken = resolveActorPoolToken();
    let createdPoolToken: PublicKey | null = null;
    const signers: Keypair[] = [];

    if (!actorPoolToken && !isReinsurer) {
      const poolKp = Keypair.generate();
      const poolRent = await provider.connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
      const registerIx = await prog.methods
        .registerParticipantWallets()
        .accounts({
          insurer: wallet.publicKey,
          masterAgreement: masterPDA,
          poolWallet: poolKp.publicKey,
          depositWallet: actorSourceToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
      setupTx.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: poolKp.publicKey,
          lamports: poolRent,
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeAccount3Instruction(poolKp.publicKey, masterData.currencyMint, masterPDA),
        registerIx,
      );
      signers.push(poolKp);
      actorPoolToken = poolKp.publicKey;
      createdPoolToken = poolKp.publicKey;
    }

    if (!actorPoolToken) {
      throw new Error(t('portal.fundNoPool'));
    }

    try {
      await provider.sendAndConfirm(setupTx, signers, { commitment: 'confirmed' });
      if (createdPoolToken) {
        setRegisteredActorPoolToken(createdPoolToken);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('AlreadyProcessed') && !message.includes('already been processed')) {
        throw err;
      }
      if (createdPoolToken) {
        setRegisteredActorPoolToken(createdPoolToken);
      }
    }

    return { actorSourceToken, actorPoolToken };
  };

  const resolveLiveDeficitRaw = async (actorPoolToken: PublicKey): Promise<BN> => {
    if (!provider || !currentParty) {
      return new BN(0);
    }

    const requiredRaw = usdcToAmountRaw(currentParty.required);
    let balanceRaw = new BN(0);

    try {
      const balance = await provider.connection.getTokenAccountBalance(actorPoolToken);
      balanceRaw = new BN(balance.value.amount);
    } catch {
      balanceRaw = new BN(0);
    }

    if (balanceRaw.gte(requiredRaw)) {
      return new BN(0);
    }

    return requiredRaw.sub(balanceRaw);
  };

  const handleConfirm = async () => {
    if (!wallet) {
      toast(t('portal.fundNoWallet'), 'd');
      return;
    }

    setLoading(true);
    try {
      const { actorSourceToken, actorPoolToken } = await ensureActorAccounts();
      const confirmContext = {
        walletPublicKey: wallet.publicKey.toBase58(),
        participantIndex: participantInfo.participantIndex,
        confirmRole,
        actorSourceToken: actorSourceToken.toBase58(),
        actorPoolToken: actorPoolToken.toBase58(),
      };
      console.log('[PortalConfirm] confirm_master accounts', confirmContext);
      const result = await confirmMaster({
        masterAgreement: masterPDA,
        role: confirmRole,
        actorSourceToken,
        actorPoolToken,
      });

      if (!result.success) {
        throw new Error(result.error || t('portal.confirmFailed'));
      }

      setConfirmedLocally(true);
      toast(
        result.signature
          ? `${t('portal.confirmSuccess')} TX: ${result.signature.slice(0, 8)}...`
          : t('portal.confirmSuccess'),
        's',
      );
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log('[PortalConfirm] confirm_master failed', {
        walletPublicKey: wallet.publicKey.toBase58(),
        participantIndex: participantInfo.participantIndex,
        confirmRole,
        error: message,
      });
      if (message.includes('AlreadyProcessed') || message.includes('already been processed')) {
        setConfirmedLocally(true);
        toast(t('portal.confirmSuccess'), 's');
        onSuccess?.();
        return;
      }
      toast(message, 'd');
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (!wallet) {
      toast(t('portal.fundNoWallet'), 'd');
      return;
    }

    if (deficitRaw.isZero()) {
      return;
    }

    setLoading(true);
    try {
      const { actorSourceToken, actorPoolToken } = await ensureActorAccounts();
      const liveDeficitRaw = await resolveLiveDeficitRaw(actorPoolToken);

      if (liveDeficitRaw.isZero()) {
        toast(t('portal.noCollateralDeficit'), 's');
        onSuccess?.();
        return;
      }

      const result = await fundPool({
        masterAgreement: masterPDA,
        role: confirmRole,
        amountRaw: liveDeficitRaw,
        actorSourceToken,
        actorPoolToken,
      });

      if (!result.success) {
        throw new Error(result.error || t('portal.fundFailed'));
      }

      toast(
        result.signature
          ? `${t('portal.fundSuccess')} TX: ${result.signature.slice(0, 8)}...`
          : t('portal.fundSuccess'),
        's',
      );
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('AlreadyProcessed') || message.includes('already been processed')) {
        toast(t('portal.fundSuccess'), 's');
        onSuccess?.();
        return;
      }
      toast(message, 'd');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 14 }}>
      <Card>
        <CardHeader>
          <CardTitle>{t('portal.confirm')}</CardTitle>
          <Tag variant={isConfirmed ? 'accent' : 'warning'}>
            {isConfirmed ? t('portal.confirmed') : t('portal.pendingConfirm')}
          </Tag>
        </CardHeader>
        <CardBody>
          <ConfirmBadge confirmed={isConfirmed}>
            {isConfirmed ? t('portal.alreadyConfirmed') : t('portal.awaitingConfirm')}
          </ConfirmBadge>

          <KVRow label={t('portal.myRole')} value={roleLabels} />
          <KVRow label={t('portal.myShare')} value={`${sharePct}% (${participantInfo.shareBps} bps)`} />
          <KVRow label={t('portal.participantIndex')} value={`#${participantInfo.participantIndex}`} />

          {currentParty && (
            <>
              <Divider />
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 8, marginTop: 4 }}>
                {t('portal.collateralStatus')}
              </div>
              <KVRow label={t('portal.collateralRequired')} value={formatUsdc(currentParty.required)} />
              <KVRow label={t('portal.collateralFunded')} value={formatUsdc(currentParty.balance)} />
              <KVRow label={t('portal.collateralDeficit')} value={formatUsdc(currentParty.deficit)} />
            </>
          )}

          {masterData && (
            <>
              <Divider />
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 8, marginTop: 4 }}>
                {t('portal.contractTerms')}
              </div>
              <KVRow label={t('master.coverageStart')} value={new Date(masterData.coverageStartTs.toNumber() * 1000).toLocaleDateString('ko-KR')} />
              <KVRow label={t('master.coverageEnd')} value={new Date(masterData.coverageEndTs.toNumber() * 1000).toLocaleDateString('ko-KR')} />
              <KVRow label={t('master.premiumPerContract')} value={`${masterData.premiumPerPolicy.toNumber() / 1_000_000} USDC`} />
              <KVRow label={t('portal.cededRatio')} value={`${(masterData.cededRatioBps / 100).toFixed(0)}% / 커미션 ${(masterData.reinsCommissionBps / 100).toFixed(0)}%`} />
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sub)', marginBottom: 6, marginTop: 8 }}>
                {t('oracle.tierSection')}
              </div>
              <TierItem label={t('oracle.tier120')} value={`→ ${masterData.payoutDelay2H.toNumber() / 1_000_000} USDC`} color="#F59E0B" />
              <TierItem label={t('oracle.tier180')} value={`→ ${masterData.payoutDelay3H.toNumber() / 1_000_000} USDC`} color="#f97316" />
              <TierItem label={t('oracle.tier240')} value={`→ ${masterData.payoutDelay4To5H.toNumber() / 1_000_000} USDC`} color="#EF4444" />
              <TierItem label={t('oracle.tier360')} value={`→ ${masterData.payoutDelay6HOrCancelled.toNumber() / 1_000_000} USDC`} color="#fca5a5" />
            </>
          )}

          {!isConfirmed && (
            <Button
              variant="primary"
              fullWidth
              onClick={handleConfirm}
              disabled={loading}
              style={{ marginTop: 12 }}
            >
              {loading ? t('portal.confirming') : confirmButtonLabel}
            </Button>
          )}

          {isConfirmed && hasDeficit && (
            <Button
              variant="primary"
              fullWidth
              onClick={handleTopUp}
              disabled={loading}
              style={{ marginTop: 12 }}
            >
              {loading ? t('portal.funding') : topUpButtonLabel}
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
