import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { CallHistoryMenuState } from './components/CallHistoryActionsMenu';
import type { MessageMenuAnchor } from './components/MessageShell';
import type { ChatMessage } from './types/message';

export type SidebarDestructiveAction =
  | { kind: 'clearConversation'; peerUserId: string; label: string }
  | { kind: 'deleteConversation'; peerUserId: string; label: string }
  | { kind: 'clearCallHistoryPeer'; peerUserId: string; label: string }
  | { kind: 'clearCallHistoryAll' };

export type ActiveMessageSurface = 'main' | 'thread';

export type MediaViewerImageItem = { id: string; url: string; downloadName?: string };

export type MediaViewerState =
  | { open: false; type: 'image' | 'video'; url: ''; items: MediaViewerImageItem[]; initialItemId: null; downloadName?: string }
  | { open: true; type: 'image'; url: ''; items: MediaViewerImageItem[]; initialItemId: string; downloadName?: string }
  | { open: true; type: 'video'; url: string; items: []; initialItemId: null; downloadName?: string };

export const CLOSED_MEDIA_VIEWER: MediaViewerState = {
  open: false,
  type: 'image',
  url: '',
  items: [],
  initialItemId: null,
};

interface ChatDialogsState {
  readonly callHistoryMenu: CallHistoryMenuState | null;
  readonly pendingDestructiveAction: SidebarDestructiveAction | null;
  readonly groupInfoOpen: boolean;
  readonly groupDialogOpen: boolean;
  readonly channelDialogOpen: boolean;
  readonly updatingNotificationConversationId: string | null;
  readonly searchOpen: boolean;
  readonly scheduledOpen: boolean;
  readonly savedOpen: boolean;
  readonly forwardSource: { conversationId: string; messageId: string } | null;
  readonly folderDialogConversationId: string | null;
  readonly mediaViewer: MediaViewerState;
  readonly activeMessage: ChatMessage | null;
  readonly activeMessageAnchor: MessageMenuAnchor | null;
  readonly activeMessageSurface: ActiveMessageSurface;
}

const initialState: ChatDialogsState = {
  callHistoryMenu: null,
  pendingDestructiveAction: null,
  groupInfoOpen: false,
  groupDialogOpen: false,
  channelDialogOpen: false,
  updatingNotificationConversationId: null,
  searchOpen: false,
  scheduledOpen: false,
  savedOpen: false,
  forwardSource: null,
  folderDialogConversationId: null,
  mediaViewer: CLOSED_MEDIA_VIEWER,
  activeMessage: null,
  activeMessageAnchor: null,
  activeMessageSurface: 'main',
};

type ChatDialogAction =
  | { type: 'SET_CALL_HISTORY_MENU'; menu: CallHistoryMenuState | null }
  | { type: 'SET_DESTRUCTIVE_ACTION'; action: SidebarDestructiveAction | null }
  | { type: 'SET_GROUP_INFO_OPEN'; open: boolean }
  | { type: 'SET_GROUP_DIALOG_OPEN'; open: boolean }
  | { type: 'SET_CHANNEL_DIALOG_OPEN'; open: boolean }
  | { type: 'SET_UPDATING_NOTIFICATION_CONVERSATION'; conversationId: string | null }
  | { type: 'SET_SEARCH_OPEN'; open: boolean }
  | { type: 'SET_SCHEDULED_OPEN'; open: boolean }
  | { type: 'SET_SAVED_OPEN'; open: boolean }
  | { type: 'SET_FORWARD_SOURCE'; source: { conversationId: string; messageId: string } | null }
  | { type: 'SET_FOLDER_DIALOG_CONVERSATION'; conversationId: string | null }
  | { type: 'SET_MEDIA_VIEWER'; viewer: MediaViewerState }
  | { type: 'OPEN_MESSAGE_MENU'; message: ChatMessage; anchor: MessageMenuAnchor; surface: ActiveMessageSurface }
  | { type: 'CLOSE_MESSAGE_MENU' }
  | { type: 'RESET_FOR_CONTAINER' };

