import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useTranslation } from 'react-i18next';
import { useSettlementData } from '@/hooks/useSettlementData';

export function FinalSettlementTable() {
  const { t } = useTranslation();
  const { participants, reinsurer } = useProtocolStore();
  const { settledAcc: acc } = useSettlementData();
  const rows = [
    { label: t('settle.party.leader'), p: acc.leaderPrem, c: acc.leaderClaim, rein: false },
    ...participants.map((pt, i) => ({
      label: pt.name || `${t('settle.party.participant')} ${i + 1}`,
      p: acc.participantPrems[i] ?? 0,
      c: acc.participantClaims[i] ?? 0,
      rein: false,
    })),
    ...(reinsurer.enabled ? [{ label: t('settle.party.reinsurer'), p: acc.reinPrem, c: -acc.reinClaim, rein: true }] : []),
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
