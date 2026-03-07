import { useState } from 'react';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Separator } from '@/components/ui/Separator';
import { LogOut, User, MessageSquare, Plus, Loader2, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/endpoints';
import VoiceRecorder from './VoiceRecorder';
import AudioPlayer from './AudioPlayer';
import { cn } from '@/lib/utils';
import { useTypingIndicator } from '@/socket/socket';

export default function ChatLayout() {
  const {
    selectedUser,
    setSelectedUser,
    onlineUsers,
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sendMessage,
    isSending,
  } = useChat();
  
  const { userEmail, userId, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();
  const [newUserId, setNewUserId] = useState('');
  
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

  const allMessages = messages?.pages.flatMap((page) => page.data) || [];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col bg-muted/10">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{userEmail?.[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-sm font-medium truncate max-w-[120px]" title={userEmail || ''}>
              {userEmail}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          <div className="flex gap-2 mb-4">
            <Input 
              placeholder="Enter User ID..." 
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="h-8 text-xs"
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
          
          <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Online Users
          </div>
          
          <ScrollArea className="flex-1">
            <div className="space-y-1">
              {onlineUsers?.map((uid) => (
                <Button
                  key={uid}
                  variant={selectedUser === uid ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sm font-normal",
                    uid === userId && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => setSelectedUser(uid)}
                >
                  <div className="relative mr-2">
                    <User className="h-4 w-4" />
                    <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-green-500 ring-1 ring-background" />
                  </div>
                  <span className="truncate">{uid === userId ? `${uid} (You)` : uid}</span>
                </Button>
              ))}
              
              {(!onlineUsers || onlineUsers.length === 0) && (
                <div className="text-xs text-muted-foreground p-2 text-center">
                  No users online
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedUser ? (
          <>
            <div className="h-14 border-b flex items-center px-6 justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{selectedUser[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{selectedUser}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {onlineUsers?.includes(selectedUser) ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Online
                      </>
                    ) : (
                      'Offline'
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="absolute inset-0 flex flex-col">
                 <div className="flex-1 overflow-y-auto flex flex-col-reverse p-4">
                    {/* Typing Indicator */}
                    {isTyping && (
                      <div className="self-start mb-4 ml-1">
                        <div className="bg-secondary/50 rounded-full px-3 py-1 text-xs text-muted-foreground flex items-center gap-2">
                          <Mic className="h-3 w-3 animate-pulse" />
                          Recording...
                        </div>
                      </div>
                    )}

                    {allMessages.map((message) => {
                        const isMe = message.sender_id === userId;
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              "flex flex-col max-w-[80%] mb-4",
                              isMe ? "self-end items-end" : "self-start items-start"
                            )}
                          >
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2 shadow-sm",
                                isMe
                                  ? "bg-primary text-primary-foreground rounded-br-none"
                                  : "bg-white border rounded-bl-none"
                              )}
                            >
                              {message.type === 'voice' && message.audio ? (
                                <AudioPlayer 
                                  src={message.audio.url} 
                                  durationMs={message.audio.duration_ms}
                                  messageId={message.id}
                                  className={cn(
                                    isMe ? "bg-primary-foreground/20" : "bg-secondary/50"
                                  )}
                                />
                              ) : (
                                <div>Unknown message type</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-1 px-1">
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isMe && (
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  • {message.status}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      
                      {isFetchingNextPage && (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      
                      <div 
                        className="h-1" 
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
                 </div>
              </div>
            </div>

            <VoiceRecorder 
              receiverId={selectedUser} 
              onSend={sendMessage} 
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p>Select a user to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
