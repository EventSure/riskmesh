import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';

export function FinalSettlementTable() {
  const { t } = useTranslation();
  const { acc, totalPremium, totalClaim, cededRatioBps, reinsCommissionBps } = useProtocolStore();
  const ceded = cededRatioBps / 10000;
  const commRate = reinsCommissionBps / 10000;
  const reinsEff = ceded * (1 - commRate);

  const rPNet = totalPremium * reinsEff;

  const rCNet = -totalClaim * reinsEff;

  const rows = [
    { label: t('settle.party.leader'), p: acc.leaderPrem, c: acc.leaderClaim, rein: false },
    { label: t('settle.party.partA'), p: acc.partAPrem, c: acc.partAClaim, rein: false },
    { label: t('settle.party.partB'), p: acc.partBPrem, c: acc.partBClaim, rein: false },
    { label: t('settle.party.reinsurer'), p: rPNet, c: rCNet, rein: true },
  ].map(r => {
    const net = r.rein ? (r.p + r.c) : (r.p - r.c);
    return { ...r, net };
  });

  return (
    <Card>
      <CardHeader><CardTitle>{t('settle.finalTitle')}</CardTitle></CardHeader>
      <div style={{ overflowX: 'auto', padding: 12 }}>
        <SettlementTable>
          <thead>
            <tr><th>{t('settle.finalTh.party')}</th><th>{t('settle.finalTh.premium')}</th><th>{t('settle.finalTh.claim')}</th><th>{t('settle.finalTh.pl')}</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className={r.rein ? 'trein' : ''}>
                <td>{r.label}</td>
                <td style={{ color: 'var(--success)' }}>{formatNum(r.p, 4)}</td>
                <td style={{ color: 'var(--danger)' }}>{formatNum(r.rein ? -r.c : r.c, 4)}</td>
                <td style={{ color: r.net >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>
                  {r.net >= 0 ? '+' : ''}{formatNum(r.net, 4)}
                </td>
              </tr>
            ))}
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
