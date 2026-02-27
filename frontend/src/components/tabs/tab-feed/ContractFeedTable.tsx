import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, Button, DataTable, Tag } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useShallow } from 'zustand/react/shallow';

export function ContractFeedTable() {
  const { t } = useTranslation();
  const { contracts, clearContracts, premiumPerPolicy, mode } = useProtocolStore(
    useShallow(s => ({ contracts: s.contracts, clearContracts: s.clearContracts, premiumPerPolicy: s.premiumPerPolicy, mode: s.mode })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('feed.tableTitle')}</CardTitle>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(153,69,255,.15)', color: 'var(--primary)', border: '1px solid rgba(153,69,255,.25)' }}>
            {t('common.count', { count: contracts.length })}
          </span>
          {mode !== 'onchain' && <Button variant="outline" size="sm" onClick={clearContracts}>{t('common.clear')}</Button>}
        </div>
      </CardHeader>
      <div style={{ overflowX: 'auto' }}>
        <DataTable style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th>#</th><th>{t('feed.th.policyholder')}</th><th>{t('feed.th.flight')}</th><th>{t('feed.th.date')}</th><th>{t('feed.th.premium')}</th>
              <th>{t('feed.th.leader')}</th><th>{t('feed.th.partA')}</th><th>{t('feed.th.partB')}</th><th>{t('feed.th.reinsurer')}</th><th>{t('feed.th.settledAt')}</th><th>{t('feed.th.status')}</th>
            </tr>
          </thead>
          <tbody>
            {[...contracts].reverse().slice(0, 60).map(c => (
              <tr key={c.id} className="nr">
                <td style={{ color: 'var(--sub)' }}>#{c.id}</td>
                <td>{c.name}</td>
                <td style={{ color: 'var(--accent)' }}>{c.flight}</td>
                <td>{c.date}</td>
                <td style={{ color: 'var(--warning)' }}>{formatNum(premiumPerPolicy, 4)}</td>
                <td style={{ color: '#9945FF' }}>{formatNum(c.lNet, 4)}</td>
                <td style={{ color: '#14F195' }}>{formatNum(c.aNet, 4)}</td>
                <td style={{ color: '#F59E0B' }}>{formatNum(c.bNet, 4)}</td>
                <td style={{ color: '#38BDF8' }}>{formatNum(c.rNet, 4)}</td>
                <td style={{ fontSize: 9, color: 'var(--sub)' }}>{c.ts}</td>
                <td><Tag variant="accent">{t('common.active')}</Tag></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </Card>
  );
}
