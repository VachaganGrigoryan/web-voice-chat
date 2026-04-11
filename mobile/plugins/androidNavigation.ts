import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { appNavigation } from '@/navigation/appNavigation';

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

let isInitialized = false;
let listenerHandlePromise: Promise<{ remove: () => Promise<void> }> | null = null;

const dismissKeyboardIfNeeded = () => {
  if (typeof document === 'undefined') {
    return false;
  }

  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  const tagName = activeElement.tagName;
  const isTextInput =
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    activeElement.isContentEditable;

  if (!isTextInput) {
    return false;
  }

  activeElement.blur();
  return true;
};

const closeOpenDialogIfNeeded = () => {
  if (typeof document === 'undefined') {
    return false;
  }

  const hasOpenDialog = !!document.querySelector('[role="dialog"][data-state="open"]');
  if (!hasOpenDialog) {
    return false;
  }

  const escapeEvent = new KeyboardEvent('keydown', {
    key: 'Escape',
    code: 'Escape',
    bubbles: true,
  });

  document.dispatchEvent(escapeEvent);
  return true;
};

const exitFullscreenIfNeeded = async () => {
  if (typeof document === 'undefined' || !document.fullscreenElement) {
    return false;
  }

  await document.exitFullscreen();
  return true;
};
const handleBackButton = async () => {
  if (dismissKeyboardIfNeeded()) {
    return;
  }

  if (closeOpenDialogIfNeeded()) {
    return;
  }

  if (await exitFullscreenIfNeeded()) {
    return;
  }

  if (appNavigation.goBack()) {
    return;
  }

  await CapacitorApp.exitApp();
};

export const androidNavigation = {
  isNativeAndroid,
  async init() {
    if (!isNativeAndroid || isInitialized) {
      return;
    }

    isInitialized = true;
    listenerHandlePromise = CapacitorApp.addListener('backButton', handleBackButton);
  },
  async dispose() {
    if (!listenerHandlePromise) {
      isInitialized = false;
      return;
    }

    const handle = await listenerHandlePromise;
    await handle.remove();
    listenerHandlePromise = null;
    isInitialized = false;
  },
};
