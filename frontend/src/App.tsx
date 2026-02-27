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
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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
