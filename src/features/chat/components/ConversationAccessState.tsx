import { Bell, Check, Clock, Loader2, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ConversationAccessStateProps {
  pingStatus: string;
  displaySelectedUser: string | null;
  isGhost?: boolean;
  incomingPingId: string | null;
  isAcceptingPing: boolean;
  isDecliningPing: boolean;
  isSendingPing: boolean;
  canSendPing: boolean;
  onAcceptPing: (pingId: string) => void;
  onDeclinePing: (pingId: string) => void;
  onSendPing: () => void;
}

export function ConversationAccessState({
  pingStatus,
  displaySelectedUser,
  isGhost = false,
  incomingPingId,
  isAcceptingPing,
  isDecliningPing,
  isSendingPing,
  canSendPing,
  onAcceptPing,
  onDeclinePing,
  onSendPing,
}: ConversationAccessStateProps) {
  if (pingStatus === 'incoming_pending') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-4 text-center text-muted-foreground">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-8 w-8 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-foreground">Incoming Request</h3>
        <p className="mb-6 max-w-xs text-sm text-muted-foreground">{displaySelectedUser} wants to chat with you.</p>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => incomingPingId && onAcceptPing(incomingPingId)}
            disabled={isAcceptingPing || !incomingPingId}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {isAcceptingPing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Accept
          </Button>
          <Button
            variant="outline"
            onClick={() => incomingPingId && onDeclinePing(incomingPingId)}
            disabled={isDecliningPing || !incomingPingId}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {isDecliningPing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
            Decline
          </Button>
        </div>
      </div>
    );
  }

  if (pingStatus === 'outgoing_pending') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-4 text-center text-muted-foreground">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-foreground">Request Sent</h3>
        <p className="max-w-xs text-sm text-muted-foreground">
          Waiting for {displaySelectedUser} to accept your request.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-4 text-center text-muted-foreground">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <UserPlus className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-foreground">
        {isGhost ? 'Reconnect to Chat' : 'Start Chatting'}
      </h3>
      <p className="mb-6 max-w-xs text-sm text-muted-foreground">
        {isGhost
          ? 'Send a ping to reconnect this chat.'
          : `Send a ping to ${displaySelectedUser} to start a conversation.`}
      </p>
      <Button onClick={onSendPing} disabled={!canSendPing}>
        {isSendingPing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
        Send Ping
      </Button>
    </div>
  );
}
