import { useState, useRef, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, FormSelect, Divider } from '@/components/common';
import { useProtocolStore, FLIGHTS, FLIGHT_ROUTES, NAMES, DATES } from '@/store/useProtocolStore';
import { CURRENCY_MINT } from '@/lib/constants';
import { useToast } from '@/components/common';
import { useCreateFlightPolicy } from '@/hooks/useCreateFlightPolicy';
import { useProgram } from '@/hooks/useProgram';

export function ContractForm() {
  const { t } = useTranslation();
  const { mode, masterActive, masterPolicyPDA, contractCount, premiumPerPolicy, addContract, onChainAddContract } = useProtocolStore();
  const { toast } = useToast();
  const { createFlightPolicy, loading } = useCreateFlightPolicy();
  const { wallet } = useProgram();
  const [name, setName] = useState('홍길동');
  const [flight, setFlight] = useState<string>('KE081');
  const [date, setDate] = useState('2026-01-15');
  const [autoRunning, setAutoRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAdd = useCallback(async () => {
    if (!masterActive) { toast(t('toast.afterActivation'), 'w'); return; }

    if (mode === 'simulation') {
      addContract(name, flight, date);
      return;
    }

    // On-chain mode
    if (!masterPolicyPDA || !wallet) {
      toast('Wallet or master policy not available', 'd');
      return;
    }

    const childId = contractCount + 1;
    const route = FLIGHT_ROUTES[flight] || 'ICN→JFK';
    const departureTs = Math.floor(new Date(date).getTime() / 1000);
    const walletATA = await getAssociatedTokenAddress(CURRENCY_MINT, wallet.publicKey);

    const result = await createFlightPolicy({
      masterPolicy: new PublicKey(masterPolicyPDA),
      childPolicyId: childId,
      subscriberRef: name,
      flightNo: flight,
      route,
      departureTs,
      payerToken: walletATA,
      leaderDepositToken: walletATA,
    });

    if (!result.success) {
      toast(`TX failed: ${result.error}`, 'd');
      return;
    }

    onChainAddContract(childId, name, flight, date, result.signature);
    toast(`Flight policy created! TX: ${result.signature.slice(0, 8)}...`, 's');
  }, [mode, masterActive, name, flight, date, masterPolicyPDA, wallet, contractCount, addContract, onChainAddContract, createFlightPolicy, toast, t]);

  const handleAutoFeed = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setAutoRunning(false);
      return;
    }
    if (!masterActive) { toast(t('toast.afterActivation'), 'w'); return; }
    if (mode === 'onchain') { toast('Auto-feed not available in on-chain mode', 'w'); return; }
    setAutoRunning(true);
    timerRef.current = setInterval(() => {
      const nm = NAMES[Math.floor(Math.random() * NAMES.length)]! + (Math.floor(Math.random() * 900) + 100);
      const fl = FLIGHTS[Math.floor(Math.random() * FLIGHTS.length)]!;
      const dt = DATES[Math.floor(Math.random() * DATES.length)]!;
      useProtocolStore.getState().addContract(nm, fl, dt);
    }, 1000);
  }, [autoRunning, masterActive, mode, toast, t]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <Card>
      <CardHeader><CardTitle>{t('feed.formTitle')}</CardTitle></CardHeader>
      <CardBody>
        <FormGroup>
          <FormLabel>{t('feed.name')}</FormLabel>
          <FormInput value={name} onChange={e => setName(e.target.value)} />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('feed.flight')}</FormLabel>
          <FormSelect value={flight} onChange={e => setFlight(e.target.value)} style={{ cursor: 'pointer' }}>
            {FLIGHTS.map(f => <option key={f} value={f}>{f} ({FLIGHT_ROUTES[f]})</option>)}
          </FormSelect>
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('feed.date')}</FormLabel>
          <FormInput type="date" value={date} onChange={e => setDate(e.target.value)} />
        </FormGroup>
        <FormGroup>
          <FormLabel>{t('feed.premium')}</FormLabel>
          <FormInput value={`${premiumPerPolicy} USDC`} readOnly style={{ opacity: 0.6, fontFamily: "'DM Mono', monospace" }} />
        </FormGroup>
        <Divider />
        <Button variant="primary" fullWidth onClick={handleAdd} disabled={!masterActive || loading} style={{ marginBottom: 6 }}>
          {loading ? 'Sending TX...' : t('feed.addBtn')}
        </Button>
        <Button variant={autoRunning ? 'danger' : 'accent'} fullWidth onClick={handleAutoFeed} disabled={mode === 'onchain'}>
          {autoRunning ? t('feed.autoStop') : t('feed.autoStart')}
        </Button>
        <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 5, textAlign: 'center' }}>
          {mode === 'onchain' ? 'On-chain mode: manual add only' : autoRunning ? t('feed.autoRunning') : t('feed.afterActivation')}
        </div>
      </CardBody>
    </Card>
  );
}
