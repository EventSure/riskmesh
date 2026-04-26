import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow } from '@/components/common';
import { PoolHealthVisual } from '@/components/tabs/shared/PoolHealthVisual';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useProgram } from '@/hooks/useProgram';
import { usePoolCollateralStatus } from '@/hooks/usePoolCollateralStatus';
import { Chart, registerables } from 'chart.js';
import { useTranslation } from 'react-i18next';

Chart.register(...registerables);

function rawMicroUsdcToNumber(amount: string): number {
  return Number(amount) / 1_000_000;
}

export function PoolStatus() {
  const { mode, masterAgreementPDA, poolBalance, totalClaim, poolHist, poolRefreshKey, setPoolBalance } = useProtocolStore();
  const { connection, wallet } = useProgram();
  const { t, i18n: { language } } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null);

  const pdaKey = useMemo(
    () => mode === 'onchain' && masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null,
    [mode, masterAgreementPDA],
  );
  const { status, activePartyId, masterData } = usePoolCollateralStatus(pdaKey, wallet?.publicKey ?? null);

  const fetchOnChainBalance = useCallback(async () => {
    if (mode !== 'onchain' || !masterData || !connection) {
      setOnChainBalance(null);
      return;
    }
    try {
      let total = 0;
      // reinsurer pool 잔액
      if (masterData.reinsurerPoolWallet) {
        try {
          const reinBal = await connection.getTokenAccountBalance(masterData.reinsurerPoolWallet);
          total += rawMicroUsdcToNumber(reinBal.value.amount);
        } catch { /* not funded yet */ }
      }

      // leader pool 잔액
      try {
        const leaderBal = await connection.getTokenAccountBalance(masterData.leaderPoolWallet);
        total += rawMicroUsdcToNumber(leaderBal.value.amount);
      } catch { /* not funded yet */ }

      // 각 참여사 pool 잔액
      for (const p of masterData.participants) {
        if (!p.poolWallet.equals(PublicKey.default)) {
          try {
            const bal = await connection.getTokenAccountBalance(p.poolWallet);
            total += rawMicroUsdcToNumber(bal.value.amount);
          } catch { /* not registered yet */ }
        }
      }
      setOnChainBalance(total);
      setPoolBalance(total);
    } catch {
      setOnChainBalance(null);
    }
  }, [mode, masterData, connection, poolRefreshKey, setPoolBalance]);

  useEffect(() => { fetchOnChainBalance(); }, [fetchOnChainBalance]);

  const isOnChain = mode === 'onchain' && onChainBalance !== null;
  const displayBalance = isOnChain ? onChainBalance : poolBalance;
  const displayTotal = displayBalance;
  const ratioBase = displayBalance + totalClaim;
  const ratio = ratioBase > 0
    ? formatNum((displayBalance / ratioBase) * 100, 1)
    : '100.0';

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
    <div style={{ display: 'grid', gap: 10 }}>
      {status ? (
        <PoolHealthVisual
          title={t('pool.healthTitle')}
          status={status}
          activePartyId={activePartyId}
        />
      ) : null}
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
    </div>
  );
}
