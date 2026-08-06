import { create } from 'zustand';

type AppMode = 'chat' | 'social';

const MODE_STORAGE_KEY = 'voca:app-mode';
const MODE_PATHS_STORAGE_KEY = 'voca:app-mode-paths';

type ModePaths = Record<AppMode, string | null>;

const EMPTY_PATHS: ModePaths = { chat: null, social: null };

const homePathFor = (mode: AppMode) => (mode === 'social' ? '/feed' : '/chat');

const readMode = (): AppMode => {
  if (typeof window === 'undefined') return 'chat';
  const value = window.localStorage.getItem(MODE_STORAGE_KEY);
  return value === 'social' || value === 'chat' ? value : 'chat';
};

const readPaths = (): ModePaths => {
  if (typeof window === 'undefined') return EMPTY_PATHS;

  try {
    const raw = window.localStorage.getItem(MODE_PATHS_STORAGE_KEY);
    if (!raw) return EMPTY_PATHS;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return EMPTY_PATHS;

    const record = parsed as Partial<Record<AppMode, unknown>>;
    return {
      chat: typeof record.chat === 'string' ? record.chat : null,
      social: typeof record.social === 'string' ? record.social : null,
    };
  } catch {
    // A corrupt entry must not block the shell from rendering.
    return EMPTY_PATHS;
  }
};

const writePaths = (paths: ModePaths) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MODE_PATHS_STORAGE_KEY, JSON.stringify(paths));
};

interface AppModeState {
  mode: AppMode;
  lastPathByMode: ModePaths;
  /** Records where the user is so the mode can be resumed later. */
  rememberPath: (mode: AppMode, path: string) => void;
  setMode: (mode: AppMode) => void;
  /** The path a mode should resume at, falling back to its home. */
  resolveModePath: (mode: AppMode) => string;
}

export const useAppMode = create<AppModeState>((set, get) => ({
  mode: readMode(),
  lastPathByMode: readPaths(),

  rememberPath: (mode, path) => {
    const current = get().lastPathByMode;
    if (current[mode] === path) return;

    const next = { ...current, [mode]: path };
    writePaths(next);
    set({ lastPathByMode: next });
  },

  setMode: (mode) => {
    if (get().mode === mode) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
    }
    set({ mode });
  },

  resolveModePath: (mode) => get().lastPathByMode[mode] ?? homePathFor(mode),
}));
