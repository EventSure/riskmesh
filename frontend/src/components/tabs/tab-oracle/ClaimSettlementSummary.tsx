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

  const totRC = claims.reduce((s, c) => s + c.totRC, 0);
  const direct = totalClaim - totRC;

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'doughnut',
      data: {
        labels: [t('claim.chartPrimary'), t('claim.chartReinsurer')],
        datasets: [{
          data: [direct, totRC],
          backgroundColor: ['rgba(153,69,255,.7)', 'rgba(56,189,248,.7)'],
          borderColor: ['#9945FF', '#38BDF8'],
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
  }, [direct, totRC, language]);

  return (
    <Card style={{ marginTop: 10 }}>
      <CardHeader><CardTitle>{t('claim.summaryTitle')}</CardTitle></CardHeader>
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7 }}>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.totalPaid')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(totalClaim, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.primaryBurden')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(direct, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('claim.reinBurden')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(totRC, 2)} USDC</span>
          </SummaryRow>
        </div>
        <div style={{ height: 120, marginTop: 8 }}><canvas ref={canvasRef} /></div>
      </CardBody>
    </Card>
  );
}
