import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { APP_ROUTES } from '@/app/routes';
import { discoveryApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Loader2, MessageSquare, AlertTriangle, UserPlus, Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => discoveryApi.resolveLink(token!).then(res => res.data.data),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background p-4">
        <div className="max-w-md w-full bg-card border rounded-xl p-6 text-center space-y-4 shadow-sm">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Invalid or Expired Link</h2>
          <p className="text-muted-foreground text-sm">
            This invite link is no longer valid. It may have expired or reached its usage limit.
          </p>
          <Button onClick={() => navigate(APP_ROUTES.root)} className="w-full mt-4">
            Go to App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center space-y-6 shadow-sm">
        <div className="space-y-4">
          <Avatar className="h-24 w-24 mx-auto border-4 border-background shadow-sm">
            {user.avatar ? (
              <AvatarImage src={user.avatar.url} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-3xl bg-muted">
              {(user.display_name || user.username || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {user.display_name || user.username || 'Unknown User'}
            </h2>
            {user.username && (
              <p className="text-muted-foreground">@{user.username}</p>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          You've been invited to chat.
        </p>

        <div className="pt-4">
          {isAuthenticated ? (
            <Button 
              onClick={() => navigate(APP_ROUTES.chatPeer(user.id))} 
              className="w-full h-12 text-base"
              disabled={user.ping_status === 'outgoing_pending' || (user.ping_status === 'none' && !user.can_ping)}
            >
              {user.chat_allowed || user.ping_status === 'accepted' ? (
                <>
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Message
                </>
              ) : user.ping_status === 'outgoing_pending' ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Request Pending
                </>
              ) : user.ping_status === 'incoming_pending' ? (
                <>
                  <Bell className="mr-2 h-5 w-5" />
                  Respond to Request
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  Send Ping
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={() => navigate(`${APP_ROUTES.login}?redirect=${encodeURIComponent(APP_ROUTES.chatPeer(user.id))}`)} 
              className="w-full h-12 text-base"
            >
              Sign in to Chat
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
