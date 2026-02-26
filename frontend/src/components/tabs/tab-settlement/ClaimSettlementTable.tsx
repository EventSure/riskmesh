import { Card, CardHeader, CardTitle, SettlementTable } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';

export function ClaimSettlementTable() {
  const { totalClaim, shares } = useProtocolStore();
  const lS = shares.leader / 100, aS = shares.partA / 100, bS = shares.partB / 100;

  const rows = [
    { label: '리더사 (삼성화재)', s: lS },
    { label: '참여사 A (현대해상)', s: aS },
    { label: '참여사 B (DB손보)', s: bS },
  ].map(r => {
    const gross = totalClaim * r.s;
    const rc = gross * 0.5;
    const comm = totalClaim * 0.1 * r.s;
    const net = gross - rc + comm;
    return { ...r, gross, rc, comm, net };
  });

  const rcIn = totalClaim * 0.5;
  const rcOut = totalClaim * 0.1;

  return (
    <Card>
      <CardHeader><CardTitle>2. 보험금 정산 (건당 실시간)</CardTitle></CardHeader>
      <div style={{ overflowX: 'auto', padding: 12 }}>
        <SettlementTable>
          <thead>
            <tr><th>구분</th><th>지분</th><th>보험금 지급</th><th>재보험사 분담</th><th>수수료 지급(10%)</th><th>정산 보험금</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>{formatNum(r.s * 100, 0)}%</td>
                <td style={{ color: 'var(--danger)' }}>{formatNum(r.gross, 4)}</td>
                <td style={{ color: 'var(--info)' }}>{formatNum(r.rc, 4)}</td>
                <td style={{ color: 'var(--warning)' }}>{formatNum(r.comm, 4)}</td>
                <td style={{ color: 'var(--danger)' }}>{formatNum(r.net, 4)}</td>
              </tr>
            ))}
            <tr className="trein">
              <td>재보험사</td>
              <td>50%</td>
              <td style={{ color: 'var(--info)' }}>-{formatNum(rcIn, 4)}</td>
              <td>—</td>
              <td style={{ color: 'var(--accent)' }}>+{formatNum(rcOut, 4)}</td>
              <td style={{ color: 'var(--info)' }}>{formatNum(-rcIn + rcOut, 4)}</td>
            </tr>
          </tbody>
        </SettlementTable>
      </div>
    </Card>
  );
}
