import { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';
import { useTranslation } from 'react-i18next';

Chart.register(...registerables);

export function PoolStatus() {
  const { poolBalance, totalClaim, poolHist } = useProtocolStore();
  const { t, i18n: { language } } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const total = poolBalance + totalClaim;
  const ratio = formatNum((poolBalance / 10000) * 100, 1);

  useEffect(() => {
    if (!canvasRef.current) return;
    const labels = poolHist.map(x => x.t);
    const data = poolHist.map(x => x.v);

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: t('pool.chartLabel'),
          data,
          borderColor: '#14F195',
          backgroundColor: 'rgba(20,241,149,.07)',
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
  }, [poolHist, language]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pool.title')}</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('pool.total')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(total, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('pool.available')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(poolBalance, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('pool.solvency')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{ratio}%</span>
          </SummaryRow>
        </div>
        <div style={{ height: 100, marginTop: 8 }}>
          <canvas ref={canvasRef} />
        </div>
      </CardBody>
    </Card>
  );
}
