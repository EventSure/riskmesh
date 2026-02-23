import { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function PremiumPieChart() {
  const acc = useProtocolStore(s => s.acc);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const data = [acc.lP, acc.aP, acc.bP, acc.rP];
    const labels = ['리더사', '참여사A', '참여사B', '재보험사'];
    const colors = ['#9945FF', '#14F195', '#F59E0B', '#38BDF8'];

    if (chartRef.current) {
      chartRef.current.data.datasets[0]!.data = data;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors.map(c => c + '99'), borderColor: colors, borderWidth: 1.5 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom', labels: { color: '#94A3B8', font: { family: 'DM Mono', size: 9 }, padding: 5, boxWidth: 8 } } },
        animation: { duration: 300 },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [acc.lP, acc.aP, acc.bP, acc.rP]);

  return (
    <Card>
      <CardHeader><CardTitle>보험료 배분 구조</CardTitle></CardHeader>
      <CardBody style={{ padding: 10 }}>
        <div style={{ height: 150 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
