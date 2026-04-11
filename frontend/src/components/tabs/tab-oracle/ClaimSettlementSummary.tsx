import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow } from '@/components/common';
import { useProtocolStore, formatNum, PARTICIPANT_COLORS, REINSURER_COLOR } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function ClaimSettlementSummary() {
  const { t, i18n: { language } } = useTranslation();
  const { totalClaim, claims, participants, reinsurer } = useProtocolStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  const reinBurden   = claims.reduce((s, c) => s + c.rNet, 0);
  const leaderBurden = claims.reduce((s, c) => s + c.lNet, 0);
  const participantBurdens = participants.map((_, i) => claims.reduce((s, c) => s + (c.participantNets[i] ?? 0), 0));

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const labels = [
      t('claim.chartLeader'),
      ...participants.map((p, i) => p.name || `${t('claim.chartParticipant')}${i + 1}`),
      ...(reinsurer.enabled ? [t('claim.chartReinsurer')] : []),
    ];
    const data = [leaderBurden, ...participantBurdens, ...(reinsurer.enabled ? [reinBurden] : [])];
    const bgColors = [
      'rgba(153,69,255,.7)',
      ...participants.map((_, i) => (PARTICIPANT_COLORS[i] || '#14F195') + 'b3'),
      ...(reinsurer.enabled ? [REINSURER_COLOR + 'b3'] : []),
    ];
    const borderColors = ['#9945FF', ...participants.map((_, i) => PARTICIPANT_COLORS[i] || '#14F195'), ...(reinsurer.enabled ? [REINSURER_COLOR] : [])];

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 1.5 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'right', labels: { color: '#94A3B8', font: { family: 'DM Mono', size: 9 }, padding: 5, boxWidth: 8 } } },
        animation: { duration: 300 },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [leaderBurden, participantBurdens, reinBurden, participants, reinsurer.enabled, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaryItems = [
    { label: t('claim.totalPaid'), value: formatNum(totalClaim, 2), color: 'var(--accent)' },
    { label: t('claim.chartLeader'), value: formatNum(leaderBurden, 2), color: '#9945FF' },
    ...participants.map((p, i) => ({
      label: p.name || `${t('claim.chartParticipant')}${i + 1}`,
      value: formatNum(participantBurdens[i] ?? 0, 2),
      color: PARTICIPANT_COLORS[i] || '#14F195',
    })),
    ...(reinsurer.enabled ? [{ label: t('claim.reinBurden'), value: formatNum(reinBurden, 2), color: REINSURER_COLOR }] : []),
  ];

  return (
    <Card style={{ marginTop: 10 }}>
      <CardHeader><CardTitle>{t('claim.summaryTitle')}</CardTitle></CardHeader>
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${summaryItems.length}, 1fr)`, gap: 7 }}>
          {summaryItems.map(item => (
            <SummaryRow key={item.label} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--sub)' }}>{item.label}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: item.color }}>{item.value} USDC</span>
            </SummaryRow>
          ))}
        </div>
        <div style={{ height: 120, marginTop: 8 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
