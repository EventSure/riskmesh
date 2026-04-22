import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';
import { useSettlementData } from '@/hooks/useSettlementData';

export function ClaimSettlementTable() {
  const { t } = useTranslation();
  const { leaderShare, participants, reinsurer, cededRatioBps, reinsCommissionBps } = useProtocolStore();
  const { settledTotalClaim: totalClaim } = useSettlementData();
  const ceded = cededRatioBps / 10000;
  const retained = 1 - ceded;
  const commRate = reinsCommissionBps / 10000;
  const reinsEff = reinsurer.enabled ? ceded : 0;

  const rows = [
    { label: t('settle.party.leader'), s: leaderShare / 100 },
    ...participants.map((p, i) => ({ label: p.name || `${t('settle.party.participant')} ${i + 1}`, s: p.share / 100 })),
  ].map(r => {
    const gross = totalClaim * r.s;
    const rc = gross * reinsEff;
    const comm = rc * commRate;
    const net = gross - rc + comm;
    return { ...r, gross, rc, comm, net };
  });

  const rcIn = totalClaim * reinsEff;
  const rcOut = rcIn * commRate;

  return (
    <Card>
      <CardHeader><CardTitle>{t('settle.claimTitle')}</CardTitle></CardHeader>
      <div style={{ overflowX: 'auto', padding: 12 }}>
        <SettlementTable>
          <thead>
            <tr><th>{t('settle.claimTh.party')}</th><th>{t('settle.claimTh.share')}</th><th>{t('settle.claimTh.gross')}</th><th>{t('settle.claimTh.reinShare')}</th><th>{t('settle.claimTh.commission')}</th><th>{t('settle.claimTh.net')}</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{formatNum(r.s * retained * 100, 0)}%</td>
                <td style={{ color: 'var(--danger)' }}>-{formatNum(r.gross, 4)}</td>
                <td style={{ color: 'var(--info)' }}>+{formatNum(r.rc, 4)}</td>
                <td style={{ color: 'var(--warning)' }}>-{formatNum(r.comm, 4)}</td>
                <td style={{ color: 'var(--danger)' }}>-{formatNum(r.net, 4)}</td>
              </tr>
            ))}
            {reinsurer.enabled && (
              <tr className="trein">
                <td>{t('settle.party.reinsurer')}</td>
                <td>{formatNum(ceded * 100, 0)}%</td>
                <td style={{ color: 'var(--info)' }}>-{formatNum(rcIn, 4)}</td>
                <td>—</td>
                <td style={{ color: 'var(--accent)' }}>+{formatNum(rcOut, 4)}</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(-rcIn + rcOut, 4)}</td>
              </tr>
            )}
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
