import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export function ClaimSettlementSummary() {
  const { t, i18n: { language } } = useTranslation();
  const { totalClaim, claims } = useProtocolStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  // rNet = totRC - clComm (net reinsurer burden after commission rebate to primary)
  const reinBurden   = claims.reduce((s, c) => s + c.rNet, 0);
  const leaderBurden = claims.reduce((s, c) => s + c.lNet, 0);
  const partABurden  = claims.reduce((s, c) => s + c.aNet, 0);
  const partBBurden  = claims.reduce((s, c) => s + c.bNet, 0);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: [
          t('claim.chartLeader'),
          t('claim.chartPartA'),
          t('claim.chartPartB'),
          t('claim.chartReinsurer'),
        ],
        datasets: [{
          data: [leaderBurden, partABurden, partBBurden, reinBurden],
          backgroundColor: [
            'rgba(153,69,255,.7)',
            'rgba(20,241,149,.7)',
            'rgba(245,158,11,.7)',
            'rgba(56,189,248,.7)',
          ],
          borderColor: ['#9945FF', '#14F195', '#F59E0B', '#38BDF8'],
          borderWidth: 1.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'right', labels: { color: '#94A3B8', font: { family: 'DM Mono', size: 9 }, padding: 5, boxWidth: 8 } } },
        animation: { duration: 300 },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [leaderBurden, partABurden, partBBurden, reinBurden, language]);

  return (
    <Card style={{ marginTop: 10 }}>
      <CardHeader><CardTitle>{t('claim.summaryTitle')}</CardTitle></CardHeader>
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 7 }}>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.totalPaid')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(totalClaim, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.chartLeader')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: '#9945FF' }}>{formatNum(leaderBurden, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.chartPartA')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: '#14F195' }}>{formatNum(partABurden, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.chartPartB')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: '#F59E0B' }}>{formatNum(partBBurden, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.reinBurden')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: '#38BDF8' }}>{formatNum(reinBurden, 2)} USDC</span>
          </SummaryRow>
        </div>
        <div style={{ height: 120, marginTop: 8 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
