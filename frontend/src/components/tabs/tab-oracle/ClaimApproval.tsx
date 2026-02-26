import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, SummaryRow, Divider } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';

export function ClaimApproval() {
  const { t } = useTranslation();
  const { role, claims, approveClaims, settleClaims } = useProtocolStore();
  const { toast } = useToast();

  const pendCnt = claims.filter(c => c.status === 'claimable').length;
  const appCnt = claims.filter(c => c.status === 'approved').length;
  const setlCnt = claims.filter(c => c.status === 'settled').length;
  const canAct = role === 'leader' || role === 'operator';

  const handleApprove = () => {
    const n = approveClaims();
    if (n === 0) { toast(t('toast.noClaimApprove'), 'w'); return; }
    toast(t('toast.approvedN', { count: n }), 's');
  };

  const handleSettle = () => {
    const n = settleClaims();
    if (n === 0) { toast(t('toast.noClaimSettle'), 'w'); return; }
    toast(t('toast.settledN', { count: n }), 's');
  };

  return (
    <Card>
      <CardHeader><CardTitle>{t('claim.approvalTitle')}</CardTitle></CardHeader>
      <CardBody>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.pending')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('common.count', { count: pendCnt })}</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.approved')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('common.count', { count: appCnt })}</span>
        </SummaryRow>
        <SummaryRow>
          <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.settled')}</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{t('common.count', { count: setlCnt })}</span>
        </SummaryRow>
        <Divider />
        <Button variant="warning" fullWidth onClick={handleApprove} disabled={!canAct || pendCnt === 0} style={{ marginBottom: 6 }}>
          {t('claim.approveBtn')}
        </Button>
        <Button variant="accent" fullWidth onClick={handleSettle} disabled={!canAct || appCnt === 0}>
          {t('claim.settleBtn')}
        </Button>
      </CardBody>
    </Card>
  );
}
