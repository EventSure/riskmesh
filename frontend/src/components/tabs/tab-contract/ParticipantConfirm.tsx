import styled from '@emotion/styled';
import { Card, CardHeader, CardTitle, CardBody, Button, Tag } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/shallow';
import { useToast } from '@/components/common';
import { useTranslation } from 'react-i18next';

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
  const { role, confirms, shares, processStep, masterActive, confirmParty, activateMaster } = useProtocolStore(
    useShallow(s => ({ role: s.role, confirms: s.confirms, shares: s.shares, processStep: s.processStep, masterActive: s.masterActive, confirmParty: s.confirmParty, activateMaster: s.activateMaster })),
  );
  const { toast } = useToast();
  const { t } = useTranslation();

  const PT_DEF = [
    { key: 'partA' as const, name: t('confirm.partAName'), color: '#14F195' },
    { key: 'partB' as const, name: t('confirm.partBName'), color: '#F59E0B' },
    { key: 'rein' as const, name: t('confirm.reinName'), color: '#38BDF8' },
  ];

  const allConfirmed = confirms.partA && confirms.partB && confirms.rein;
  const canActivate = allConfirmed && !masterActive && (role === 'leader' || role === 'operator');

  const handleConfirm = (key: 'partA' | 'partB' | 'rein') => {
    confirmParty(key);
    toast(t('toast.confirmDone', { role: t(`role.${key}Short`) }), 's');
  };

  const handleActivate = () => {
    const result = activateMaster();
    if (!result.ok) { toast(result.msg!, 'd'); return; }
    toast(t('toast.masterActivated'), 's');
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
                <Button variant="accent" fullWidth size="sm" onClick={() => handleConfirm(pt.key)}>
                  {t('confirm.btn')}
                </Button>
              )}
            </ParticipantRow>
          );
        })}
        <Button variant="accent" fullWidth onClick={handleActivate} disabled={!canActivate} style={{ marginTop: 4 }}>
          {t('confirm.activateBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}
