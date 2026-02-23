import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Global, ThemeProvider } from '@emotion/react';
import { globalStyles } from '@/styles/globalStyles';
import { theme } from '@/styles/theme';
import { SolanaProvider } from '@/providers/SolanaProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { ToastProvider } from '@/components/common';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { useProtocolStore } from '@/store/useProtocolStore';
import { useEffect } from 'react';

function InitLogger() {
  const { addLog, logs } = useProtocolStore();
  useEffect(() => {
    if (logs.length === 0) {
      addLog('OpenParametric Protocol 초기화. Solana Devnet.', '#9945FF', 'system_init', '1단계: 마스터 계약 설정 → 약관 세팅을 클릭하세요.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </SolanaProvider>
    </QueryProvider>
  );
}
