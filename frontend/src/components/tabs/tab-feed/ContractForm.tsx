import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardBody, Button, FormGroup, FormLabel, FormInput, FormSelect, Divider } from '@/components/common';
import { useProtocolStore, FLIGHTS, FLIGHT_ROUTES, NAMES, DATES } from '@/store/useProtocolStore';
import { useToast } from '@/components/common';

export function ContractForm() {
  const { t } = useTranslation();
  const { masterActive, addContract } = useProtocolStore();
  const { toast } = useToast();
  const [name, setName] = useState('홍길동');
  const [flight, setFlight] = useState<string>('KE081');
  const [date, setDate] = useState('2026-01-15');
  const [autoRunning, setAutoRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAdd = useCallback(() => {
    if (!masterActive) { toast(t('toast.afterActivation'), 'w'); return; }
    addContract(name, flight, date);
  }, [masterActive, name, flight, date, addContract, toast]);

  const handleAutoFeed = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setAutoRunning(false);
      return;
    }
    if (!masterActive) { toast(t('toast.afterActivation'), 'w'); return; }
    setAutoRunning(true);
    timerRef.current = setInterval(() => {
      const nm = NAMES[Math.floor(Math.random() * NAMES.length)]! + (Math.floor(Math.random() * 900) + 100);
      const fl = FLIGHTS[Math.floor(Math.random() * FLIGHTS.length)]!;
      const dt = DATES[Math.floor(Math.random() * DATES.length)]!;
      useProtocolStore.getState().addContract(nm, fl, dt);
    }, 1000);
  }, [autoRunning, masterActive, toast]);

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
          <FormInput value="1 USDC" readOnly style={{ opacity: 0.6, fontFamily: "'DM Mono', monospace" }} />
        </FormGroup>
        <Divider />
        <Button variant="primary" fullWidth onClick={handleAdd} disabled={!masterActive} style={{ marginBottom: 6 }}>
          {t('feed.addBtn')}
        </Button>
        <Button variant={autoRunning ? 'danger' : 'accent'} fullWidth onClick={handleAutoFeed}>
          {autoRunning ? t('feed.autoStop') : t('feed.autoStart')}
        </Button>
        <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 5, textAlign: 'center' }}>
          {autoRunning ? t('feed.autoRunning') : t('feed.afterActivation')}
        </div>
      </CardBody>
    </Card>
  );
}
