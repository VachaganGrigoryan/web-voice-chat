import { useState } from 'react';
import { usePings } from '@/hooks/usePings';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Check, X, Clock, MessageSquare, Loader2, Bell, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface PingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

export function PingsModal({ isOpen, onClose, onSelectUser }: PingsModalProps) {
  const { incoming, outgoing, isLoading, acceptPing, declinePing, isAccepting, isDeclining } = usePings();
  const [activeTab, setActiveTab] = useState('incoming');

  const pendingIncoming = incoming.filter(item => item.ping.status === 'pending');
  const otherIncoming = incoming.filter(item => item.ping.status !== 'pending');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0">
          <DialogTitle className="text-2xl font-bold">Requests</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 shrink-0">
            <TabsList className="w-full grid grid-cols-2 h-11 p-1 bg-muted/50">
              <TabsTrigger value="incoming" className="rounded-md transition-all">
                Incoming
                {pendingIncoming.length > 0 && (
                  <span className="ml-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingIncoming.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="outgoing" className="rounded-md transition-all">Sent</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="incoming" className="flex-1 min-h-0 m-0 mt-2">
            <ScrollArea className="h-full px-6">
              <div className="space-y-6 pb-6">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                    <p className="text-sm text-muted-foreground">Loading requests...</p>
                  </div>
                ) : incoming.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="bg-muted p-4 rounded-full">
                      <Bell className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-medium">No incoming requests</p>
                      <p className="text-sm text-muted-foreground">When people want to chat, they'll appear here.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {pendingIncoming.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending</h4>
                        {pendingIncoming.map(item => (
                          <div key={item.ping.id} className="flex items-center justify-between p-3 border rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <Avatar className="h-10 w-10 shrink-0 border">
                                {item.peer.avatar ? (
                                  <AvatarImage src={item.peer.avatar.url} className="object-cover" />
                                ) : null}
                                <AvatarFallback className="bg-primary/5 text-primary">{(item.peer.display_name || item.peer.username || '?')[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-semibold truncate">
                                  {item.peer.display_name || item.peer.username || 'Unknown User'}
                                </span>
                                {item.peer.username && (
                                  <span className="text-xs text-muted-foreground truncate">@{item.peer.username}</span>
                                )}
                                <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatDistanceToNow(new Date(item.ping.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-9 w-9 rounded-full text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                onClick={() => {
                                  acceptPing(item.ping.id).then(() => {
                                    onSelectUser(item.peer.id);
                                    onClose();
                                  });
                                }}
                                disabled={isAccepting}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="outline" 
                                className="h-9 w-9 rounded-full text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
                                onClick={() => declinePing(item.ping.id)}
                                disabled={isDeclining}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {otherIncoming.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</h4>
                        {otherIncoming.map(item => (
                          <div key={item.ping.id} className="flex items-center justify-between p-3 border border-dashed rounded-xl bg-muted/20 opacity-80">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <Avatar className="h-9 w-9 shrink-0 grayscale-[0.5]">
                                {item.peer.avatar ? (
                                  <AvatarImage src={item.peer.avatar.url} className="object-cover" />
                                ) : null}
                                <AvatarFallback>{(item.peer.display_name || item.peer.username || '?')[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-sm font-medium truncate">
                                  {item.peer.display_name || item.peer.username || 'Unknown User'}
                                </span>
                                <div className="flex items-center gap-2">
                                  {item.ping.status === 'accepted' ? (
                                    <span className="text-[10px] text-green-600 font-medium flex items-center">
                                      <Check className="h-3 w-3 mr-1" /> Accepted
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-destructive font-medium flex items-center">
                                      <X className="h-3 w-3 mr-1" /> Declined
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(item.ping.updated_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {item.ping.status === 'accepted' && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 px-2 text-xs"
                                onClick={() => {
                                  onSelectUser(item.peer.id);
                                  onClose();
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                Chat
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="outgoing" className="flex-1 min-h-0 m-0 mt-2">
            <ScrollArea className="h-full px-6">
              <div className="space-y-4 pb-6">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                    <p className="text-sm text-muted-foreground">Loading sent requests...</p>
                  </div>
                ) : outgoing.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="bg-muted p-4 rounded-full">
                      <UserPlus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-medium">No sent requests</p>
                      <p className="text-sm text-muted-foreground">Start connecting with others to see them here.</p>
                    </div>
                  </div>
                ) : (
                  outgoing.map(item => (
                    <div key={item.ping.id} className={cn(
                      "flex items-center justify-between p-3 border rounded-xl transition-all",
                      item.ping.status === 'pending' ? "bg-card shadow-sm" : "bg-muted/20 border-dashed opacity-80"
                    )}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Avatar className={cn("h-10 w-10 shrink-0", item.ping.status !== 'pending' && "grayscale-[0.5]")}>
                          {item.peer.avatar ? (
                            <AvatarImage src={item.peer.avatar.url} className="object-cover" />
                          ) : null}
                          <AvatarFallback>{(item.peer.display_name || item.peer.username || '?')[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-semibold truncate">
                            {item.peer.display_name || item.peer.username || 'Unknown User'}
                          </span>
                          {item.peer.username && (
                            <span className="text-xs text-muted-foreground truncate">@{item.peer.username}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {item.ping.status === 'pending' ? 'Sent ' : 'Updated '} 
                            {formatDistanceToNow(new Date(item.ping.status === 'pending' ? item.ping.created_at : item.ping.updated_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {item.ping.status === 'pending' && (
                          <div className="flex items-center text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full border border-amber-100 dark:border-amber-800">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </div>
                        )}
                        {item.ping.status === 'accepted' && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center text-[10px] font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full border border-green-100 dark:border-green-800">
                              <Check className="h-3 w-3 mr-1" />
                              Accepted
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 rounded-full"
                              onClick={() => {
                                onSelectUser(item.peer.id);
                                onClose();
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        {item.ping.status === 'declined' && (
                          <div className="flex items-center text-[10px] font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-full border border-destructive/20">
                            <X className="h-3 w-3 mr-1" />
                            Declined
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
