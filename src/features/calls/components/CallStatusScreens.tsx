import { Loader2, Phone, PhoneIncoming, PhoneMissed, PhoneOff, RotateCcw } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/socket/socket';
import { Button } from '@/components/ui/Button';
import {
  acceptIncomingCall,
  endCurrentCall,
  rejectIncomingCall,
  useCallStore,
} from '../callController';
import { CallPeerAvatar, formatCountdown, getAvatarUrl, getPeerLabel } from './callUi';

function StatusScreenShell({
  badge,
  badgeTone = 'info',
  peerLabel,
  avatarUrl,
  statusLabel,
  children,
  footer,
}: {
  badge: React.ReactNode;
  badgeTone?: 'info' | 'danger';
  peerLabel: string;
  avatarUrl?: string;
  statusLabel: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_rgba(2,6,23,0.98)_72%)] text-white">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.24),_transparent_62%)]" />
      <div className={badgeTone === 'danger' ? 'absolute bottom-[-8rem] right-[-4rem] h-72 w-72 rounded-full bg-red-500/10 blur-3xl' : 'absolute bottom-[-8rem] right-[-4rem] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl'} />
      <div className="absolute left-[-6rem] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative flex h-full flex-col px-4 pb-6 pt-5 sm:px-6">
        <div className="flex justify-center">
          <div className={badgeTone === 'danger' ? 'inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-red-100' : 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/72'}>
            {badge}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-lg rounded-[40px] border border-white/10 bg-black/25 px-8 py-10 text-center shadow-2xl backdrop-blur-xl">
            <CallPeerAvatar
              peerLabel={peerLabel}
              avatarUrl={avatarUrl}
              className="mx-auto h-28 w-28 border-2 border-white/15 shadow-2xl"
              fallbackClassName="text-4xl"
            />
            <div className="mt-6 text-3xl font-semibold tracking-tight">{peerLabel}</div>
            <div className="mt-2 text-sm text-white/70">{statusLabel}</div>
            {children}
          </div>
        </div>

        {footer ? <div className="flex justify-center">{footer}</div> : null}
      </div>
    </div>
  );
}

export function RingingCallScreen() {
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const isAccepting = useCallStore((state) => state.isAccepting);
  const isStarting = useCallStore((state) => state.isStarting);
  const isEnding = useCallStore((state) => state.isEnding);

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const isIncoming = phase === 'incoming-ringing';
  const isVideoCall = call?.type === 'video';

  return (
    <StatusScreenShell
      badge={
        <>
          {isIncoming ? (
            <PhoneIncoming className="h-3.5 w-3.5" />
          ) : (
            <Phone className="h-3.5 w-3.5" />
          )}
          {isVideoCall ? 'Video call' : 'Audio call'}
        </>
      }
      peerLabel={peerLabel}
      avatarUrl={avatarUrl}
      statusLabel={isIncoming ? 'Incoming call' : isStarting ? 'Starting call…' : 'Calling…'}
      footer={
        <div className="flex items-center gap-3 rounded-[32px] border border-white/10 bg-black/45 px-5 py-4 shadow-2xl backdrop-blur-md">
          {isIncoming ? (
            <Button
              type="button"
              size="lg"
              className="min-w-36 rounded-[22px] bg-emerald-500 text-white hover:bg-emerald-600"
              onClick={() => void acceptIncomingCall()}
              disabled={isAccepting || isEnding}
            >
              {isAccepting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Phone className="mr-2 h-4 w-4" />
              )}
              Accept
            </Button>
          ) : null}

          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="min-w-36 rounded-[22px]"
            onClick={() => void (isIncoming ? rejectIncomingCall() : endCurrentCall())}
            disabled={isAccepting || isEnding}
          >
            {isEnding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isIncoming ? (
              <PhoneMissed className="mr-2 h-4 w-4" />
            ) : (
              <PhoneOff className="mr-2 h-4 w-4" />
            )}
            {isIncoming ? 'Decline' : 'Cancel'}
          </Button>
        </div>
      }
    />
  );
}

export function ReconnectingCallScreen({
  remainingMs,
  onRetry,
}: {
  remainingMs: number | null;
  onRetry: () => void;
}) {
  const currentUserId = useAuthStore((state) => state.userId);
  const isSocketConnected = useSocketStore((state) => state.isConnected);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const isResuming = useCallStore((state) => state.isResuming);
  const error = useCallStore((state) => state.error);
  const isEnding = useCallStore((state) => state.isEnding);

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const peerUserId = call && currentUserId
    ? call.caller_user_id === currentUserId
      ? call.callee_user_id
      : call.caller_user_id
    : null;
  const peerDisconnected = !!peerUserId && !!call?.disconnected_user_ids.includes(peerUserId);
  const selfDisconnected =
    !!currentUserId && !!call?.disconnected_user_ids.includes(currentUserId);
  const disconnectedLabels = [
    selfDisconnected ? 'You' : null,
    peerDisconnected ? peerLabel : null,
  ].filter(Boolean);
  const countdownLabel = formatCountdown(remainingMs);

  const statusLabel = !isSocketConnected
    ? 'Reconnecting to the server…'
    : isResuming
      ? 'Restoring the call…'
      : peerDisconnected
        ? `Waiting for ${peerLabel} to reconnect…`
        : selfDisconnected
          ? 'Rejoining the call…'
          : 'Recovering the call…';

  return (
    <StatusScreenShell
      badge={
        <>
          <RotateCcw className="h-3.5 w-3.5" />
          Recovering call
        </>
      }
      peerLabel={peerLabel}
      avatarUrl={avatarUrl}
      statusLabel={statusLabel}
      footer={
        <div className="flex items-center gap-3 rounded-[32px] border border-white/10 bg-black/45 px-5 py-4 shadow-2xl backdrop-blur-md">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            className="min-w-36 rounded-[22px] bg-white/10 text-white hover:bg-white/15"
            onClick={onRetry}
            disabled={!isSocketConnected || isResuming || isEnding}
          >
            {isResuming ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Retry
          </Button>

          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="min-w-36 rounded-[22px]"
            onClick={() => void endCurrentCall()}
            disabled={isEnding}
          >
            {isEnding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PhoneOff className="mr-2 h-4 w-4" />
            )}
            End call
          </Button>
        </div>
      }
    >
      {countdownLabel ? (
        <div className="mt-4 inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
          Grace window: {countdownLabel} remaining
        </div>
      ) : null}

      {disconnectedLabels.length ? (
        <div className="mt-4 text-xs text-white/60">
          Disconnected: {disconnectedLabels.join(', ')}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-3xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}
    </StatusScreenShell>
  );
}

export function EndedCallScreen() {
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const endScreenMessage = useCallStore((state) => state.endScreenMessage);

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const statusLabel =
    call?.status === 'rejected'
      ? 'Call declined'
      : call?.status === 'expired'
        ? 'Missed call'
        : call?.status === 'cancelled'
          ? 'Call cancelled'
          : call?.type === 'video'
            ? 'Video call ended'
            : 'Audio call ended';

  return (
    <StatusScreenShell
      badgeTone="danger"
      badge={
        <>
          <PhoneOff className="h-3.5 w-3.5" />
          {statusLabel}
        </>
      }
      peerLabel={peerLabel}
      avatarUrl={avatarUrl}
      statusLabel={endScreenMessage || 'The call ended.'}
    >
      <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/45">
        Closing…
      </div>
    </StatusScreenShell>
  );
}
