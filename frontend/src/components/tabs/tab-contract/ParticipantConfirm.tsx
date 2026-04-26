import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag } from '@/components/common';
import { useProtocolStore, PARTICIPANT_COLORS, REINSURER_COLOR } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useActivateMaster } from '@/hooks/useActivateMaster';
import { useMasterAgreementAccount } from '@/hooks/useMasterAgreementAccount';

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

type ParticipantConfirmProps = {
  onActivated?: () => void;
};

export function ParticipantConfirm({ onActivated }: ParticipantConfirmProps) {
  const { mode, role, participants, reinsurer, masterActive, masterAgreementPDA, confirmParticipant, confirmReinsurer, activateMaster, onChainActivate } = useProtocolStore(
    useShallow(s => ({
      mode: s.mode, role: s.role, participants: s.participants, reinsurer: s.reinsurer,
      masterActive: s.masterActive, masterAgreementPDA: s.masterAgreementPDA,
      confirmParticipant: s.confirmParticipant, confirmReinsurer: s.confirmReinsurer,
      activateMaster: s.activateMaster, onChainActivate: s.onChainActivate,
    })),
  );
  const { toast } = useToast();
  const { t } = useTranslation();
  const { activateMaster: activateMasterOnChain, loading: activateLoading } = useActivateMaster();
  const masterAgreementKey = useMemo(
    () => (masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null),
    [masterAgreementPDA],
  );
  const { account: masterAccount } = useMasterAgreementAccount(masterAgreementKey);

  const allParticipantsConfirmed = participants.every(p => p.confirmed);
  const reinOk = !reinsurer.enabled || reinsurer.confirmed;
  const allConfirmed = allParticipantsConfirmed && reinOk;
  const canActivate = allConfirmed && !masterActive && (role === 'leader' || role === 'operator');

  const handleSimConfirmParticipant = (id: string) => {
    confirmParticipant(id);
    const p = participants.find(p => p.id === id);
    const idx = participants.findIndex(p => p.id === id);
    toast(t('toast.confirmDone', { role: p?.name || `참여사 ${idx + 1}` }), 's');
  };

  const handleSimConfirmReinsurer = () => {
    confirmReinsurer();
    toast(t('toast.confirmDone', { role: t('role.reinShort') }), 's');
  };

  const handleActivate = async () => {
    if (mode === 'simulation') {
      const result = activateMaster();
      if (!result.ok) { toast(result.msg!, 'd'); return; }
      toast(t('toast.masterActivated'), 's');
      onActivated?.();
      return;
    }

    // On-chain
    if (!masterAgreementKey) { toast('No master agreement PDA', 'd'); return; }
    if (!masterAccount) { toast('Master agreement account not loaded', 'd'); return; }
    const result = await activateMasterOnChain({
      masterAgreement: masterAgreementKey,
      leaderPoolToken: masterAccount.leaderPoolWallet,
      reinsurerPoolToken: masterAccount.reinsurerPoolWallet ?? masterAccount.leaderPoolWallet,
      participantPoolTokens: masterAccount.participants.map((participant) => participant.poolWallet),
    });
    if (!result.success) { toast(`TX failed: ${result.error}`, 'd'); return; }
    onChainActivate(result.signature, masterAgreementKey.toBase58());
    toast(t('toast.masterActivated') + ` TX: ${result.signature.slice(0, 8)}...`, 's');
    onActivated?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('confirm.title')}</CardTitle>
        <Tag variant={allConfirmed ? 'accent' : 'warning'}>{allConfirmed ? t('common.allConfirmed') : t('common.inProgress')}</Tag>
      </CardHeader>
      <CardBody style={{ padding: 10 }}>
        {mode === 'onchain' && !allConfirmed && (
          <div style={{ fontSize: 9, color: 'var(--sub)', textAlign: 'center', marginBottom: 8, padding: '6px 8px', background: 'var(--card2)', borderRadius: 6 }}>
            {t('confirm.portalGuide')}
          </div>
        )}
        {participants.map((p, i) => {
          const color = PARTICIPANT_COLORS[i] || '#14F195';
          const name = p.name || `${t('confirm.participant')} ${i + 1}`;
          const shareInfo = t('confirm.shareInfo', { share: p.share });
          return (
            <ParticipantRow key={p.id} confirmed={p.confirmed}>
              <PtHeader>
                <PtName>
                  <PtDot style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                  {name}
                </PtName>
                <Tag variant={p.confirmed ? 'accent' : 'subtle'}>{p.confirmed ? t('common.confirmed') : t('common.pending')}</Tag>
              </PtHeader>
              <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 5 }}>{shareInfo}</div>
              {mode === 'simulation' && !p.confirmed && (
                <Button variant="accent" fullWidth size="sm" onClick={() => handleSimConfirmParticipant(p.id)} data-guide={`confirm-p${i + 1}`}>
                  {t('confirm.btn')}
                </Button>
              )}
            </ParticipantRow>
          );
        })}
        {reinsurer.enabled && (
          <ParticipantRow confirmed={reinsurer.confirmed}>
            <PtHeader>
              <PtName>
                <PtDot style={{ background: REINSURER_COLOR, boxShadow: `0 0 4px ${REINSURER_COLOR}` }} />
                {t('confirm.reinName')}
              </PtName>
              <Tag variant={reinsurer.confirmed ? 'accent' : 'subtle'}>{reinsurer.confirmed ? t('common.confirmed') : t('common.pending')}</Tag>
            </PtHeader>
            <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 5 }}>{t('confirm.reinInfo')}</div>
            {mode === 'simulation' && !reinsurer.confirmed && (
              <Button variant="accent" fullWidth size="sm" onClick={handleSimConfirmReinsurer} data-guide="confirm-rein">
                {t('confirm.btn')}
              </Button>
            )}
          </ParticipantRow>
        )}
        <Button variant="accent" fullWidth onClick={handleActivate} disabled={!canActivate || activateLoading} style={{ marginTop: 4 }} data-guide="activate-btn">
          {activateLoading ? 'Sending TX...' : t('confirm.activateBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}
