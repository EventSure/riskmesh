import styled from '@emotion/styled';
import { PublicKey } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';
import { useActivateMaster } from '@/hooks/useActivateMaster';

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
  const { mode, role, confirms, shares, masterActive, masterPolicyPDA, confirmParty, activateMaster, onChainActivate } = useProtocolStore(
    useShallow(s => ({
      mode: s.mode, role: s.role, confirms: s.confirms, shares: s.shares,
      masterActive: s.masterActive, masterPolicyPDA: s.masterPolicyPDA,
      confirmParty: s.confirmParty, activateMaster: s.activateMaster,
      onChainActivate: s.onChainActivate,
    })),
  );
  const { toast } = useToast();
  const { t } = useTranslation();
  const { activateMaster: activateMasterOnChain, loading: activateLoading } = useActivateMaster();

  const PT_DEF = [
    { key: 'partA' as const, name: t('confirm.partAName'), color: '#14F195' },
    { key: 'partB' as const, name: t('confirm.partBName'), color: '#F59E0B' },
    { key: 'rein' as const, name: t('confirm.reinName'), color: '#38BDF8' },
  ];

  const allConfirmed = confirms.partA && confirms.partB && confirms.rein;
  const canActivate = allConfirmed && !masterActive && (role === 'leader' || role === 'operator');

  const handleSimConfirm = (key: 'partA' | 'partB' | 'rein') => {
    confirmParty(key);
    toast(t('toast.confirmDone', { role: t(`role.${key}Short`) }), 's');
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
        {mode === 'onchain' && !allConfirmed && (
          <div style={{ fontSize: 9, color: 'var(--sub)', textAlign: 'center', marginBottom: 8, padding: '6px 8px', background: 'var(--card2)', borderRadius: 6 }}>
            {t('confirm.portalGuide')}
          </div>
        )}
        {PT_DEF.map(pt => {
          const cf = confirms[pt.key];
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
              {mode === 'simulation' && !cf && (
                <Button variant="accent" fullWidth size="sm" onClick={() => handleSimConfirm(pt.key)} data-guide={`confirm-${pt.key}`}>
                  {t('confirm.btn')}
                </Button>
              )}
            </ParticipantRow>
          );
        })}
        <Button variant="accent" fullWidth onClick={handleActivate} disabled={!canActivate || activateLoading} style={{ marginTop: 4 }} data-guide="activate-btn">
          {activateLoading ? 'Sending TX...' : t('confirm.activateBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}
