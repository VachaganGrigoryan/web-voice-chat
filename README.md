# Voice Chat App

A real-time voice chat application built with React, TypeScript, and Socket.IO.

## Features

- **Authentication**: Passwordless email login/registration.
- **Real-time Chat**: Instant messaging with Socket.IO.
- **Voice Messages**: Record and send voice messages.
- **Presence**: See who is online.
- **Message History**: Infinite scroll for message history.

## Tech Stack

- **Frontend**: React, Vite, TypeScript
- **State Management**: Zustand, TanStack Query
- **Styling**: Tailwind CSS, Radix UI
- **Real-time**: Socket.IO Client
- **Forms**: React Hook Form, Zod

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Copy `.env.example` to `.env` and update the values if needed.
    ```bash
    cp .env.example .env
    ```
    
    Default values:
    - `VITE_API_URL`: https://voice-chat.vachagan.dev
    - `VITE_SOCKET_URL`: https://voice-chat.vachagan.dev

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

4.  **Build for Production**:
    ```bash
    npm run build
    ```

## Project Structure

- `src/api`: API client and types.
- `src/components`: Reusable UI components.
- `src/features`: Feature-specific components (Auth, Chat, Settings).
- `src/hooks`: Custom hooks.
- `src/socket`: Socket.IO configuration and events.
- `src/store`: Global state (Zustand).
