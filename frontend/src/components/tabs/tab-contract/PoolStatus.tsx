import { useEffect, useRef, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useProgram } from '@/hooks/useProgram';
import { Chart, registerables } from 'chart.js';
import { useTranslation } from 'react-i18next';

Chart.register(...registerables);

export function PoolStatus() {
  const { mode, masterPolicyPDA, poolBalance, totalClaim, poolHist, poolRefreshKey } = useProtocolStore();
  const { program, connection } = useProgram();
  const { t, i18n: { language } } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null);

  const fetchOnChainBalance = useCallback(async () => {
    if (mode !== 'onchain' || !masterPolicyPDA || !program || !connection) {
      setOnChainBalance(null);
      return;
    }
    try {
      const masterPK = new PublicKey(masterPolicyPDA);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const masterData = await (program as any).account.masterPolicy.fetch(masterPK);

      let total = 0;
      // reinsurer pool 잔액
      try {
        const reinBal = await connection.getTokenAccountBalance(masterData.reinsurerPoolWallet);
        total += Number(reinBal.value.uiAmount ?? 0);
      } catch { /* not funded yet */ }

      // 각 참여사 pool 잔액
      for (const p of masterData.participants) {
        if (!p.poolWallet.equals(PublicKey.default)) {
          try {
            const bal = await connection.getTokenAccountBalance(p.poolWallet);
            total += Number(bal.value.uiAmount ?? 0);
          } catch { /* not registered yet */ }
        }
      }
      setOnChainBalance(total);
    } catch {
      setOnChainBalance(null);
    }
  }, [mode, masterPolicyPDA, program, connection, poolRefreshKey]);

  useEffect(() => { fetchOnChainBalance(); }, [fetchOnChainBalance]);

  const isOnChain = mode === 'onchain' && onChainBalance !== null;
  const displayBalance = isOnChain ? onChainBalance : poolBalance;
  const displayTotal = isOnChain ? onChainBalance : poolBalance + totalClaim;
  const ratio = isOnChain
    ? (displayTotal > 0 ? formatNum((displayBalance / displayTotal) * 100, 1) : '100.0')
    : formatNum((poolBalance / 10000) * 100, 1);

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
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(displayTotal, 2)} USDC</span>
          </SummaryRow>
          <SummaryRow style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>{t('pool.available')}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>{formatNum(displayBalance, 2)} USDC</span>
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
