import { Card, CardHeader, CardTitle, SettlementFlowDiagram } from '@/components/common';

export function SettlementFlow() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>건당 실시간 정산 구조</CardTitle>
      </CardHeader>
      <SettlementFlowDiagram />
    </Card>
  );
}
