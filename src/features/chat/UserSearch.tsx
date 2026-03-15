import { useState, useEffect, useRef } from 'react';
import { discoveryApi } from '@/api/endpoints';
import { DiscoveredUser } from '@/api/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Search, Loader2, MessageSquare, UserPlus, Check, X, Clock } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { usePings } from '@/hooks/usePings';
import { useConversations } from '@/hooks/useChat';

interface UserSearchProps {
  onSelectUser: (userId: string) => void;
}

export function UserSearch({ onSelectUser }: UserSearchProps) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<DiscoveredUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const { incoming, outgoing, sendPing, acceptPing, declinePing, isSending, isAccepting, isDeclining } = usePings();
  const { data: conversationsData } = useConversations();
  const conversations = conversationsData?.pages.flatMap(page => page.data) || [];

  const debouncedInput = useDebounce(input, 500);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function searchDiscovery() {
      const value = debouncedInput.trim();
      
      if (!value) {
        setResults([]);
        setIsSearching(false);
        setError(null);
        return;
      }

      setIsSearching(true);
      setError(null);
      setIsOpen(true);

      try {
        const looksLikeCode = /^[A-Z0-9]{6,8}$/i.test(value);

        if (looksLikeCode) {
          const result = await discoveryApi.resolveCode(value.toUpperCase());
          setResults([result.data.data]);
        } else {
          const result = await discoveryApi.searchUsers(value);
          setResults(result.data.data);
        }
      } catch (err: any) {
        console.error('Search error:', err);
        if (err.response?.status === 404) {
          setResults([]);
        } else {
          setError('Failed to search users');
        }
      } finally {
        setIsSearching(false);
      }
    }

    searchDiscovery();
  }, [debouncedInput]);

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-2 mb-4 shrink-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search username or enter code..." 
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (input.trim() !== '') setIsOpen(true);
          }}
          className="h-9 pl-9 text-sm"
        />
        {isSearching && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && input.trim() !== '' && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-[300px] overflow-y-auto">
          {error ? (
            <div className="p-3 text-sm text-destructive text-center">{error}</div>
          ) : isSearching && results.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">No users found</div>
          ) : (
            <div className="p-1">
              {results.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        {user.avatar ? (
                          <AvatarImage src={user.avatar.url} className="object-cover" />
                        ) : null}
                        <AvatarFallback>{(user.display_name || user.username || '?')[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {user.is_online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-background rounded-full"></span>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium truncate">
                        {user.display_name || user.username || 'Unknown User'}
                      </span>
                      {user.username && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          @{user.username}
                        </span>
                      )}
                      {user.discovered_via && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          via {user.discovered_via}
                        </span>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const incomingPing = incoming.find(item => item.peer.id === user.id)?.ping;
                    
                    switch (user.ping_status) {
                      case 'accepted':
                        return (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            onClick={() => {
                              onSelectUser(user.id);
                              setInput('');
                              setResults([]);
                              setIsOpen(false);
                            }}
                            className="shrink-0 ml-2"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        );
                      case 'incoming_pending':
                        return (
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => {
                                if (incomingPing) {
                                  acceptPing(incomingPing.id).then(() => {
                                    onSelectUser(user.id);
                                    setInput('');
                                    setResults([]);
                                    setIsOpen(false);
                                  });
                                }
                              }}
                              disabled={isAccepting || !incomingPing}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="outline" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => incomingPing && declinePing(incomingPing.id)}
                              disabled={isDeclining || !incomingPing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      case 'outgoing_pending':
                        return (
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled
                            className="shrink-0 ml-2"
                          >
                            <Clock className="h-4 w-4 mr-1" />
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
                            className="shrink-0 ml-2"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Send Ping
                          </Button>
                        );
                    }
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
