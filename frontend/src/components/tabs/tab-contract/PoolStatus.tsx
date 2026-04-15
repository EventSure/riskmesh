import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Card, CardHeader, CardTitle, CardBody, SummaryRow, Tag } from '@/components/common';
import { useProtocolStore, formatNum } from '@/store/useProtocolStore';
import { useProgram } from '@/hooks/useProgram';
import { useMasterAgreementAccount } from '@/hooks/useMasterAgreementAccount';
import { Chart, registerables } from 'chart.js';
import { useTranslation } from 'react-i18next';

Chart.register(...registerables);

const MIN_COLLATERAL_CASE_COUNT = 100;
const BPS_DENOM = 10_000;

type PoolHealthRow = {
  label: string;
  current: number;
  required: number;
  paid: boolean;
};

function splitByBps(totalRaw: number, ratiosBps: number[]): number[] {
  if (ratiosBps.length === 0) return [];

  const parts = ratiosBps.map((ratio) => Math.floor((totalRaw * ratio) / BPS_DENOM));
  const allocated = parts.reduce((sum, v) => sum + v, 0);
  parts[0] = parts[0] + (totalRaw - allocated);
  return parts;
}

export function PoolStatus() {
  const { mode, masterAgreementPDA, poolBalance, totalClaim, poolHist, poolRefreshKey, setPoolBalance } = useProtocolStore();
  const { connection } = useProgram();
  const { t, i18n: { language } } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null);
  const [poolRows, setPoolRows] = useState<PoolHealthRow[]>([]);

  const pdaKey = useMemo(
    () => mode === 'onchain' && masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null,
    [mode, masterAgreementPDA],
  );
  const { account: masterData } = useMasterAgreementAccount(pdaKey);

  const fetchOnChainBalance = useCallback(async () => {
    if (mode !== 'onchain' || !masterData || !connection) {
      setOnChainBalance(null);
      setPoolRows([]);
      return;
    }

    try {
      let total = 0;

      const maxPayoutRaw = Number(masterData.payoutDelay6hOrCancelled.toNumber());
      const totalRequiredRaw = maxPayoutRaw * MIN_COLLATERAL_CASE_COUNT;
      const reinsurerRequiredRaw = Math.floor((totalRequiredRaw * masterData.reinsurerEffectiveBps) / BPS_DENOM);
      const insurerRequiredRaw = totalRequiredRaw - reinsurerRequiredRaw;

      const participantShareBps = masterData.participants.map((p) => p.shareBps);
      const participantRequiredRaw = splitByBps(insurerRequiredRaw, participantShareBps);

      const rows: PoolHealthRow[] = [];

      try {
        const reinBal = await connection.getTokenAccountBalance(masterData.reinsurerPoolWallet);
        const reinUi = Number(reinBal.value.uiAmount ?? 0);
        total += reinUi;
        rows.push({
          label: 'Reinsurer',
          current: reinUi,
          required: reinsurerRequiredRaw / 1_000_000,
          paid: Number(reinBal.value.amount) >= reinsurerRequiredRaw,
        });
      } catch {
        rows.push({ label: 'Reinsurer', current: 0, required: reinsurerRequiredRaw / 1_000_000, paid: false });
      }

      for (let i = 0; i < masterData.participants.length; i += 1) {
        const p = masterData.participants[i]!;
        const requiredRaw = participantRequiredRaw[i] ?? 0;
        const label = i === 0 ? 'Leader' : `Participant ${i}`;

        if (!p.poolWallet.equals(PublicKey.default)) {
          try {
            const bal = await connection.getTokenAccountBalance(p.poolWallet);
            const ui = Number(bal.value.uiAmount ?? 0);
            total += ui;
            rows.push({
              label,
              current: ui,
              required: requiredRaw / 1_000_000,
              paid: Number(bal.value.amount) >= requiredRaw,
            });
            continue;
          } catch {
            // fallthrough
          }
        }

        rows.push({ label, current: 0, required: requiredRaw / 1_000_000, paid: false });
      }

      setPoolRows(rows);
      setOnChainBalance(total);
      setPoolBalance(total);
    } catch {
      setOnChainBalance(null);
      setPoolRows([]);
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

        {mode === 'onchain' && poolRows.length > 0 && (
          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--sub)', borderBottom: '1px solid var(--border)', background: 'var(--card2)' }}>
              {t('pool.participantFundingTitle', { count: MIN_COLLATERAL_CASE_COUNT })}
            </div>
            {poolRows.map((row) => (
              <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 92px', gap: 6, alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10 }}>{row.label}</span>
                <span style={{ fontSize: 10, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{formatNum(row.current, 2)}</span>
                <span style={{ fontSize: 10, textAlign: 'right', fontFamily: "'DM Mono', monospace", color: 'var(--sub)' }}>{formatNum(row.required, 2)}</span>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Tag variant={row.paid ? 'accent' : 'warning'}>{row.paid ? t('pool.paid') : t('pool.pending')}</Tag>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 100, marginTop: 8 }}>
          <canvas ref={canvasRef} />
        </div>
      </CardBody>
    </Card>
  );
}
