import { Outlet } from 'react-router-dom';
import { AdminHeader } from './AdminHeader';

export function Layout() {
  return (
    <>
      <AdminHeader />
      <Outlet />
    </>
  );
}
