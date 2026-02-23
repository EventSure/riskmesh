import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, fmt } from '@/store/useProtocolStore';

export function FinalSettlementTable() {
  const { acc, totPrem, totClaim } = useProtocolStore();

  const rIn = totPrem * 0.5;
  const rOut = totPrem * 0.1;
  const rPNet = rIn - rOut;

  const rcIn = totClaim * 0.5;
  const rcOut = totClaim * 0.1;
  const rCNet = -rcIn + rcOut;

  const rows = [
    { label: '리더사 (삼성화재)', p: acc.lP, c: acc.lC, rein: false },
    { label: '참여사 A (현대해상)', p: acc.aP, c: acc.aC, rein: false },
    { label: '참여사 B (DB손보)', p: acc.bP, c: acc.bC, rein: false },
    { label: '재보험사', p: rPNet, c: rCNet, rein: true },
  ].map(r => {
    const net = r.rein ? (r.p + r.c) : (r.p - r.c);
    return { ...r, net };
  });

  return (
    <Card>
      <CardHeader><CardTitle>3. 최종 정산 (수지)</CardTitle></CardHeader>
      <div style={{ overflowX: 'auto', padding: 12 }}>
        <SettlementTable>
          <thead>
            <tr><th>구분</th><th>정산 보험료</th><th>정산 보험금</th><th>최종 수지</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className={r.rein ? 'trein' : ''}>
                <td>{r.label}</td>
                <td style={{ color: 'var(--success)' }}>{fmt(r.p, 4)}</td>
                <td style={{ color: 'var(--danger)' }}>{fmt(r.rein ? -r.c : r.c, 4)}</td>
                <td style={{ color: r.net >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>
                  {r.net >= 0 ? '+' : ''}{fmt(r.net, 4)}
                </td>
              </tr>
            ))}
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
