# Mobile Companion

This directory contains the Android-only Capacitor companion app.

## Setup

Install shared web dependencies from the repo root, then install Capacitor/mobile-only dependencies here:

```sh
npm install
cd mobile
npm install
```

## Architecture

- The root `src/` directory remains the single shared application source.
- `mobile/src/main.tsx` bootstraps the shared React app without importing the web bootstrap in `src/main.tsx`.
- `mobile/overrides/` contains Android-native replacements for browser-only modules such as PWA install UI, notification permission flows, call audio routing, and video recording.
- `mobile/android/` contains the Capacitor Android project plus custom native plugins for audio routing and video recording.

## Commands

Run these from the repo root:

```sh
npm run build:mobile
npm run sync:mobile:android
npm run open:mobile:android
npm run assemble:mobile:android
```

## Local Android SDK

The Android project reads `mobile/android/local.properties` for the SDK path. On this machine it points to `/Users/vachagan/Library/Android/sdk`.
