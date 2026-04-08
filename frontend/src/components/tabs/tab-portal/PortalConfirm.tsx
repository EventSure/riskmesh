import { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, createInitializeAccount3Instruction, ACCOUNT_SIZE, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag, Divider, TierItem } from '@/components/common';
import { ConfirmRole } from '@/lib/idl/open_parametric';
import { KVRow } from './KVRow';
import { useToast } from '@/components/common';
import { useProgram } from '@/hooks/useProgram';
import type { ParticipantInfo } from '@/hooks/useParticipantRole';

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

export function PortalConfirm({ masterPDA, participantInfo, allRoles, onSuccess }: PortalConfirmProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { program, provider, wallet } = useProgram();
  const [loading, setLoading] = useState(false);
  const [confirmedLocally, setConfirmedLocally] = useState(false);
  const [masterData, setMasterData] = useState<{
    coverageStartTs: { toNumber(): number };
    coverageEndTs: { toNumber(): number };
    premiumPerPolicy: { toNumber(): number };
    payoutDelay2H: { toNumber(): number };
    payoutDelay3H: { toNumber(): number };
    payoutDelay4To5H: { toNumber(): number };
    payoutDelay6HOrCancelled: { toNumber(): number };
    cededRatioBps: number;
    reinsCommissionBps: number;
  } | null>(null);

  useEffect(() => {
    if (!program) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (program as any).account.masterPolicy.fetch(masterPDA)
      .then((data: typeof masterData) => setMasterData(data))
      .catch(() => { /* silent */ });
  }, [program, masterPDA]);

  const isConfirmed = participantInfo.confirmed || confirmedLocally;

  const sharePct = (participantInfo.shareBps / 100).toFixed(1);
  const roleLabels = (allRoles && allRoles.length > 0 ? allRoles : [participantInfo])
    .map(r => r.role ? t(`portal.role.${r.role}`) : '—')
    .join(' / ');

  const isReinsurer = participantInfo.role === 'rein';

  const handleReinConfirm = async () => {
    if (!program || !provider || !wallet) { toast('Wallet not connected', 'd'); return; }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;
      const sig: string = await prog.methods
        .confirmMaster(ConfirmRole.Reinsurer)
        .accounts({ actor: wallet.publicKey, masterPolicy: masterPDA })
        .rpc({ commitment: 'processed' });
      setConfirmedLocally(true);
      toast(`${t('portal.confirmSuccess')} TX: ${sig.slice(0, 8)}...`, 's');
      onSuccess?.();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : String(err), 'd');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!program || !provider || !wallet) {
      toast('Wallet not connected', 'd');
      return;
    }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      // masterPolicy에서 currencyMint를 읽어온다
      const masterData = await prog.account.masterPolicy.fetch(masterPDA);
      const currencyMint: PublicKey = masterData.currencyMint;

      // pool wallet: PDA(masterPolicy)가 owner인 새 SPL Token 계정
      const poolKp = Keypair.generate();
      const poolRent = await provider.connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);

      // deposit wallet: 참여자 본인의 ATA
      const depositWallet = await getAssociatedTokenAddress(currencyMint, wallet.publicKey);

      // TX1: deposit ATA 생성(없으면) + pool 계정 생성/초기화
      const tx1 = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey, depositWallet, wallet.publicKey, currencyMint,
          TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: poolKp.publicKey,
          lamports: poolRent,
          space: ACCOUNT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeAccount3Instruction(poolKp.publicKey, currencyMint, masterPDA),
      );
      await provider.sendAndConfirm(tx1, [poolKp], { commitment: 'processed' });

      // TX2: registerParticipantWallets + confirmMaster
      const regIx = await prog.methods
        .registerParticipantWallets()
        .accounts({
          insurer: wallet.publicKey,
          masterPolicy: masterPDA,
          poolWallet: poolKp.publicKey,
          depositWallet,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
      const confirmIx = await prog.methods
        .confirmMaster(ConfirmRole.Participant)
        .accounts({ actor: wallet.publicKey, masterPolicy: masterPDA })
        .instruction();

      const tx2 = new Transaction().add(regIx, confirmIx);
      const sig = await provider.sendAndConfirm(tx2, [], { commitment: 'processed' });

      setConfirmedLocally(true);
      toast(`${t('portal.confirmSuccess')} TX: ${sig.slice(0, 8)}...`, 's');
      onSuccess?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
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
              onClick={isReinsurer ? handleReinConfirm : handleConfirm}
              disabled={loading}
              style={{ marginTop: 12 }}
            >
              {loading ? t('portal.confirming') : t('portal.confirmBtn')}
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
