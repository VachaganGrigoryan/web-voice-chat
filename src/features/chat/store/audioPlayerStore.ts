import { create } from 'zustand';
import { MessageDoc } from '@/api/types';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

interface AudioPlayerState {
  activeMessage: MessageDoc | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioMessages: MessageDoc[];
  
  play: (message: MessageDoc) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: (message: MessageDoc) => void;
  seek: (time: number) => void;
  close: () => void;
  setAudioMessages: (messages: MessageDoc[]) => void;
  playNext: () => void;
  playPrevious: () => void;
}

const audio = new Audio();

export const useAudioPlayerStore = create<AudioPlayerState>((set, get) => {
  audio.addEventListener('timeupdate', () => {
    set({ currentTime: audio.currentTime });
  });
  
  audio.addEventListener('loadedmetadata', () => {
    set({ duration: audio.duration });
  });
  
  audio.addEventListener('ended', () => {
    const { playNext } = get();
    // Try to play next, if it fails or there is no next, it will just stop
    playNext();
  });

  audio.addEventListener('play', () => set({ isPlaying: true }));
  audio.addEventListener('pause', () => set({ isPlaying: false }));

  const markAsRead = (message: MessageDoc) => {
    if (message.status !== 'read') {
      const socket = getSocket();
      socket?.emit(EVENTS.MESSAGE_READ, { message_id: message.id });
    }
  };

  return {
    activeMessage: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    audioMessages: [],

    play: (message: MessageDoc) => {
      const { activeMessage } = get();
      if (activeMessage?.id !== message.id) {
        audio.src = message.media?.url || '';
        audio.load();
        set({ activeMessage: message, currentTime: 0, duration: message.media?.duration_ms ? message.media.duration_ms / 1000 : 0 });
        markAsRead(message);
      }
      audio.play().catch(console.error);
    },

    pause: () => {
      audio.pause();
    },

    resume: () => {
      if (get().activeMessage) {
        audio.play().catch(console.error);
      }
    },

    togglePlay: (message: MessageDoc) => {
      const { activeMessage, isPlaying, play, pause } = get();
      if (activeMessage?.id === message.id) {
        if (isPlaying) {
          pause();
        } else {
          audio.play().catch(console.error);
        }
      } else {
        play(message);
      }
    },

    seek: (time: number) => {
      audio.currentTime = time;
      set({ currentTime: time });
    },

    close: () => {
      audio.pause();
      audio.src = '';
      set({ activeMessage: null, isPlaying: false, currentTime: 0, duration: 0 });
    },

    setAudioMessages: (messages: MessageDoc[]) => {
      set({ audioMessages: messages });
    },

    playNext: () => {
      const { activeMessage, audioMessages, play, close } = get();
      if (!activeMessage || audioMessages.length === 0) {
        close();
        return;
      }
      
      const currentIndex = audioMessages.findIndex(m => m.id === activeMessage.id);
      // Next message in time is the newer one, which is at a lower index
      if (currentIndex > 0) {
        play(audioMessages[currentIndex - 1]);
      } else {
        close();
      }
    },

    playPrevious: () => {
      const { activeMessage, audioMessages, play } = get();
      if (!activeMessage || audioMessages.length === 0) return;
      
      const currentIndex = audioMessages.findIndex(m => m.id === activeMessage.id);
      // Previous message in time is the older one, which is at a higher index
      if (currentIndex !== -1 && currentIndex < audioMessages.length - 1) {
        play(audioMessages[currentIndex + 1]);
      } else if (currentIndex === audioMessages.length - 1) {
        // Just restart current if it's the oldest one
        audio.currentTime = 0;
      }
    }
  };
});
