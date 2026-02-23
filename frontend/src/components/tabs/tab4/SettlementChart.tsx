import { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function SettlementChart() {
  const { acc, totPrem, totClaim } = useProtocolStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const rIn = totPrem * 0.5;
  const rOut = totPrem * 0.1;
  const rPNet = rIn - rOut;
  const rcIn = totClaim * 0.5;
  const rcOut = totClaim * 0.1;
  const rCNet = -rcIn + rcOut;

  const rows = [
    { label: '리더사', net: acc.lP - acc.lC },
    { label: '참여사A', net: acc.aP - acc.aC },
    { label: '참여사B', net: acc.bP - acc.bC },
    { label: '재보험사', net: rPNet + rCNet },
  ];

  useEffect(() => {
    if (!canvasRef.current) return;
    const labels = rows.map(r => r.label);
    const vals = rows.map(r => r.net);

    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets[0]!.data = vals;
      chartRef.current.data.datasets[0]!.backgroundColor = vals.map(v => v >= 0 ? 'rgba(20,241,149,.5)' : 'rgba(239,68,68,.5)');
      chartRef.current.data.datasets[0]!.borderColor = vals.map(v => v >= 0 ? '#14F195' : '#EF4444');
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '최종 수지',
          data: vals,
          backgroundColor: vals.map(v => v >= 0 ? 'rgba(20,241,149,.5)' : 'rgba(239,68,68,.5)'),
          borderColor: vals.map(v => v >= 0 ? '#14F195' : '#EF4444'),
          borderWidth: 1.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94A3B8', font: { size: 9 } }, grid: { color: '#1F2937' } },
          y: { ticks: { color: '#94A3B8', font: { family: 'DM Mono', size: 8 } }, grid: { color: '#1F2937' } },
        },
        animation: { duration: 300 },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [acc, totPrem, totClaim]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardHeader><CardTitle>수지 추이</CardTitle></CardHeader>
      <CardBody style={{ padding: 10 }}>
        <div style={{ height: 140 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
