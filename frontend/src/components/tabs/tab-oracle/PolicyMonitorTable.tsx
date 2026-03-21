import styled from '@emotion/styled';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';

/* ── Styles ── */

const MonTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    padding: 5px 10px;
    text-align: left;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: ${p => p.theme.colors.sub};
    border-bottom: 1px solid ${p => p.theme.colors.border};
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 1;
    background: ${p => p.theme.colors.surface1};
  }

  td {
    padding: 6px 10px;
    border-bottom: 1px solid ${p => p.theme.colors.border};
    font-size: 11px;
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: ${p => p.theme.colors.surface2}; }
`;

const StatusBadge = styled.span<{ clr: string }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-family: 'DM Mono', monospace;
  background: ${p => p.clr}1a;
  color: ${p => p.clr};
  border: 1px solid ${p => p.clr}44;
`;

const Mono = styled.span`
  font-family: 'DM Mono', monospace;
  font-size: 10px;
`;

const STATUS_COLOR: Record<string, string> = {
  active: '#14F195',
  claimed: '#9945FF',
  noClaim: '#94A3B8',
  expired: '#64748B',
};

const STATUS_ICON: Record<string, string> = {
  active: '⏳',
  claimed: '✅',
  noClaim: '──',
  expired: '⏰',
};

/* ── Component ── */

export function PolicyMonitorTable() {
  const { t } = useTranslation();
  const { contracts, claims } = useProtocolStore();

  if (contracts.length === 0) return null;

  return (
    <Card style={{ marginBottom: 12 }}>
      <CardHeader>
        <CardTitle>{t('oracle.policyMonitor')}</CardTitle>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px',
          borderRadius: 10, background: 'rgba(20,241,149,.10)',
          color: 'var(--accent)', border: '1px solid rgba(20,241,149,.25)',
        }}>
          {t('common.count', { count: contracts.length })}
        </span>
      </CardHeader>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 196 }}>
        <MonTable>
          <thead>
            <tr>
              <th>#</th>
              <th>{t('oracle.th.flight')}</th>
              <th>{t('oracle.th.contract')}</th>
              <th>{t('oracle.th.date')}</th>
              <th>{t('oracle.th.status')}</th>
              <th>{t('oracle.th.delay')}</th>
            </tr>
          </thead>
          <tbody>
            {[...contracts].reverse().map(c => {
              const claim = claims.find(cl => cl.contractId === c.id);
              const clr = STATUS_COLOR[c.status] || '#94A3B8';
              const icon = STATUS_ICON[c.status] || '';
              return (
                <tr key={c.id}>
                  <td>
                    <Mono style={{ color: 'var(--accent)', fontWeight: 700 }}>#{c.id}</Mono>
                  </td>
                  <td>
                    <Mono style={{ color: 'var(--accent)', fontWeight: 600 }}>{c.flight}</Mono>
                  </td>
                  <td style={{ color: 'var(--text)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </td>
                  <td>
                    <Mono style={{ color: 'var(--sub)' }}>{c.date}</Mono>
                  </td>
                  <td>
                    <StatusBadge clr={clr}>{icon} {t(`common.${c.status}`)}</StatusBadge>
                  </td>
                  <td>
                    <Mono style={{ color: claim?.delay ? 'var(--warning)' : 'var(--sub)' }}>
                      {claim?.delay ? `${claim.delay}${t('common.min')}` : '—'}
                    </Mono>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </MonTable>
      </div>
    </Card>
  );
}
