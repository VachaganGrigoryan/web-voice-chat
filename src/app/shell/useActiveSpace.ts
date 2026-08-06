import { create } from 'zustand';

const ACTIVE_SPACE_STORAGE_KEY = 'voca:active-space';

const readActiveSpace = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_SPACE_STORAGE_KEY);
};

interface ActiveSpaceState {
  activeSpaceId: string | null;
  setActiveSpaceId: (spaceId: string | null) => void;
}

/**
 * The space puck scopes the whole shell, not just the chat inbox, so the
 * selection lives above the route rather than inside ChatLayout.
 */
export const useActiveSpace = create<ActiveSpaceState>((set) => ({
  activeSpaceId: readActiveSpace(),

  setActiveSpaceId: (spaceId) => {
    if (typeof window !== 'undefined') {
      if (spaceId) {
        window.localStorage.setItem(ACTIVE_SPACE_STORAGE_KEY, spaceId);
      } else {
        window.localStorage.removeItem(ACTIVE_SPACE_STORAGE_KEY);
      }
    }
    set({ activeSpaceId: spaceId });
  },
}));
