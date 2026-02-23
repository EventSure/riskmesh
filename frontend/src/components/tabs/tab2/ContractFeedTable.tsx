import { Card, CardHeader, CardTitle, Button, DataTable, Tag } from '@/components/common';
import { useProtocolStore, fmt } from '@/store/useProtocolStore';

export function ContractFeedTable() {
  const { contracts, clearContracts } = useProtocolStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>실시간 계약 피드</CardTitle>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(153,69,255,.15)', color: 'var(--primary)', border: '1px solid rgba(153,69,255,.25)' }}>
            {contracts.length}건
          </span>
          <Button variant="outline" size="sm" onClick={clearContracts}>초기화</Button>
        </div>
      </CardHeader>
      <div style={{ overflowX: 'auto' }}>
        <DataTable style={{ minWidth: 700 }}>
          <thead>
            <tr>
              <th>#</th><th>계약자</th><th>항공편</th><th>출발일</th><th>보험료</th>
              <th>리더사</th><th>참여사A</th><th>참여사B</th><th>재보험사(순)</th><th>정산시각</th><th>상태</th>
            </tr>
          </thead>
          <tbody>
            {[...contracts].reverse().slice(0, 60).map(c => (
              <tr key={c.id} className="nr">
                <td style={{ color: 'var(--sub)' }}>#{c.id}</td>
                <td>{c.name}</td>
                <td style={{ color: 'var(--accent)' }}>{c.flight}</td>
                <td>{c.date}</td>
                <td style={{ color: 'var(--warning)' }}>1.0000</td>
                <td style={{ color: '#9945FF' }}>{fmt(c.lNet, 4)}</td>
                <td style={{ color: '#14F195' }}>{fmt(c.aNet, 4)}</td>
                <td style={{ color: '#F59E0B' }}>{fmt(c.bNet, 4)}</td>
                <td style={{ color: '#38BDF8' }}>{fmt(c.rNet, 4)}</td>
                <td style={{ fontSize: 9, color: 'var(--sub)' }}>{c.ts}</td>
                <td><Tag variant="accent">활성</Tag></td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    </Card>
  );
}
