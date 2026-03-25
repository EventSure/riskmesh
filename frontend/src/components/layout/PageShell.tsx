import styled from '@emotion/styled';
import type { ReactNode } from 'react';

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${p => p.theme.colors.bg};
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
`;

interface PageShellProps {
  header: ReactNode;
  children: ReactNode;
}

export function PageShell({ header, children }: PageShellProps) {
  return (
    <Shell>
      {header}
      <Content>{children}</Content>
    </Shell>
  );
}
