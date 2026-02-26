import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, DataTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';

export function ClaimTable() {
  const { t } = useTranslation();
  const claims = useProtocolStore(s => s.claims);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('claim.tableTitle')}</CardTitle>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(153,69,255,.15)', color: 'var(--primary)', border: '1px solid rgba(153,69,255,.25)' }}>
          {t('common.count', { count: claims.length })}
        </span>
      </CardHeader>
      <div style={{ overflowX: 'auto' }}>
        <DataTable style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th>#</th><th>{t('claim.th.policyholder')}</th><th>{t('claim.th.flight')}</th><th>{t('claim.th.delay')}</th><th>{t('claim.th.tier')}</th><th>{t('claim.th.payout')}</th>
              <th>{t('claim.th.leader')}</th><th>{t('claim.th.partA')}</th><th>{t('claim.th.partB')}</th><th>{t('claim.th.reinBurden')}</th><th>{t('claim.th.status')}</th><th>{t('claim.th.time')}</th>
            </tr>
          </thead>
          <tbody>
            {[...claims].reverse().map(c => {
              const statusColor = c.status === 'settled' ? 'accent' : c.status === 'approved' ? 'warning' : 'danger';
              const statusLabel = c.status === 'settled' ? t('claim.status.settled') : c.status === 'approved' ? t('claim.status.approved') : t('claim.status.pending');
              return (
                <tr key={c.id} className="nr">
                  <td style={{ color: 'var(--sub)' }}>#{c.id}</td>
                  <td>{c.name}</td>
                  <td style={{ color: 'var(--accent)' }}>{c.flight}</td>
                  <td style={{ color: 'var(--warning)' }}>{c.delay}{t('common.min')}</td>
                  <td>
                    <span style={{ fontSize: 8, padding: '2px 4px', borderRadius: 4, background: c.color + '22', color: c.color, border: `1px solid ${c.color}55` }}>
                      {c.tier}
                    </span>
                  </td>
                  <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{formatNum(c.payout, 0)}</td>
                  <td style={{ color: '#9945FF' }}>{formatNum(c.lNet, 2)}</td>
                  <td style={{ color: '#14F195' }}>{formatNum(c.aNet, 2)}</td>
                  <td style={{ color: '#F59E0B' }}>{formatNum(c.bNet, 2)}</td>
                  <td style={{ color: '#38BDF8' }}>{formatNum(c.totRC, 2)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: "'DM Mono', monospace",
                      background: statusColor === 'accent' ? 'rgba(20,241,149,.12)' : statusColor === 'warning' ? 'rgba(245,158,11,.12)' : 'rgba(239,68,68,.12)',
                      color: `var(--${statusColor})`,
                      border: `1px solid ${statusColor === 'accent' ? 'rgba(20,241,149,.3)' : statusColor === 'warning' ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.3)'}`,
                    }}>{statusLabel}</span>
                  </td>
                  <td style={{ fontSize: 9, color: 'var(--sub)' }}>{c.ts}</td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>
    </Card>
  );
}
