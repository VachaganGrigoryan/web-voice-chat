import { create } from 'zustand';
import type { NavigateFunction } from 'react-router-dom';
import { APP_ROUTES } from '@/app/routes';

type RouteChangeAction = 'POP' | 'PUSH' | 'REPLACE';
type BackFallback =
  | string
  | null
  | undefined
  | ((currentRoute: string) => string | null | undefined);

interface AppNavigationState {
  currentRoute: string;
  routeStack: string[];
  navigate: NavigateFunction | null;
}

export interface AppBackOptions {
  fallback?: BackFallback;
}

export interface AppNavigateOptions {
  replace?: boolean;
}

const isChatPeerRoute = (path: string) => /^\/chat\/[^/]+$/.test(getPathname(path));

const normalizeRoute = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) {
    return APP_ROUTES.root;
  }

  if (trimmed.startsWith('#/')) {
    return trimmed.slice(1);
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  if (trimmed.startsWith('#')) {
    return `/${trimmed.slice(1)}`;
  }

  return `/${trimmed}`;
};

const getPathname = (path: string) => normalizeRoute(path).split('?')[0] || APP_ROUTES.root;

const shouldReplaceTopRoute = (currentTop: string, nextRoute: string) => {
  if (isChatPeerRoute(currentTop) && isChatPeerRoute(nextRoute)) {
    return true;
  }

  return false;
};

const syncPushedRoute = (stack: string[], nextRoute: string) => {
  if (stack.length === 0) {
    return [nextRoute];
  }

  const currentTop = stack[stack.length - 1];
  if (currentTop === nextRoute) {
    return stack;
  }

  const previousRoute = stack.length > 1 ? stack[stack.length - 2] : null;
  if (previousRoute === nextRoute) {
    return stack.slice(0, -1);
  }

  if (shouldReplaceTopRoute(currentTop, nextRoute)) {
    return [...stack.slice(0, -1), nextRoute];
  }

  const existingIndex = stack.lastIndexOf(nextRoute);
  if (existingIndex !== -1) {
    return stack.slice(0, existingIndex + 1);
  }

  return [...stack, nextRoute];
};

const syncReplacedRoute = (stack: string[], nextRoute: string) => {
  if (stack.length === 0) {
    return [nextRoute];
  }

  const baseStack = stack.slice(0, -1);
  const existingIndex = baseStack.lastIndexOf(nextRoute);
  if (existingIndex !== -1) {
    return baseStack.slice(0, existingIndex + 1);
  }

  return [...baseStack, nextRoute];
};

const syncPoppedRoute = (stack: string[], nextRoute: string) => {
  if (stack.length === 0) {
    return [nextRoute];
  }

  const currentTop = stack[stack.length - 1];
  if (currentTop === nextRoute) {
    return stack;
  }

  const previousRoute = stack.length > 1 ? stack[stack.length - 2] : null;
  if (previousRoute === nextRoute) {
    return stack.slice(0, -1);
  }

  const existingIndex = stack.lastIndexOf(nextRoute);
  if (existingIndex !== -1) {
    return stack.slice(0, existingIndex + 1);
  }

  return [nextRoute];
};

const syncRouteStack = (stack: string[], nextRoute: string, action: RouteChangeAction) => {
  const normalizedRoute = normalizeRoute(nextRoute);

  if (action === 'POP') {
    return syncPoppedRoute(stack, normalizedRoute);
  }

  if (action === 'REPLACE') {
    return syncReplacedRoute(stack, normalizedRoute);
  }

  return syncPushedRoute(stack, normalizedRoute);
};

