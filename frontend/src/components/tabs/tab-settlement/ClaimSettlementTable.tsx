import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';

export function ClaimSettlementTable() {
  const { t } = useTranslation();
  const { totalClaim, shares } = useProtocolStore();
  const lS = shares.leader / 100, aS = shares.partA / 100, bS = shares.partB / 100;

  const rows = [
    { label: t('settle.party.leader'), s: lS },
    { label: t('settle.party.partA'), s: aS },
    { label: t('settle.party.partB'), s: bS },
  ].map(r => {
    const gross = totalClaim * r.s;
    const rc = gross * 0.5;
    const comm = totalClaim * 0.1 * r.s;
    const net = gross - rc + comm;
    return { ...r, gross, rc, comm, net };
  });

  const rcIn = totalClaim * 0.5;
  const rcOut = totalClaim * 0.1;

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
                <td>{formatNum(r.s * 100, 0)}%</td>
                <td style={{ color: 'var(--danger)' }}>{formatNum(r.gross, 4)}</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(r.rc, 4)}</td>
                <td style={{ color: 'var(--warning)' }}>{formatNum(r.comm, 4)}</td>
                <td style={{ color: 'var(--danger)' }}>{formatNum(r.net, 4)}</td>
              </tr>
            ))}
            <tr className="trein">
              <td>{t('settle.party.reinsurer')}</td>
              <td>50%</td>
              <td style={{ color: 'var(--info)' }}>-{formatNum(rcIn, 4)}</td>
              <td>—</td>
              <td style={{ color: 'var(--accent)' }}>+{formatNum(rcOut, 4)}</td>
              <td style={{ color: 'var(--info)' }}>{formatNum(-rcIn + rcOut, 4)}</td>
            </tr>
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
