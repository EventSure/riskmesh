import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';

export function PremiumSettlementTable() {
  const { totalPremium, shares } = useProtocolStore();
  const lS = shares.leader / 100, aS = shares.partA / 100, bS = shares.partB / 100;

  const rows = [
    { label: '리더사 (삼성화재)', s: lS },
    { label: '참여사 A (현대해상)', s: aS },
    { label: '참여사 B (DB손보)', s: bS },
  ].map(r => {
    const raw = totalPremium * r.s;
    const toR = raw * 0.5;
    const comm = totalPremium * 0.1 * r.s;
    const net = raw - toR + comm;
    return { ...r, raw, toR, comm, net };
  });

  const rIn = totalPremium * 0.5;
  const rOut = totalPremium * 0.1;

  return (
    <Card>
      <CardHeader><CardTitle>1. 보험료 정산 (건당 실시간)</CardTitle></CardHeader>
      <div style={{ overflowX: 'auto', padding: 12 }}>
        <SettlementTable>
          <thead>
            <tr><th>구분</th><th>지분</th><th>원수 보험료</th><th>재보험사 지급</th><th>수수료 수취(10%)</th><th>정산 보험료</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{formatNum(r.s * 100, 0)}%</td>
                <td>{formatNum(r.raw, 4)}</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(r.toR, 4)}</td>
                <td style={{ color: 'var(--accent)' }}>{formatNum(r.comm, 4)}</td>
                <td style={{ color: 'var(--success)' }}>{formatNum(r.net, 4)}</td>
              </tr>
            ))}
            <tr className="trein">
              <td>재보험사</td>
              <td>50%</td>
              <td>—</td>
              <td style={{ color: 'var(--info)' }}>{formatNum(rIn, 4)}</td>
              <td style={{ color: 'var(--warning)' }}>-{formatNum(rOut, 4)}</td>
              <td style={{ color: 'var(--info)' }}>{formatNum(rIn - rOut, 4)}</td>
            </tr>
            <tr className="ttr">
              <td>합 계</td>
              <td>—</td>
              <td>{formatNum(totalPremium, 4)}</td>
              <td>—</td>
              <td>—</td>
              <td>{formatNum(totalPremium, 4)}</td>
            </tr>
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
