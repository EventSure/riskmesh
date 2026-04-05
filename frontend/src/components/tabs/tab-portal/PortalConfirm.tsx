import { useState } from 'react';
import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { PublicKey, Transaction, SystemProgram, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, createAssociatedTokenAccountIdempotentInstruction, createInitializeAccount3Instruction, ACCOUNT_SIZE, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag } from '@/components/common';
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
