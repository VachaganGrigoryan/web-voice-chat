import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePings } from '@/hooks/usePings';
import { useDiscoverySearch } from '@/features/discovery/hooks/useDiscoverySearch';
import { Check, Clock, Loader2, MessageSquare, Search, UserPlus, X } from 'lucide-react';

interface UserSearchProps {
  onSelectUser: (userId: string) => void;
}

export function UserSearch({ onSelectUser }: UserSearchProps) {
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { results, isSearching, error, isShortQuery, minLength } = useDiscoverySearch(input);
  const { incoming, sendPing, acceptPing, declinePing, isSending, isAccepting, isDeclining } = usePings();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearSearch = () => {
    setInput('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative mb-4 flex shrink-0 flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search username or enter code..."
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (input.trim() !== '') {
              setIsOpen(true);
            }
          }}
          className="h-9 pl-9 pr-9 text-sm"
        />
        {isSearching ? <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {isOpen && input.trim() !== '' ? (
        <div className="scrollbar-hidden absolute left-0 right-0 top-full z-50 mt-1 max-h-[300px] overflow-y-auto rounded-md border bg-background shadow-lg">
          {error ? (
            <div className="p-3 text-center text-sm text-destructive">{error}</div>
          ) : isShortQuery ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Type at least {minLength} characters</div>
          ) : isSearching && results.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-center text-sm text-muted-foreground">No users found</div>
          ) : (
            <div className="p-1">
              {results.map((user) => {
                const incomingPing = incoming.find((item) => item.peer.id === user.id)?.ping;

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-md p-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          {user.avatar ? <AvatarImage src={user.avatar.url} className="object-cover" /> : null}
                          <AvatarFallback>{(user.display_name || user.username || '?')[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {user.is_online ? (
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
                        ) : null}
                      </div>

                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium">
                          {user.display_name || user.username || 'Unknown User'}
                        </span>
                        {user.username ? <span className="truncate text-[10px] text-muted-foreground">@{user.username}</span> : null}
                        {user.discovered_via ? (
                          <span className="truncate text-[10px] text-muted-foreground">via {user.discovered_via}</span>
                        ) : null}
                      </div>
                    </div>

                    {(() => {
                      switch (user.ping_status) {
                        case 'accepted':
                          return (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                onSelectUser(user.id);
                                clearSearch();
                              }}
                              className="ml-2 shrink-0"
                            >
                              <MessageSquare className="mr-1 h-4 w-4" />
                              Message
                            </Button>
                          );
                        case 'incoming_pending':
                          return (
                            <div className="ml-2 flex shrink-0 items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
                                onClick={() => {
                                  if (!incomingPing) {
                                    return;
                                  }

                                  acceptPing(incomingPing.id).then(() => {
                                    onSelectUser(user.id);
                                    clearSearch();
                                  });
                                }}
                                disabled={isAccepting || !incomingPing}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  if (incomingPing) {
                                    declinePing(incomingPing.id);
                                  }
                                }}
                                disabled={isDeclining || !incomingPing}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        case 'outgoing_pending':
                          return (
                            <Button size="sm" variant="outline" disabled className="ml-2 shrink-0">
                              <Clock className="mr-1 h-4 w-4" />
                              Pending
                            </Button>
                          );
                        case 'declined':
                        case 'none':
                        default:
                          return (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => sendPing(user.id)}
                              disabled={!user.can_ping || isSending}
                              className="ml-2 shrink-0"
                            >
                              <UserPlus className="mr-1 h-4 w-4" />
                              Send Ping
                            </Button>
                          );
                      }
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
