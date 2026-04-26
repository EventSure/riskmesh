import { Outlet } from 'react-router-dom';
import styled from '@emotion/styled';
import { AdminHeader } from './AdminHeader';

const AppFrame = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`;

export function Layout() {
  return (
    <AppFrame>
      <AdminHeader />
      <Outlet />
    </AppFrame>
  );
}
