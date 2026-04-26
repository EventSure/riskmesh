import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Global, ThemeProvider } from '@emotion/react';
import { globalStyles } from '@/styles/globalStyles';
import { darkTheme, lightTheme } from '@/styles/theme';
import { useThemeMode } from '@/hooks/useThemeMode';
import { ThemeModeContext } from '@/context/ThemeModeContext';
import { SolanaProvider } from '@/providers/SolanaProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { ToastProvider } from '@/components/common';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { LandingPage } from '@/pages/LandingPage';
import { PortalPage } from '@/pages/PortalPage';
import { InsurancePage } from '@/pages/InsurancePage';
import { useProtocolStore, type LogEntry } from '@/store/useProtocolStore';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMasterAgreementAccount } from '@/hooks/useMasterAgreementAccount';
import { useFlightPolicies, type FlightPolicyWithKey } from '@/hooks/useFlightPolicies';
import { useToast } from '@/components/common';
import { fetchMasterAgreementDisplayNames } from '@/services/insurerApi';

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
  const masterAgreementPDA = useProtocolStore(s => s.masterAgreementPDA);
  const syncMasterFromChain = useProtocolStore(s => s.syncMasterFromChain);
  const applyMasterAgreementDisplayNames = useProtocolStore(s => s.applyMasterAgreementDisplayNames);
  const syncFlightPoliciesFromChain = useProtocolStore(s => s.syncFlightPoliciesFromChain);
  const addLog = useProtocolStore(s => s.addLog);

  const pdaKey = useMemo(
    () => mode === 'onchain' && masterAgreementPDA ? new PublicKey(masterAgreementPDA) : null,
    [mode, masterAgreementPDA],
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

  const { account } = useMasterAgreementAccount(pdaKey);
  const { policies } = useFlightPolicies(pdaKey, { onStatusChange: handleStatusChange });

  useEffect(() => {
    if (!account) return;

    let cancelled = false;

    const syncAccount = async () => {
      if (masterAgreementPDA) {
        try {
          const response = await fetchMasterAgreementDisplayNames(masterAgreementPDA);
          if (!cancelled) {
            applyMasterAgreementDisplayNames({
              participants: response.participants.map(({ wallet, display_name }) => ({
                wallet,
                displayName: display_name,
              })),
              reinsurer: response.reinsurer
                ? {
                  wallet: response.reinsurer.wallet,
                  displayName: response.reinsurer.display_name,
                }
                : null,
            });
          }
        } catch {
          // Fall back to local naming when backend metadata is unavailable.
        }
      }

      if (!cancelled) syncMasterFromChain(account);
    };

    void syncAccount();

    return () => {
      cancelled = true;
    };
  }, [account, masterAgreementPDA, applyMasterAgreementDisplayNames, syncMasterFromChain]);

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
  const { mode, toggle } = useThemeMode();
  const currentTheme = mode === 'dark' ? darkTheme : lightTheme;
  return (
    <ThemeModeContext.Provider value={{ mode, toggle }}>
    <QueryProvider>
      <SolanaProvider>
        <ThemeProvider theme={currentTheme}>
          <Global styles={globalStyles} />
          <ToastProvider>
            <InitLogger />
            <ChainSyncer />
            <BrowserRouter basename="/riskmesh">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                </Route>
                <Route path="/portal" element={<PortalPage />} />
                <Route path="/insurance" element={<InsurancePage />} />
<Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </SolanaProvider>
    </QueryProvider>
    </ThemeModeContext.Provider>
  );
}
