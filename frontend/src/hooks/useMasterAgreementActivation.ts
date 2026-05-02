import { useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import type { SharedMasterAgreementAccountState } from './useMasterAgreementAccount';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useActivateMaster } from './useActivateMaster';
import { useProgram } from './useProgram';

interface UseMasterAgreementActivationOptions extends Partial<SharedMasterAgreementAccountState> {
  onActivated?: () => void;
}

export function useMasterAgreementActivation(options: UseMasterAgreementActivationOptions = {}) {
  const { onActivated, masterData } = options;
  const {
    mode,
    role,
    participants,
    reinsurer,
    masterActive,
    masterAgreementPDA,
    activateMaster,
    onChainActivate,
  } = useProtocolStore(
    useShallow((state) => ({
      mode: state.mode,
      role: state.role,
      participants: state.participants,
      reinsurer: state.reinsurer,
      masterActive: state.masterActive,
      masterAgreementPDA: state.masterAgreementPDA,
      activateMaster: state.activateMaster,
      onChainActivate: state.onChainActivate,
    })),
  );
  const { toast } = useToast();
  const { t } = useTranslation();
  const { activateMaster: activateMasterOnChain, loading: activateLoading } = useActivateMaster();
  const { wallet } = useProgram();
  const masterAgreementKey = useMemo(
    () => (masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null),
    [masterAgreementPDA],
  );

  const allParticipantsConfirmed = participants.every((participant) => participant.confirmed);
  const reinOk = !reinsurer.enabled || reinsurer.confirmed;
  const allConfirmed = allParticipantsConfirmed && reinOk;
  const hasActivationAccountData = mode === 'simulation' || (!!masterAgreementKey && !!masterData);
  const hasActivationAuthority = mode === 'simulation'
    ? role === 'leader' || role === 'operator'
    : !!masterData && !!wallet?.publicKey && masterData.operator.equals(wallet.publicKey);
  const canActivate = allConfirmed && !masterActive && hasActivationAuthority && hasActivationAccountData;

  const handleActivate = async () => {
    if (mode === 'simulation') {
      const result = activateMaster();
      if (!result.ok) {
        toast(result.msg!, 'd');
        return;
      }

      toast(t('toast.masterActivated'), 's');
      onActivated?.();
      return;
    }

    if (!masterAgreementKey) {
      toast('No master agreement PDA', 'd');
      return;
    }

    if (!masterData) {
      toast('Master agreement account not loaded', 'd');
      return;
    }

    if (!wallet?.publicKey || !masterData.operator.equals(wallet.publicKey)) {
      return;
    }

    const result = await activateMasterOnChain({
      masterAgreement: masterAgreementKey,
      leaderPoolToken: masterData.leaderPoolWallet,
      reinsurerPoolToken: masterData.reinsurerPoolWallet ?? masterData.leaderPoolWallet,
      participantPoolTokens: masterData.participants.map((participant) => participant.poolWallet),
    });

    if (!result.success) {
      toast(`TX failed: ${result.error}`, 'd');
      return;
    }

    onChainActivate(result.signature, masterAgreementKey.toBase58());
    toast(`${t('toast.masterActivated')} TX: ${result.signature.slice(0, 8)}...`, 's');
    onActivated?.();
  };

  return {
    activateLoading,
    allConfirmed,
    canActivate,
    handleActivate,
  };
}
