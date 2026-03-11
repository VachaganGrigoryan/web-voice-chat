let audio: HTMLAudioElement | null = null;
let isUnlocked = false;
let pendingPlay = false;

export const initNotificationSound = () => {
  if (typeof window === 'undefined') return;
  
  audio = new Audio('/notification.mp3');
  audio.preload = 'auto';
  audio.volume = 1.0; // Increased volume

  // Add global listeners to unlock audio on first interaction
  const events = ['click', 'keydown', 'touchstart'];
  const unlock = () => {
    unlockAudio();
    events.forEach(event => document.removeEventListener(event, unlock));
  };
  events.forEach(event => document.addEventListener(event, unlock, { once: true }));
};

export const unlockAudio = async () => {
  if (isUnlocked || !audio) return true;
  
  try {
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    isUnlocked = true;
    console.log('Audio unlocked successfully via user gesture');
    
    if (pendingPlay) {
      pendingPlay = false;
      playNotificationSound();
    }
    return true;
  } catch (e) {
    console.error('Audio unlock failed:', e);
    return false;
  }
};

export const playNotificationSound = () => {
  if (!audio) {
    console.warn('Notification sound not initialized');
    return;
  }
  
  console.log('Playing notification sound...');
  audio.currentTime = 0;
  audio.play().catch(e => {
    console.error('Audio play failed:', e);
    if (e.name === 'NotAllowedError') {
      console.log('Audio not allowed, queuing for next interaction');
      pendingPlay = true;
    }
  });
};
