import { useState, useRef, useEffect, useMemo } from 'react';
import { useChat, useConversations } from '@/hooks/useChat';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Separator } from '@/components/ui/Separator';
import { LogOut, User, MessageSquare, Plus, Loader2, Mic, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import VoiceRecorder from './VoiceRecorder';
import MediaComposer from './MediaComposer';
import { MessageRenderer } from './MessageRenderer';
import { MediaViewer } from './MediaViewer';
import AudioPlayer from './AudioPlayer';
import UserSettings from './UserSettings';
import { cn } from '@/lib/utils';
import { useTypingIndicator, useSocketStore } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { format, isToday, isYesterday } from 'date-fns';
import { useProfile } from '@/hooks/useProfile';

export default function ChatLayout() {
  const {
    selectedUser,
    setSelectedUser,
    onlineUsers,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendVoice,
    sendText,
    isSending,
  } = useChat();
  
  const { data: conversationsData } = useConversations();
  const conversations = conversationsData?.pages.flatMap(page => page.data) || [];
  const queryClient = useQueryClient();

  const { userEmail, userId, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [newUserId, setNewUserId] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ open: boolean; type: 'image' | 'video'; url: string }>({ open: false, type: 'image', url: '' });
  const { profile } = useProfile();
  const { socket } = useSocketStore();
  const [highlightedMessageIds, setHighlightedMessageIds] = useState<Set<string>>(new Set());
  
  const { isTyping } = useTypingIndicator(selectedUser || undefined);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      logout();
      navigate('/auth');
    }
  };

  const allMessages = useMemo(() => 
    messages?.pages.flatMap((page) => page.data) || [],
    [messages]
  );

  const readEmittedMessagesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    readEmittedMessagesRef.current.clear();
    setHighlightedMessageIds(new Set());
  }, [selectedUser]);

  useEffect(() => {
    if (!socket || !selectedUser || !allMessages.length) return;

    const unreadMessages = allMessages.filter(
      (m) => m.receiver_id === userId && 
             m.status !== 'read' && 
             m.type !== 'voice' &&
             !readEmittedMessagesRef.current.has(m.id)
    );

    if (unreadMessages.length > 0) {
      const newIds = unreadMessages.map(m => m.id);
      
      // Mark as emitted immediately to avoid re-processing in next render
      newIds.forEach(id => readEmittedMessagesRef.current.add(id));

      // Emit events
      newIds.forEach((id) => {
        socket.emit(EVENTS.MESSAGE_READ, { message_id: id });
      });

      // Update UI highlight
      setHighlightedMessageIds((prev) => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });

      const timer = setTimeout(() => {
        setHighlightedMessageIds((prev) => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [allMessages, selectedUser, socket, userId]);

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const selectedConversationUser = conversations.find(c => c.peer_user.id === selectedUser)?.peer_user;
  const displaySelectedUser = selectedConversationUser?.display_name || selectedConversationUser?.username || selectedUser;

  const handleMediaClick = (type: 'image' | 'video', url: string) => {
    setMediaViewer({ open: true, type, url });
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">
      <MediaViewer 
        open={mediaViewer.open}
        type={mediaViewer.type}
        url={mediaViewer.url}
        onClose={() => setMediaViewer(prev => ({ ...prev, open: false }))}
      />
      <UserSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-80 border-r flex flex-col bg-muted/10 h-full",
        selectedUser ? "hidden md:flex" : "flex"
      )}>
        <div className="p-4 border-b flex items-center justify-between shrink-0 h-16">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 hover:bg-muted/50 p-1.5 rounded-lg transition-colors text-left max-w-[70%]"
          >
            <Avatar className="h-8 w-8">
              {profile?.avatar ? (
                <AvatarImage src={profile.avatar.url} className="object-cover" />
              ) : null}
              <AvatarFallback>{(profile?.display_name || profile?.username || userEmail || '?')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate">
                {profile?.display_name || profile?.username || userEmail}
              </span>
              {profile?.username && (
                <span className="text-[10px] text-muted-foreground truncate">
                  @{profile.username}
                </span>
              )}
            </div>
          </button>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 flex-1 flex flex-col min-h-0">
          <div className="flex gap-2 mb-4 shrink-0">
            <Input 
              placeholder="Enter User ID..." 
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="h-9 text-sm"
            />
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => {
                if (newUserId) setSelectedUser(newUserId);
              }}
              disabled={!newUserId}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider shrink-0">
            Recent Conversations
          </div>
          
          <ScrollArea className="flex-1 -mx-4 px-4">
            <div className="space-y-1 pb-4">
              {conversations.map((conv) => (
                <Button
                  key={conv.conversation_id}
                  variant={selectedUser === conv.peer_user.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sm font-normal py-3 h-auto",
                    conv.peer_user.id === userId && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => {
                    setSelectedUser(conv.peer_user.id);
                    // Clear unread count in cache
                    queryClient.setQueryData(['conversations'], (old: any) => {
                      if (!old) return old;
                      const newPages = old.pages.map((page: any) => ({
                        ...page,
                        data: page.data.map((c: any) => 
                          c.peer_user.id === conv.peer_user.id 
                            ? { ...c, unread_count: 0 } 
                            : c
                        )
                      }));
                      return { ...old, pages: newPages };
                    });
                  }}
                >
                  <div className="relative mr-3">
                    <Avatar className="h-8 w-8">
                      {conv.peer_user.avatar ? (
                        <AvatarImage src={conv.peer_user.avatar.url} />
                      ) : null}
                      <AvatarFallback>{(conv.peer_user.display_name || conv.peer_user.username || conv.peer_user.id)[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {conv.peer_user.is_online && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                    )}
                  </div>
                  <div className="flex flex-col items-start overflow-hidden flex-1">
                     <div className="flex justify-between items-center w-full">
                       <span className={cn("truncate text-left", conv.unread_count ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                         {conv.peer_user.display_name || conv.peer_user.username || conv.peer_user.id}
                       </span>
                       {!!conv.unread_count && (
                         <div className="flex items-center gap-1.5 ml-2 shrink-0">
                           <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                           <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                             {conv.unread_count > 99 ? '99+' : conv.unread_count}
                           </span>
                         </div>
                       )}
                     </div>
                     <span className={cn("text-xs truncate w-full text-left", conv.unread_count ? "text-foreground font-semibold" : "text-muted-foreground")}>
                       {conv.last_message?.type === 'voice' ? '🎤 Voice message' : conv.last_message?.text || 'Click to chat'}
                     </span>
                  </div>
                </Button>
              ))}
              
              {conversations.length === 0 && (
                <div className="text-sm text-muted-foreground p-4 text-center bg-muted/30 rounded-lg border border-dashed m-1">
                  No recent conversations
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 bg-background h-full relative",
        selectedUser ? "flex" : "hidden md:flex"
      )}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b flex items-center px-4 justify-between bg-background/95 backdrop-blur z-10 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden -ml-2 h-10 w-10 rounded-full" 
                  onClick={() => setSelectedUser(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="relative">
                  <Avatar className="h-9 w-9 border">
                    {selectedConversationUser?.avatar ? (
                      <AvatarImage src={selectedConversationUser.avatar.url} />
                    ) : null}
                    <AvatarFallback>{displaySelectedUser?.[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {onlineUsers?.includes(selectedUser) && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold leading-none mb-1">{displaySelectedUser}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {isTyping ? (
                      <span className="text-primary font-medium animate-pulse">Recording...</span>
                    ) : onlineUsers?.includes(selectedUser) ? (
                      'Online'
                    ) : (
                      'Offline'
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center">
                <MediaComposer 
                  receiverId={selectedUser} 
                  onSendMedia={sendVoice}
                  isUploading={isSending}
                  setIsUploading={() => {}}
                />
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4 space-y-reverse space-y-6 scroll-smooth overscroll-contain">
               {/* Typing Indicator Bubble */}
               {isTyping && (
                 <div className="self-start mb-2 ml-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="bg-secondary/50 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-muted-foreground flex items-center gap-2 shadow-sm">
                     <div className="flex gap-1">
                       <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                       <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                       <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                     </div>
                     Recording audio...
                   </div>
                 </div>
               )}

               {allMessages.map((message, index) => {
                   const isMe = message.sender_id === userId;
                   const nextMessage = allMessages[index + 1];
                   const showDateHeader = !nextMessage || 
                     format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                     format(new Date(nextMessage.created_at), 'yyyy-MM-dd');

                   return (
                     <div key={message.id} className="flex flex-col w-full min-w-0">
                       <div
                         className={cn(
                           "flex flex-col max-w-[85%] md:max-w-[70%] mb-1 relative group min-w-0",
                           isMe ? "self-end items-end" : "self-start items-start"
                         )}
                       >
                         {/* Precise Timestamp Tooltip */}
                         <div className={cn(
                           "absolute bottom-full mb-1 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none",
                           isMe ? "right-0" : "left-0"
                         )}>
                           <div className="bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] p-2 rounded-lg shadow-xl border border-white/10 flex flex-col gap-1 min-w-[140px]">
                             <div className="flex justify-between gap-4">
                               <span className="text-zinc-400">Sent</span>
                               <span>{format(new Date(message.created_at), 'MMM d, h:mm:ss a')}</span>
                             </div>
                             {message.delivered_at && (
                               <div className="flex justify-between gap-4">
                                 <span className="text-zinc-400">Delivered</span>
                                 <span>{format(new Date(message.delivered_at), 'MMM d, h:mm:ss a')}</span>
                               </div>
                             )}
                             {message.read_at && (
                               <div className="flex justify-between gap-4">
                                 <span className="text-zinc-400">Read</span>
                                 <span>{format(new Date(message.read_at), 'MMM d, h:mm:ss a')}</span>
                               </div>
                             )}
                           </div>
                         </div>

                          <MessageRenderer 
                            message={message}
                            isMe={isMe}
                            highlighted={highlightedMessageIds.has(message.id)}
                            onMediaClick={handleMediaClick}
                          />

                         <div className={cn(
                           "flex items-center gap-1 mt-1 px-1 text-[10px] text-muted-foreground/70 cursor-help",
                           isMe ? "justify-end" : "justify-start"
                         )}>
                           <span title={`Sent: ${format(new Date(message.created_at), 'MMM d, yyyy h:mm:ss a')}${message.delivered_at ? `\nDelivered: ${format(new Date(message.delivered_at), 'MMM d, yyyy h:mm:ss a')}` : ''}${message.read_at ? `\nRead: ${format(new Date(message.read_at), 'MMM d, yyyy h:mm:ss a')}` : ''}`}>
                             {format(new Date(message.created_at), 'h:mm a')}
                           </span>
                           {isMe && (
                             <span 
                               className={cn(
                                 "flex items-center",
                                 message.status === 'read' ? "text-blue-500" : ""
                               )}
                               title={message.read_at ? `Read at ${format(new Date(message.read_at), 'h:mm a')}` : undefined}
                             >
                               {message.status === 'read' ? (
                                 <CheckCheck className="h-3 w-3" />
                               ) : (
                                 <Check className="h-3 w-3" />
                               )}
                             </span>
                           )}
                         </div>
                       </div>
                       
                       {showDateHeader && (
                         <div className="flex justify-center my-6">
                           <div className="bg-muted/50 text-muted-foreground text-[10px] font-medium px-3 py-1 rounded-full uppercase tracking-wider shadow-sm border border-border/50">
                             {formatMessageDate(message.created_at)}
                           </div>
                         </div>
                       )}
                     </div>
                   );
                 })}
                 
                 {isFetchingNextPage && (
                   <div className="flex justify-center py-4">
                     <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                   </div>
                 )}
                 
                 <div 
                   className="h-1 w-full" 
                   ref={(node) => {
                       if (node && hasNextPage && !isFetchingNextPage) {
                           const observer = new IntersectionObserver((entries) => {
                               if (entries[0].isIntersecting) {
                                   fetchNextPage();
                               }
                           });
                           observer.observe(node);
                           return () => observer.disconnect();
                       }
                   }}
                 />
                 
                 {allMessages.length === 0 && !isFetchingNextPage && (
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                        <div className="bg-muted/30 p-4 rounded-full mb-3">
                            <MessageSquare className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">No messages yet</p>
                        <p className="text-xs text-muted-foreground">Start the conversation by sending a message</p>
                    </div>
                 )}
            </div>

            {/* Composer Area - Sticky at bottom */}
            <div className="shrink-0 z-20 bg-background flex items-center gap-2 p-4">
              <VoiceRecorder 
                receiverId={selectedUser} 
                onSendVoice={sendVoice}
                onSendText={sendText}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 p-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-sm">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Welcome to Voice Chat</h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              Select a user from the sidebar to start sending real-time voice messages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
