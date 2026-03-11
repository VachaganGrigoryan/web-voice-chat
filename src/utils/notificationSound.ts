let audio: HTMLAudioElement | null = null;
let isUnlocked = false;

export const initNotificationSound = () => {
  if (typeof window === 'undefined') return;
  
  audio = new Audio('/notification.mp3');
  audio.preload = 'auto';
  audio.volume = 0.5;

  const unlock = () => {
    if (isUnlocked || !audio) return;
    
    audio.play().then(() => {
      audio!.pause();
      audio!.currentTime = 0;
      isUnlocked = true;
      removeListeners();
    }).catch(e => console.log('Audio unlock failed:', e));
  };

  const removeListeners = () => {
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('click', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock);
};

export const playNotificationSound = () => {
  if (!audio) return;
  
  audio.currentTime = 0;
  audio.play().catch(e => console.log('Audio play failed:', e));
};
