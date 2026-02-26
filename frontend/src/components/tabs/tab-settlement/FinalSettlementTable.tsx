import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';

export function FinalSettlementTable() {
  const { acc, totalPremium, totalClaim } = useProtocolStore();

  const rIn = totalPremium * 0.5;
  const rOut = totalPremium * 0.1;
  const rPNet = rIn - rOut;

  const rcIn = totalClaim * 0.5;
  const rcOut = totalClaim * 0.1;
  const rCNet = -rcIn + rcOut;

  const rows = [
    { label: '리더사 (삼성화재)', p: acc.leaderPrem, c: acc.leaderClaim, rein: false },
    { label: '참여사 A (현대해상)', p: acc.partAPrem, c: acc.partAClaim, rein: false },
    { label: '참여사 B (DB손보)', p: acc.partBPrem, c: acc.partBClaim, rein: false },
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