function chatDialogsReducer(state: ChatDialogsState, action: ChatDialogAction): ChatDialogsState {
  switch (action.type) {
    case 'SET_CALL_HISTORY_MENU':
      return { ...state, callHistoryMenu: action.menu };
    case 'SET_DESTRUCTIVE_ACTION':
      return { ...state, pendingDestructiveAction: action.action };
    case 'SET_GROUP_INFO_OPEN':
      return { ...state, groupInfoOpen: action.open };
    case 'SET_GROUP_DIALOG_OPEN':
      return { ...state, groupDialogOpen: action.open };
    case 'SET_CHANNEL_DIALOG_OPEN':
      return { ...state, channelDialogOpen: action.open };
    case 'SET_UPDATING_NOTIFICATION_CONVERSATION':
      return { ...state, updatingNotificationConversationId: action.conversationId };
    case 'SET_SEARCH_OPEN':
      return { ...state, searchOpen: action.open };
    case 'SET_SCHEDULED_OPEN':
      return { ...state, scheduledOpen: action.open };
    case 'SET_SAVED_OPEN':
      return { ...state, savedOpen: action.open };
    case 'SET_FORWARD_SOURCE':
      return { ...state, forwardSource: action.source };
    case 'SET_FOLDER_DIALOG_CONVERSATION':
      return { ...state, folderDialogConversationId: action.conversationId };
    case 'SET_MEDIA_VIEWER':
      return { ...state, mediaViewer: action.viewer };
    case 'OPEN_MESSAGE_MENU':
      return {
        ...state,
        activeMessage: action.message,
        activeMessageAnchor: action.anchor,
        activeMessageSurface: action.surface,
      };
    case 'CLOSE_MESSAGE_MENU':
      return { ...state, activeMessage: null, activeMessageAnchor: null, activeMessageSurface: 'main' };
    case 'RESET_FOR_CONTAINER':
      return {
        ...state,
        activeMessage: null,
        activeMessageAnchor: null,
        activeMessageSurface: 'main',
        forwardSource: null,
        folderDialogConversationId: null,
      };
    default:
      return state;
  }
}

interface ChatDialogsContextValue {
  readonly state: ChatDialogsState;
  readonly setCallHistoryMenu: (menu: CallHistoryMenuState | null) => void;
  readonly requestDestructiveAction: (action: SidebarDestructiveAction | null) => void;
  readonly setGroupInfoOpen: (open: boolean) => void;
  readonly setGroupDialogOpen: (open: boolean) => void;
  readonly setChannelDialogOpen: (open: boolean) => void;
  readonly setUpdatingNotificationConversation: (conversationId: string | null) => void;
  readonly setSearchOpen: (open: boolean) => void;
  readonly setScheduledOpen: (open: boolean) => void;
  readonly setSavedOpen: (open: boolean) => void;
  readonly setForwardSource: (source: { conversationId: string; messageId: string } | null) => void;
  readonly setFolderDialogConversation: (conversationId: string | null) => void;
  readonly setMediaViewer: (viewer: MediaViewerState) => void;
  readonly openMessageMenu: (message: ChatMessage, anchor: MessageMenuAnchor, surface: ActiveMessageSurface) => void;
  readonly closeMessageMenu: () => void;
  readonly resetForContainer: () => void;
}

const ChatDialogsContext = createContext<ChatDialogsContextValue | null>(null);

/**
 * One discriminated-union reducer for every "which overlay is open" piece the
 * old `ChatLayout` tracked as thirteen separate `useState` calls, plus the
 * message-menu/media-viewer overlay state `useChatInteractionState` used to
 * own. Mounted once in `ChatShell` so any chat-mode page can dispatch into it.
 */
export function ChatDialogsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatDialogsReducer, initialState);

  const value = useMemo<ChatDialogsContextValue>(
    () => ({
      state,
      setCallHistoryMenu: (menu) => dispatch({ type: 'SET_CALL_HISTORY_MENU', menu }),
      requestDestructiveAction: (action) => dispatch({ type: 'SET_DESTRUCTIVE_ACTION', action }),
      setGroupInfoOpen: (open) => dispatch({ type: 'SET_GROUP_INFO_OPEN', open }),
      setGroupDialogOpen: (open) => dispatch({ type: 'SET_GROUP_DIALOG_OPEN', open }),
      setChannelDialogOpen: (open) => dispatch({ type: 'SET_CHANNEL_DIALOG_OPEN', open }),
      setUpdatingNotificationConversation: (conversationId) =>
        dispatch({ type: 'SET_UPDATING_NOTIFICATION_CONVERSATION', conversationId }),
      setSearchOpen: (open) => dispatch({ type: 'SET_SEARCH_OPEN', open }),
      setScheduledOpen: (open) => dispatch({ type: 'SET_SCHEDULED_OPEN', open }),
      setSavedOpen: (open) => dispatch({ type: 'SET_SAVED_OPEN', open }),
      setForwardSource: (source) => dispatch({ type: 'SET_FORWARD_SOURCE', source }),
      setFolderDialogConversation: (conversationId) =>
        dispatch({ type: 'SET_FOLDER_DIALOG_CONVERSATION', conversationId }),
      setMediaViewer: (viewer) => dispatch({ type: 'SET_MEDIA_VIEWER', viewer }),
      openMessageMenu: (message, anchor, surface) => dispatch({ type: 'OPEN_MESSAGE_MENU', message, anchor, surface }),
      closeMessageMenu: () => dispatch({ type: 'CLOSE_MESSAGE_MENU' }),
      resetForContainer: () => dispatch({ type: 'RESET_FOR_CONTAINER' }),
    }),
    [state]
  );

  return <ChatDialogsContext.Provider value={value}>{children}</ChatDialogsContext.Provider>;
}

export function useChatDialogs(): ChatDialogsContextValue {
  const context = useContext(ChatDialogsContext);
  if (!context) {
    throw new Error('useChatDialogs must be used within a ChatDialogsProvider');
  }
  return context;
}
