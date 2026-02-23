import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';

export function VaultChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault Balance Over Time</CardTitle>
      </CardHeader>
      <CardBody style={{ padding: '10px' }}>
        <div style={{ height: '130px' }}>
          <canvas id="vaultChart"></canvas>
        </div>
      </CardBody>
    </Card>
  );
}
