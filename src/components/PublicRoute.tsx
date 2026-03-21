import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getDefaultAuthedPath } from '@/app/routes';
import { useAuthStore } from '@/store/authStore';

export default function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (isAuthenticated) {
    const redirectTarget = new URLSearchParams(location.search).get('redirect') || getDefaultAuthedPath();
    return <Navigate to={redirectTarget} replace />;
  }

  return <Outlet />;
}
