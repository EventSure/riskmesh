import styled from '@emotion/styled';
import type { ReactNode } from 'react';

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${p => p.theme.colors.bg};
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
`;

const Sidebar = styled.aside`
  width: 200px;
  flex-shrink: 0;
  background: ${p => p.theme.colors.card2};
  border-right: 1px solid ${p => p.theme.colors.border};
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  min-height: calc(100vh - 48px);
`;

const Main = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  min-height: 0;
`;

interface PortalShellProps {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

export function PortalShell({ header, sidebar, children }: PortalShellProps) {
  return (
    <Shell>
      {header}
      <Body>
        <Sidebar>{sidebar}</Sidebar>
        <Main>{children}</Main>
      </Body>
    </Shell>
  );
}
