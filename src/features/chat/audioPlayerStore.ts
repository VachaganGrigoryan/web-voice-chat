import { create } from 'zustand';

export interface ChatAudioQueueItem {
  id: string;
  src: string;
  durationMs?: number | null;
  createdAt?: string | null;
  isRead?: boolean;
  isMe?: boolean;
}

interface ChatAudioPlayerState {
  audioElement: HTMLAudioElement | null;
  queueKey: string | null;
  queue: ChatAudioQueueItem[];
  activeItem: ChatAudioQueueItem | null;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  shouldAutoplay: boolean;
  playedMessageIds: string[];
  setAudioElement: (audioElement: HTMLAudioElement | null) => void;
  syncQueue: (queueKey: string, queue: ChatAudioQueueItem[]) => void;
  openTrack: (
    item: ChatAudioQueueItem,
    autoplay?: boolean,
    queueKey?: string | null,
    queue?: ChatAudioQueueItem[]
  ) => void;
  toggleTrack: (
    item: ChatAudioQueueItem,
    queueKey?: string | null,
    queue?: ChatAudioQueueItem[]
  ) => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  stop: () => void;
  close: () => void;
  seekTo: (time: number) => void;
  seekBy: (delta: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  setDuration: (duration: number) => void;
  setCurrentTime: (currentTime: number) => void;
  setIsLoading: (isLoading: boolean) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  consumeAutoplay: () => void;
  markMessagePlayed: (messageId: string) => void;
  hasPlayedMessage: (messageId: string) => boolean;
}

const clampTime = (time: number, duration: number) => {
  if (!Number.isFinite(time)) {
    return 0;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, time);
  }

  return Math.min(Math.max(0, time), duration);
};

const initialState = {
  audioElement: null,
  queueKey: null,
  queue: [],
  activeItem: null,
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  shouldAutoplay: false,
  playedMessageIds: [],
};

export const useChatAudioPlayerStore = create<ChatAudioPlayerState>((set, get) => ({
  ...initialState,

  setAudioElement: (audioElement) => set({ audioElement }),

  syncQueue: (queueKey, queue) =>
    set((state) => {
      if (state.queueKey !== queueKey) {
        return state;
      }

      const nextActiveItem = state.activeItem
        ? queue.find((item) => item.id === state.activeItem?.id) ?? null
        : null;
      const shouldReset = !!state.activeItem && !nextActiveItem;
      const shouldKeepActiveItem =
        !!state.activeItem &&
        !!nextActiveItem &&
        state.activeItem.id === nextActiveItem.id &&
        state.activeItem.src === nextActiveItem.src &&
        state.activeItem.durationMs === nextActiveItem.durationMs &&
        state.activeItem.createdAt === nextActiveItem.createdAt &&
        state.activeItem.isRead === nextActiveItem.isRead &&
        state.activeItem.isMe === nextActiveItem.isMe;

      return {
        queueKey,
        queue,
        activeItem: shouldKeepActiveItem ? state.activeItem : nextActiveItem,
        isPlaying: shouldReset ? false : state.isPlaying,
        isLoading: shouldReset ? false : state.isLoading,
        currentTime: shouldReset ? 0 : state.currentTime,
        duration: shouldReset
          ? 0
          : nextActiveItem
          ? state.duration || (nextActiveItem.durationMs ? nextActiveItem.durationMs / 1000 : 0)
          : state.duration,
        shouldAutoplay: shouldReset ? false : state.shouldAutoplay,
      };
    }),

  openTrack: (item, autoplay = true, queueKey = null, queue) =>
    set((state) => {
      const isSameTrack = state.activeItem?.id === item.id;
      const nextQueue = queue ?? state.queue;
      const nextQueueKey = queueKey ?? state.queueKey;

      return {
        queueKey: nextQueueKey,
        queue: nextQueue,
        activeItem: item,
        currentTime: isSameTrack ? state.currentTime : 0,
        duration: item.durationMs ? item.durationMs / 1000 : isSameTrack ? state.duration : 0,
        isLoading: autoplay,
        isPlaying: false,
        shouldAutoplay: autoplay,
      };
    }),

  toggleTrack: (item, queueKey = null, queue) => {
    const { activeItem, queueKey: activeQueueKey, togglePlayback, openTrack } = get();

    if (activeItem?.id === item.id && activeQueueKey === (queueKey ?? activeQueueKey)) {
      togglePlayback();
      return;
    }

    openTrack(item, true, queueKey, queue);
  },

  play: () => {
    const { activeItem, audioElement, currentTime, duration } = get();
    if (!activeItem) return;

    if (!audioElement) {
      set({ shouldAutoplay: true, isLoading: true });
      return;
    }

    if (duration > 0 && currentTime >= duration) {
      audioElement.currentTime = 0;
      set({ currentTime: 0 });
    }

    const playPromise = audioElement.play();
    set({ shouldAutoplay: false, isLoading: true });

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        set({ isPlaying: false, isLoading: false });
      });
    }
  },

  pause: () => {
    get().audioElement?.pause();
    set({ isPlaying: false, isLoading: false, shouldAutoplay: false });
  },

  togglePlayback: () => {
    const { isPlaying, play, pause } = get();
    if (isPlaying) {
      pause();
      return;
    }

    play();
  },

  stop: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    set({
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      shouldAutoplay: false,
    });
  },

  close: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
    }

    set({
      activeItem: null,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      shouldAutoplay: false,
    });
  },

  seekTo: (time) => {
    const { audioElement, duration } = get();
    const nextTime = clampTime(time, duration);

    if (audioElement) {
      audioElement.currentTime = nextTime;
    }

    set({ currentTime: nextTime });
  },

  seekBy: (delta) => {
    const { currentTime, seekTo } = get();
    seekTo(currentTime + delta);
  },

  playNext: () => {
    const { activeItem, queue, openTrack } = get();
    if (!activeItem) return;

    const currentIndex = queue.findIndex((item) => item.id === activeItem.id);
    if (currentIndex === -1 || currentIndex >= queue.length - 1) return;

    openTrack(queue[currentIndex + 1], true);
  },

  playPrevious: () => {
    const { activeItem, queue, openTrack } = get();
    if (!activeItem) return;

    const currentIndex = queue.findIndex((item) => item.id === activeItem.id);
    if (currentIndex <= 0) return;

    openTrack(queue[currentIndex - 1], true);
  },

  setDuration: (duration) => set({ duration: Math.max(0, duration) }),

  setCurrentTime: (currentTime) =>
    set((state) => ({ currentTime: clampTime(currentTime, state.duration) })),

  setIsLoading: (isLoading) => set({ isLoading }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  consumeAutoplay: () => set({ shouldAutoplay: false }),

  markMessagePlayed: (messageId) =>
    set((state) => ({
      playedMessageIds: state.playedMessageIds.includes(messageId)
        ? state.playedMessageIds
        : [...state.playedMessageIds, messageId],
    })),

  hasPlayedMessage: (messageId) => get().playedMessageIds.includes(messageId),
}));
