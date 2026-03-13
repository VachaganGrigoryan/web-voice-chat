import { toast } from 'sonner';

let notificationAudio: HTMLAudioElement | null = null;
let isUnlocked = false;
let pendingPlay = false;

export const initNotificationSound = () => {
  if (typeof window === 'undefined') return;
  
  // Step 1: Initialize an audio object when the page loads.
  notificationAudio = new Audio('/notification.mp3');
  notificationAudio.preload = 'auto';
  notificationAudio.volume = 1.0;

  // Step 2 & 3: One-time unlock on first user interaction
  const unlockAudio = () => {
    if (isUnlocked || !notificationAudio) return;

    notificationAudio.play()
      .then(() => {
        notificationAudio!.pause(); // Audio is now allowed for this session
        notificationAudio!.currentTime = 0;
        isUnlocked = true;
        console.log("Audio unlocked successfully");

        if (pendingPlay) {
          pendingPlay = false;
          playNotificationSound();
        }
      })
      .catch(err => console.error("Audio unlock failed", err));
  };

  const events = ['click', 'keydown', 'touchstart'];
  const handleUnlock = () => {
    unlockAudio();
    events.forEach(e => document.removeEventListener(e, handleUnlock));
  };

  events.forEach(e => document.addEventListener(e, handleUnlock, { once: true }));
};

export const unlockAudioExplicit = async () => {
  if (isUnlocked || !notificationAudio) return true;
  
  try {
    await notificationAudio.play();
    notificationAudio.pause();
    notificationAudio.currentTime = 0;
    isUnlocked = true;
    console.log('Audio unlocked successfully via user gesture');
    
    if (pendingPlay) {
      pendingPlay = false;
      playNotificationSound();
    }
    return true;
  } catch (e) {
    console.error('Explicit audio unlock failed:', e);
    return false;
  }
};

export const playNotificationSound = () => {
  if (!notificationAudio) {
    console.warn('Notification sound not initialized');
    return;
  }
  
  if (localStorage.getItem('soundEnabled') === 'false') {
    return;
  }
  
  console.log('Playing notification sound...');
  notificationAudio.currentTime = 0;
  notificationAudio.play().catch(e => {
    console.warn("Sound blocked: User hasn't interacted with the page yet.", e);
    if (e.name === 'NotAllowedError') {
      pendingPlay = true;
    }
  });
};

// 2. Function to trigger notification + sound
export const sendNotification = (title: string, message: string) => {
  // Show floating toast notification (in-app visual)
  toast(title, {
    description: message,
    duration: 4000,
    position: 'top-right',
  });

  // Show browser visual notification
  if ('Notification' in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body: message });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { body: message });
        }
      });
    }
  }

  // Play sound (will now work if 'unlockAudio' happened)
  playNotificationSound();
};
