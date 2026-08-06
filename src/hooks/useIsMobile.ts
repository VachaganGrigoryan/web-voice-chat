import { useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT } from '@/features/chat/utils/chatLayoutUtils';

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * The single viewport hook. Uses matchMedia rather than a resize listener so it
 * fires only on an actual breakpoint crossing instead of on every resize frame.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(QUERY);
    const updateMatch = () => setIsMobile(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);
    return () => mediaQuery.removeEventListener('change', updateMatch);
  }, []);

  return isMobile;
}
