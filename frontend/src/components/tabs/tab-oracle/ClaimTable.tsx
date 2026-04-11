import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, DataTable } from '@/components/common';
import { useProtocolStore, formatNum, PARTICIPANT_COLORS } from '@/store/useProtocolStore';

export function ClaimTable() {
  const { t } = useTranslation();
  const claims = useProtocolStore(s => s.claims);
  const participants = useProtocolStore(s => s.participants);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('claim.tableTitle')}</CardTitle>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(153,69,255,.15)', color: 'var(--primary)', border: '1px solid rgba(153,69,255,.25)' }}>
          {t('common.count', { count: claims.length })}
        </span>
      </CardHeader>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 196 }}>
        <DataTable style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th>#</th><th>{t('claim.th.policyholder')}</th><th>{t('claim.th.flight')}</th><th>{t('claim.th.delay')}</th><th>{t('claim.th.tier')}</th><th>{t('claim.th.payout')}</th>
              <th>{t('claim.th.leader')}</th>
              {participants.map((p, i) => (
                <th key={p.id}>{p.name || `${t('claim.th.participant')}${i + 1}`}</th>
              ))}
              <th>{t('claim.th.reinBurden')}</th><th>{t('claim.th.status')}</th><th>{t('claim.th.time')}</th>
            </tr>
          </thead>
          <tbody>
            {[...claims].reverse().map(c => {
              const CLAIM_COLOR: Record<string, string> = {
                claimable: '#F59E0B',
                approved:  '#14F195',
                settled:   '#9945FF',
                pending:   '#94A3B8',
              };
              const clr = CLAIM_COLOR[c.status] ?? '#94A3B8';
              const statusLabel = c.status === 'settled' ? t('claim.status.settled') : c.status === 'approved' ? t('claim.status.approved') : c.status === 'claimable' ? t('claim.status.claimable') : t('claim.status.pending');
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
                  {participants.map((p, i) => (
                    <td key={p.id} style={{ color: PARTICIPANT_COLORS[i] }}>{formatNum(c.participantNets[i] ?? 0, 2)}</td>
                  ))}
                  <td style={{ color: '#38BDF8' }}>{formatNum(c.totRC, 2)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', fontFamily: "'DM Mono', monospace",
                      background: `${clr}1a`,
                      color: clr,
                      border: `1px solid ${clr}44`,
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
