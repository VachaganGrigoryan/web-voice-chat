import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { normalizePostAuthRedirect } from '@/app/routes';
import { useAuthStore } from '@/store/authStore';

export default function PublicRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (isAuthenticated) {
    const redirectTarget = normalizePostAuthRedirect(
      new URLSearchParams(location.search).get('redirect')
    );
    return <Navigate to={redirectTarget} replace />;
  }

  return <Outlet />;
}