const resolveDefaultBackFallback = (path: string) => {
  const pathname = getPathname(path);

  const threadMatch = pathname.match(/^\/chat\/([^/]+)\/thread\/[^/]+$/);
  if (threadMatch) {
    return APP_ROUTES.chatPeer(threadMatch[1]);
  }

  if (/^\/chat\/[^/]+$/.test(pathname)) {
    return APP_ROUTES.chat;
  }

  if (/^\/settings\/[^/]+$/.test(pathname) && pathname !== APP_ROUTES.settingsTab('profile')) {
    return APP_ROUTES.settingsTab('profile');
  }

  if (pathname === APP_ROUTES.settings || pathname === APP_ROUTES.settingsTab('profile')) {
    return APP_ROUTES.chat;
  }

  if (/^\/pings\/[^/]+$/.test(pathname) && pathname !== APP_ROUTES.pingsTab('incoming')) {
    return APP_ROUTES.pingsTab('incoming');
  }

  if (pathname === APP_ROUTES.pings || pathname === APP_ROUTES.pingsTab('incoming')) {
    return APP_ROUTES.chat;
  }

  if (/^\/profile\/[^/]+$/.test(pathname)) {
    return APP_ROUTES.chat;
  }

  if (/^\/invite\/[^/]+$/.test(pathname)) {
    return APP_ROUTES.root;
  }

  if (pathname === APP_ROUTES.legacyLogin) {
    return APP_ROUTES.auth;
  }

  return null;
};

const resolveBackFallback = (currentRoute: string, fallback?: BackFallback) => {
  const customTarget = typeof fallback === 'function' ? fallback(currentRoute) : fallback;
  if (customTarget) {
    return normalizeRoute(customTarget);
  }

  return resolveDefaultBackFallback(currentRoute);
};

const getAlignedStack = (stack: string[], currentRoute: string) => {
  if (!currentRoute) {
    return stack;
  }

  if (stack[stack.length - 1] === currentRoute) {
    return stack;
  }

  return syncPushedRoute(stack, currentRoute);
};

const getBackTarget = (currentRoute: string, stack: string[], fallback?: BackFallback) => {
  const alignedStack = getAlignedStack(stack, currentRoute);

  if (alignedStack.length > 1) {
    return alignedStack[alignedStack.length - 2];
  }

  return resolveBackFallback(currentRoute, fallback);
};

export const getRouteFromLocation = (pathname: string, search = '') =>
  normalizeRoute(`${pathname}${search}`);

export const useAppNavigationStore = create<AppNavigationState>(() => ({
  currentRoute: APP_ROUTES.root,
  routeStack: [],
  navigate: null,
}));

const syncRoute = (route: string, action: RouteChangeAction) => {
  const normalizedRoute = normalizeRoute(route);
  useAppNavigationStore.setState((state) => ({
    currentRoute: normalizedRoute,
    routeStack: syncRouteStack(state.routeStack, normalizedRoute, action),
  }));
};

const setNavigate = (navigate: NavigateFunction | null) => {
  useAppNavigationStore.setState({ navigate });
};

const clearNavigate = (navigate?: NavigateFunction) => {
  const currentNavigate = useAppNavigationStore.getState().navigate;
  if (!navigate || currentNavigate === navigate) {
    useAppNavigationStore.setState({ navigate: null });
  }
};

const goTo = (route: string, options: AppNavigateOptions = {}) => {
  const navigate = useAppNavigationStore.getState().navigate;
  if (!navigate) {
    return false;
  }

  navigate(normalizeRoute(route), { replace: options.replace });
  return true;
};

const goBack = (options: AppBackOptions = {}) => {
  const state = useAppNavigationStore.getState();
  const currentRoute = normalizeRoute(state.currentRoute);
  const backTarget = getBackTarget(currentRoute, state.routeStack, options.fallback);

  if (!state.navigate || !backTarget || backTarget === currentRoute) {
    return false;
  }

  syncRoute(backTarget, 'POP');
  state.navigate(backTarget, { replace: true });
  return true;
};

const canGoBack = (options: AppBackOptions = {}) => {
  const state = useAppNavigationStore.getState();
  const currentRoute = normalizeRoute(state.currentRoute);
  const backTarget = getBackTarget(currentRoute, state.routeStack, options.fallback);

  return !!backTarget && backTarget !== currentRoute;
};

export const appNavigation = {
  setNavigate,
  clearNavigate,
  syncRoute,
  goTo,
  replace: (route: string) => goTo(route, { replace: true }),
  goBack,
  canGoBack,
};

export const useAppNavigation = () => {
  const currentRoute = useAppNavigationStore((state) => state.currentRoute);
  const routeStack = useAppNavigationStore((state) => state.routeStack);

  return {
    currentRoute,
    routeStack,
    goTo,
    replace: (route: string) => goTo(route, { replace: true }),
    goBack,
    canGoBack,
  };
};
