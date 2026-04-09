import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { discoveryApi } from '@/api/endpoints';
import { APP_ROUTES } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { BRAND } from '@/shared/branding/brand';
import { Logo } from '@/shared/branding/Logo';
import { LogoSymbol } from '@/shared/branding/LogoSymbol';
import { AlertTriangle, Bell, Loader2, MessageSquare, UserPlus } from 'lucide-react';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => discoveryApi.resolveLink(token!),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
            <LogoSymbol size="md" className="animate-[pulse_3.4s_ease-in-out_infinite]" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {BRAND.shortName} invite…
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Invalid or Expired Link</h2>
          <p className="text-sm text-muted-foreground">
            This invite link is no longer valid. It may have expired or reached its usage limit.
          </p>
          <Button onClick={() => navigate(APP_ROUTES.root)} className="mt-4 w-full">
            Go to App
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="flex justify-center">
          <Logo variant="wordmark" size="md" />
        </div>
        <div className="space-y-4">
          <Avatar className="mx-auto h-24 w-24 border-4 border-background shadow-sm">
            {user.avatar ? <AvatarImage src={user.avatar.url} className="object-cover" /> : null}
            <AvatarFallback className="bg-muted text-3xl">
              {(user.display_name || user.username || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">{user.display_name || user.username || 'Unknown User'}</h2>
            {user.username ? <p className="text-muted-foreground">@{user.username}</p> : null}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">You’ve been invited to connect on {BRAND.name}.</p>

        <div className="pt-4">
          {isAuthenticated ? (
            <Button
              onClick={() => navigate(APP_ROUTES.chatPeer(user.id))}
              className="h-12 w-full text-base"
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
              onClick={() =>
                navigate(`${APP_ROUTES.auth}?redirect=${encodeURIComponent(APP_ROUTES.chatPeer(user.id))}`)
              }
              className="h-12 w-full text-base"
            >
              Sign in to {BRAND.name}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
