import { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { useProtocolStore } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';
import { useTranslation } from 'react-i18next';

Chart.register(...registerables);

export function SettlementChart() {
  const { t, i18n: { language } } = useTranslation();
  const { acc, totalPremium, totalClaim, cededRatioBps, reinsCommissionBps } = useProtocolStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const ceded = cededRatioBps / 10000;
  const commRate = reinsCommissionBps / 10000;
  const reinsEff = ceded * (1 - commRate);

  const rPNet = totalPremium * reinsEff;
  const rCNet = -totalClaim * reinsEff;

  const rows = [
    { label: t('settle.party.leader'), net: acc.leaderPrem - acc.leaderClaim },
    { label: t('settle.party.partA'), net: acc.partAPrem - acc.partAClaim },
    { label: t('settle.party.partB'), net: acc.partBPrem - acc.partBClaim },
    { label: t('settle.party.reinsurer'), net: rPNet + rCNet },
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
          label: t('settle.finalTh.pl'),
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
  }, [acc, totalPremium, totalClaim, cededRatioBps, reinsCommissionBps, language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardHeader><CardTitle>{t('settle.chartTitle')}</CardTitle></CardHeader>
      <CardBody style={{ padding: 10 }}>
        <div style={{ height: 140 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
