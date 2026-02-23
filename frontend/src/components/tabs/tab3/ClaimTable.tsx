import { Card, CardHeader, CardTitle, DataTable } from '@/components/common';
import { useProtocolStore, fmt } from '@/store/useProtocolStore';

export function ClaimTable() {
  const claims = useProtocolStore(s => s.claims);

  return (
    <Card>
      <CardHeader>
        <CardTitle>클레임 현황</CardTitle>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(153,69,255,.15)', color: 'var(--primary)', border: '1px solid rgba(153,69,255,.25)' }}>
          {claims.length}건
        </span>
      </CardHeader>
      <div style={{ overflowX: 'auto' }}>
        <DataTable style={{ minWidth: 780 }}>
          <thead>
            <tr>
              <th>#</th><th>계약자</th><th>항공편</th><th>지연(분)</th><th>구간</th><th>보험금</th>
              <th>리더사</th><th>참여사A</th><th>참여사B</th><th>재보험사 부담</th><th>상태</th><th>시각</th>
            </tr>
          </thead>
          <tbody>
            {[...claims].reverse().map(c => {
              const statusColor = c.status === 'settled' ? 'accent' : c.status === 'approved' ? 'warning' : 'danger';
              const statusLabel = c.status === 'settled' ? '정산완료' : c.status === 'approved' ? '승인완료' : '대기중';
              return (
                <tr key={c.id} className="nr">
                  <td style={{ color: 'var(--sub)' }}>#{c.id}</td>
                  <td>{c.name}</td>
                  <td style={{ color: 'var(--accent)' }}>{c.flight}</td>
                  <td style={{ color: 'var(--warning)' }}>{c.delay}분</td>
                  <td>
                    <span style={{ fontSize: 8, padding: '2px 4px', borderRadius: 4, background: c.color + '22', color: c.color, border: `1px solid ${c.color}55` }}>
                      {c.tier}
                    </span>
                  </td>
                  <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt(c.payout, 0)}</td>
                  <td style={{ color: '#9945FF' }}>{fmt(c.lNet, 2)}</td>
                  <td style={{ color: '#14F195' }}>{fmt(c.aNet, 2)}</td>
                  <td style={{ color: '#F59E0B' }}>{fmt(c.bNet, 2)}</td>
                  <td style={{ color: '#38BDF8' }}>{fmt(c.totRC, 2)}</td>
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
