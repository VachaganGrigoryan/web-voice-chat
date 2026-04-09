import { useEffect } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { appNavigation, getRouteFromLocation } from '@/navigation/appNavigation';

export default function AppNavigationSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();

  useEffect(() => {
    appNavigation.setNavigate(navigate);
    return () => {
      appNavigation.clearNavigate(navigate);
    };
  }, [navigate]);

  useEffect(() => {
    appNavigation.syncRoute(
      getRouteFromLocation(location.pathname, location.search),
      navigationType
    );
  }, [location.pathname, location.search, navigationType]);

  return null;
}
