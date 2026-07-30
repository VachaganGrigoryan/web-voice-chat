import { create } from 'zustand';

export type CreateIntent =
  | 'new-group'
  | 'new-channel'
  | 'new-space'
  | 'new-post'
  | 'search';

interface CreateIntentState {
  /** The intent awaiting a handler, or null when nothing is pending. */
  pendingIntent: CreateIntent | null;
  requestIntent: (intent: CreateIntent) => void;
  clearIntent: () => void;
}

/**
 * The rail raises creation intents; whichever destination is mounted owns the
 * dialog that fulfils them. Keeps the shell free of feature dialogs and avoids
 * prop-drilling a dozen callbacks through the router outlet.
 */
export const useCreateIntent = create<CreateIntentState>((set) => ({
  pendingIntent: null,
  requestIntent: (intent) => set({ pendingIntent: intent }),
  clearIntent: () => set({ pendingIntent: null }),
}));
