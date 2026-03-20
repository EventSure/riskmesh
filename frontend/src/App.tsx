import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Global, ThemeProvider } from '@emotion/react';
import { globalStyles } from '@/styles/globalStyles';
import { theme } from '@/styles/theme';
import { SolanaProvider } from '@/providers/SolanaProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { ToastProvider } from '@/components/common';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { LandingPage } from '@/pages/LandingPage';
import { useProtocolStore, type LogEntry } from '@/store/useProtocolStore';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMasterPolicyAccount } from '@/hooks/useMasterPolicyAccount';
import { useFlightPolicies, type FlightPolicyWithKey } from '@/hooks/useFlightPolicies';
import { useToast } from '@/components/common';

const STATUS_NAMES: Record<number, string> = {
  0: 'Issued', 1: 'AwaitingOracle', 2: 'Claimable', 3: 'Paid', 4: 'NoClaim', 5: 'Expired',
};

function ChainSyncer() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { publicKey } = useWallet();
  useEffect(() => {
    console.log('[Wallet] publicKey:', publicKey?.toBase58() ?? 'not connected');
  }, [publicKey]);
  const mode = useProtocolStore(s => s.mode);
  const masterPolicyPDA = useProtocolStore(s => s.masterPolicyPDA);
  const syncMasterFromChain = useProtocolStore(s => s.syncMasterFromChain);
  const syncFlightPoliciesFromChain = useProtocolStore(s => s.syncFlightPoliciesFromChain);
  const addLog = useProtocolStore(s => s.addLog);

  const pdaKey = useMemo(
    () => mode === 'onchain' && masterPolicyPDA ? new PublicKey(masterPolicyPDA) : null,
    [mode, masterPolicyPDA],
  );

  const handleStatusChange = useCallback((fp: FlightPolicyWithKey, prev: number, next: number) => {
    const name = `#${fp.account.childPolicyId.toNumber()} ${fp.account.flightNo}`;
    const fromLabel = STATUS_NAMES[prev] ?? String(prev);
    const toLabel = STATUS_NAMES[next] ?? String(next);

    toast(t('oracle.statusChanged', { flight: name, from: fromLabel, to: toLabel }), next === 2 ? 'w' : 's');
    addLog(
      `${name}: ${fromLabel} → ${toLabel}`,
      next === 2 ? '#F59E0B' : '#22C55E',
      'daemon_resolve',
    );
  }, [t, toast, addLog]);

  const { account } = useMasterPolicyAccount(pdaKey);
  const { policies } = useFlightPolicies(pdaKey, { onStatusChange: handleStatusChange });

  useEffect(() => {
    if (account) syncMasterFromChain(account);
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pdaKey) syncFlightPoliciesFromChain(policies);
  }, [policies]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function InitLogger() {
  const { t, i18n } = useTranslation();
  const didInit = useRef(false);

  useEffect(() => {
    const state = useProtocolStore.getState();

    if (!didInit.current && state.logs.length === 0) {
      // First mount: create init log
      didInit.current = true;
      const initLog: LogEntry = {
        id: 1, msg: t('app.initMsg'), color: '#9945FF',
        instruction: 'system_init', detail: t('app.initDetail'),
        time: new Date().toLocaleTimeString('ko-KR', { hour12: false }),
      };
      useProtocolStore.setState({ logs: [initLog], logIdCounter: 1 });
    } else {
      // Language changed: update all system_init log entries
      didInit.current = true;
      const updated = state.logs.map(l =>
        l.instruction === 'system_init'
          ? { ...l, msg: t('app.initMsg'), detail: t('app.initDetail') }
          : l,
      );
      useProtocolStore.setState({ logs: updated });
    }
  }, [i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function App() {
  return (
    <QueryProvider>
      <SolanaProvider>
        <ThemeProvider theme={theme}>
          <Global styles={globalStyles} />
          <ToastProvider>
            <InitLogger />
            <ChainSyncer />
            <BrowserRouter basename="/riskmesh">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route element={<Layout />}>
                  <Route path="/demo" element={<Dashboard />} />
                </Route>
                <Route path="/dashboard" element={<Navigate to="/demo" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </SolanaProvider>
    </QueryProvider>
  );
}
