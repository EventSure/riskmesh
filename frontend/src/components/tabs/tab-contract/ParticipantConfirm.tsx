import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useConfirmMaster } from '@/hooks/useConfirmMaster';
import { useActivateMaster } from '@/hooks/useActivateMaster';
import { useRegisterParticipantWallets } from '@/hooks/useRegisterParticipantWallets';
import { useProgram } from '@/hooks/useProgram';
import { ConfirmRole } from '@/lib/idl/open_parametric';
import { CURRENCY_MINT } from '@/lib/constants';
import { getAssociatedTokenAddress } from '@solana/spl-token';

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
  const { confirmMaster, loading: confirmLoading } = useConfirmMaster();
  const { activateMaster: activateMasterOnChain, loading: activateLoading } = useActivateMaster();
  const { registerWallets, loading: registerLoading } = useRegisterParticipantWallets();
  const { wallet } = useProgram();

  const PT_DEF = [
    { key: 'partA' as const, name: t('confirm.partAName'), color: '#14F195', confirmRole: ConfirmRole.Participant },
    { key: 'partB' as const, name: t('confirm.partBName'), color: '#F59E0B', confirmRole: ConfirmRole.Participant },
    { key: 'rein' as const, name: t('confirm.reinName'), color: '#38BDF8', confirmRole: ConfirmRole.Reinsurer },
  ];

  const allConfirmed = confirms.partA && confirms.partB && confirms.rein;
  const canActivate = allConfirmed && !masterActive && (role === 'leader' || role === 'operator');
  const isLoading = confirmLoading || activateLoading || registerLoading;

  const handleConfirm = async (key: 'partA' | 'partB' | 'rein') => {
    if (mode === 'simulation') {
      confirmParty(key);
      toast(t('toast.confirmDone', { role: t(`role.${key}Short`) }), 's');
      return;
    }

    // On-chain: register wallets first, then confirm
    if (!masterPolicyPDA || !wallet) { toast('No master policy PDA or wallet', 'd'); return; }
    const masterPubkey = new PublicKey(masterPolicyPDA);
    const pt = PT_DEF.find(p => p.key === key)!;

    // TODO: 데모에서는 모든 participant가 같은 지갑(leaderKey)을 사용하므로
    // register_participant_wallets의 position() 매칭이 항상 index 0만 반환함
    // → participant[1],[2]는 wallet 미등록 상태 → confirm 시 InvalidInput 에러
    // 실제 환경에서는 각 participant별 고유 지갑 + ATA 필요

    // Step 1: Register participant wallets (pool_wallet + deposit_wallet must be set before confirm)
    const ata = await getAssociatedTokenAddress(CURRENCY_MINT, wallet.publicKey);
    const regResult = await registerWallets({
      masterPolicy: masterPubkey,
      poolWallet: ata,
      depositWallet: ata,
    });
    if (!regResult.success) {
      // If already registered, the error may contain "already" — continue anyway
      if (!regResult.error?.includes('already')) {
        toast(`Register wallets failed: ${regResult.error}`, 'd');
        return;
      }
    }

    // Step 2: Confirm
    const result = await confirmMaster({
      masterPolicy: masterPubkey,
      role: pt.confirmRole,
    });
    if (!result.success) { toast(`TX failed: ${result.error}`, 'd'); return; }
    onChainConfirm(key, result.signature);
    toast(t('toast.confirmDone', { role: t(`role.${key}Short`) }) + ` TX: ${result.signature.slice(0, 8)}...`, 's');
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
              {!cf && canC && processStep >= 1 && (
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
