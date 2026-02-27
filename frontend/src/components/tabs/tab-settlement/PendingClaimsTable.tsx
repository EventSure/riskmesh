import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, DataTable } from '@/components/common';
import { formatNum } from '@/store/useProtocolStore';
import { useSettlementData } from '@/hooks/useSettlementData';

export function PendingClaimsTable() {
  const { t } = useTranslation();
  const { pendingClaims, pendingCount } = useSettlementData();

  const totalPending = pendingClaims.reduce((s, c) => s + c.payout, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settle.pendingTitle')}</CardTitle>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(245,158,11,.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,.25)' }}>
          {t('common.count', { count: pendingCount })}
        </span>
      </CardHeader>
      <div style={{ overflowX: 'auto', padding: 12 }}>
        {pendingCount === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--sub)', textAlign: 'center', padding: '12px 0' }}>
            {t('settle.pendingEmpty')}
          </div>
        ) : (
          <>
            <DataTable style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('claim.th.policyholder')}</th>
                  <th>{t('claim.th.flight')}</th>
                  <th>{t('claim.th.delay')}</th>
                  <th>{t('claim.th.tier')}</th>
                  <th>{t('claim.th.payout')}</th>
                  <th>{t('claim.th.status')}</th>
                  <th>{t('claim.th.time')}</th>
                </tr>
              </thead>
              <tbody>
                {[...pendingClaims].reverse().map(c => (
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
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: "'DM Mono', monospace",
                        background: 'rgba(239,68,68,.12)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,.3)',
                      }}>{t('claim.status.pending')}</span>
                    </td>
                    <td style={{ fontSize: 9, color: 'var(--sub)' }}>{c.ts}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, fontSize: 10, color: 'var(--warning)', fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
              {t('settle.pendingTotal')}: {formatNum(totalPending, 2)} USDC
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
