import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function PremiumLineChart() {
  const { t, i18n: { language } } = useTranslation();
  const premHist = useProtocolStore(s => s.premHist);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const labels = premHist.map(x => x.t);
    const data = premHist.map(x => x.v);

    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets[0]!.data = data;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: t('feed.totalPremium'),
          data,
          borderColor: '#9945FF',
          backgroundColor: 'rgba(153,69,255,.07)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94A3B8', font: { size: 8 } }, grid: { color: '#1F2937' } },
          y: { ticks: { color: '#94A3B8', font: { family: 'DM Mono', size: 8 } }, grid: { color: '#1F2937' } },
        },
        animation: { duration: 200 },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [premHist, language]);

  return (
    <Card style={{ marginTop: 10 }}>
      <CardHeader><CardTitle>{t('feed.lineTitle')}</CardTitle></CardHeader>
      <CardBody style={{ padding: 10 }}>
        <div style={{ height: 130 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
