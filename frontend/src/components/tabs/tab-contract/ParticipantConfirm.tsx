import { useState } from 'react';
import styled from '@emotion/styled';
import { PublicKey, Transaction } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useActivateMaster } from '@/hooks/useActivateMaster';
import { useProgram } from '@/hooks/useProgram';
import { ConfirmRole } from '@/lib/idl/open_parametric';
import { CURRENCY_MINT } from '@/lib/constants';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { getDemoKeypair } from '@/lib/demo-keypairs';

const ParticipantRow = styled.div<{ confirmed?: boolean }>`
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 9px 11px;
  margin-bottom: 7px;
  transition: border-color 0.3s;
  ${p => p.confirmed && `border-color: rgba(20,241,149,.35);`}
`;

const PtHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
`;

const PtName = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
`;

const PtDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 50%;
`;

export function ParticipantConfirm() {
  const { mode, role, confirms, shares, processStep, masterActive, masterPolicyPDA, confirmParty, activateMaster, onChainConfirm, onChainActivate } = useProtocolStore(
    useShallow(s => ({
      mode: s.mode, role: s.role, confirms: s.confirms, shares: s.shares,
      processStep: s.processStep, masterActive: s.masterActive, masterPolicyPDA: s.masterPolicyPDA,
      confirmParty: s.confirmParty, activateMaster: s.activateMaster,
      onChainConfirm: s.onChainConfirm, onChainActivate: s.onChainActivate,
    })),
  );
  const { toast } = useToast();
  const { t } = useTranslation();
  const { activateMaster: activateMasterOnChain, loading: activateLoading } = useActivateMaster();
  const { program, wallet, connection } = useProgram();
  const [confirmLoading, setConfirmLoading] = useState(false);

  const PT_DEF = [
    { key: 'partA' as const, name: t('confirm.partAName'), color: '#14F195', confirmRole: ConfirmRole.Participant },
    { key: 'partB' as const, name: t('confirm.partBName'), color: '#F59E0B', confirmRole: ConfirmRole.Participant },
    { key: 'rein' as const, name: t('confirm.reinName'), color: '#38BDF8', confirmRole: ConfirmRole.Reinsurer },
  ];

  const allConfirmed = confirms.partA && confirms.partB && confirms.rein;
  const canActivate = allConfirmed && !masterActive && (role === 'leader' || role === 'operator');
  const isLoading = confirmLoading || activateLoading;

  const handleConfirm = async (key: 'partA' | 'partB' | 'rein') => {
    if (mode === 'simulation') {
      confirmParty(key);
      toast(t('toast.confirmDone', { role: t(`role.${key}Short`) }), 's');
      return;
    }

    // On-chain mode
    if (!masterPolicyPDA || !wallet || !program || !connection) {
      toast('No master policy PDA or wallet', 'd');
      return;
    }

    // TODO.demo: reinsurer는 MasterContractSetup TX2에서 이미 confirm됨 (leader=reinsurer)
    // 실제 환경에서는 reinsurer가 별도 지갑으로 직접 confirm해야 함
    if (key === 'rein') {
      onChainConfirm('rein', 'auto-confirmed-during-setup');
      toast(t('toast.confirmDone', { role: t('role.reinShort') }) + ' (auto)', 's');
      return;
    }

    // TODO.demo: partA/partB는 데모용 인메모리 키페어로 프로그래밍 방식 서명
    // 실제 환경에서는 각 참여사가 자체 지갑(Phantom 등)으로 직접 서명해야 함
    const demoKp = getDemoKeypair(key);
    if (!demoKp) {
      toast('Demo keypair not found — create master policy first', 'd');
      return;
    }

    setConfirmLoading(true);
    try {
      const masterPubkey = new PublicKey(masterPolicyPDA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prog = program as any;

      // TODO.demo: 데모에서는 leader의 ATA를 pool/deposit 지갑으로 사용
      // 실제 환경에서는 각 participant의 고유 ATA 필요
      const ata = await getAssociatedTokenAddress(CURRENCY_MINT, demoKp.publicKey);

      // Build register_participant_wallets instruction
      const regIx = await prog.methods
        .registerParticipantWallets()
        .accounts({
          insurer: demoKp.publicKey,
          masterPolicy: masterPubkey,
          poolWallet: ata,
          depositWallet: ata,
        })
        .instruction();

      // Build confirm_master instruction
      const confirmIx = await prog.methods
        .confirmMaster(ConfirmRole.Participant)
        .accounts({
          actor: demoKp.publicKey,
          masterPolicy: masterPubkey,
        })
        .instruction();

      // TODO.demo: 데모 키페어로 프로그래밍 방식 서명 — Phantom 팝업 없음
      // 실제 환경에서는 각 participant가 자체 지갑으로 서명
      const tx = new Transaction().add(regIx, confirmIx);
      tx.feePayer = demoKp.publicKey;
      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.sign(demoKp);

      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({
        signature: sig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });

      onChainConfirm(key, sig);
      toast(t('toast.confirmDone', { role: t(`role.${key}Short`) }) + ` TX: ${sig.slice(0, 8)}...`, 's');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast(`TX failed: ${message}`, 'd');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleActivate = async () => {
    if (mode === 'simulation') {
      const result = activateMaster();
      if (!result.ok) { toast(result.msg!, 'd'); return; }
      toast(t('toast.masterActivated'), 's');
      return;
    }

    // On-chain
    if (!masterPolicyPDA) { toast('No master policy PDA', 'd'); return; }
    const result = await activateMasterOnChain({
      masterPolicy: new PublicKey(masterPolicyPDA),
    });
    if (!result.success) { toast(`TX failed: ${result.error}`, 'd'); return; }
    onChainActivate(result.signature, masterPolicyPDA);
    toast(t('toast.masterActivated') + ` TX: ${result.signature.slice(0, 8)}...`, 's');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('confirm.title')}</CardTitle>
        <Tag variant={allConfirmed ? 'accent' : 'warning'}>{allConfirmed ? t('common.allConfirmed') : t('common.inProgress')}</Tag>
      </CardHeader>
      <CardBody style={{ padding: 10 }}>
        {PT_DEF.map(pt => {
          const cf = confirms[pt.key];
          const canC = (pt.key === 'partA' && role === 'partA') ||
                       (pt.key === 'partB' && role === 'partB') ||
                       (pt.key === 'rein' && role === 'rein') ||
                       role === 'operator';
          const shareInfo = pt.key === 'rein'
            ? t('confirm.reinInfo')
            : t('confirm.shareInfo', { share: shares[pt.key] });

          return (
            <ParticipantRow key={pt.key} confirmed={cf}>
              <PtHeader>
                <PtName>
                  <PtDot style={{ background: pt.color, boxShadow: `0 0 4px ${pt.color}` }} />
                  {pt.name}
                </PtName>
                <Tag variant={cf ? 'accent' : 'subtle'}>{cf ? t('common.confirmed') : t('common.pending')}</Tag>
              </PtHeader>
              <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 5 }}>{shareInfo}</div>
              {!cf && canC && processStep >= (pt.key === 'partA' ? 1 : pt.key === 'partB' ? 2 : 3) && (
                <Button variant="accent" fullWidth size="sm" onClick={() => handleConfirm(pt.key)} disabled={isLoading}>
                  {isLoading ? 'Sending...' : t('confirm.btn')}
                </Button>
              )}
            </ParticipantRow>
          );
        })}
        <Button variant="accent" fullWidth onClick={handleActivate} disabled={!canActivate || isLoading} style={{ marginTop: 4 }}>
          {activateLoading ? 'Sending TX...' : t('confirm.activateBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}
