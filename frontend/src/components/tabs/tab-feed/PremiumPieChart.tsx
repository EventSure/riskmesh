import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/common';
import { useProtocolStore, PARTICIPANT_COLORS, REINSURER_COLOR } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function PremiumPieChart() {
  const { t, i18n: { language } } = useTranslation();
  const acc = useProtocolStore(s => s.acc);
  const participants = useProtocolStore(s => s.participants);
  const reinsurer = useProtocolStore(s => s.reinsurer);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const data = [acc.leaderPrem, ...acc.participantPrems, ...(reinsurer.enabled ? [acc.reinPrem] : [])];
    const labels = [
      t('feed.th.leader'),
      ...participants.map((p, i) => p.name || `${t('feed.th.participant')}${i + 1}`),
      ...(reinsurer.enabled ? [t('feed.th.reinsurer')] : []),
    ];
    const colors = ['#9945FF', ...participants.map((_, i) => PARTICIPANT_COLORS[i] || '#14F195'), ...(reinsurer.enabled ? [REINSURER_COLOR] : [])];

    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets[0]!.data = data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ds = chartRef.current.data.datasets[0] as any;
      ds.backgroundColor = colors.map(c => c + '99');
      ds.borderColor = colors;
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
  }, [acc, participants, reinsurer.enabled, language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardHeader><CardTitle>{t('feed.pieTitle')}</CardTitle></CardHeader>
      <CardBody style={{ padding: 10 }}>
        <div style={{ height: 150 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
