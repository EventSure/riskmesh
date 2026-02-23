import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Global, ThemeProvider } from '@emotion/react';
import { globalStyles } from '@/styles/globalStyles';
import { theme } from '@/styles/theme';
import { SolanaProvider } from '@/providers/SolanaProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';

export function App() {
  return (
    <QueryProvider>
      <SolanaProvider>
        <ThemeProvider theme={theme}>
          <Global styles={globalStyles} />
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </SolanaProvider>
    </QueryProvider>
  );
}
