import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { APP_ROUTES, getAuthRedirectTarget, setLastAppPath } from '@/app/routes';
import { useAuthStore } from '@/store/authStore';

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  if (!isAuthenticated) {
    return <Navigate to={getAuthRedirectTarget(currentPath)} replace />;
  }

  setLastAppPath(currentPath || APP_ROUTES.chat);
  return <Outlet />;
}
