import type { ReactNode } from 'react';
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { CALL_BRAND_PRIMARY, getCallBrandColor } from '../callBrand';

function CallControlButton({
  label,
  active = false,
  destructive = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const activeStyle = active
    ? {
        backgroundColor: CALL_BRAND_PRIMARY,
        boxShadow: `0 0 0 1px ${getCallBrandColor(0.28)} inset`,
      }
    : undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant={destructive ? 'destructive' : 'secondary'}
        className={cn(
          'h-14 w-14 rounded-[22px] border border-white/10 shadow-lg backdrop-blur-md',
          destructive
            ? 'border-red-400/25 bg-red-500 text-white hover:bg-red-600'
            : active
              ? 'text-white hover:opacity-95'
              : 'bg-white/10 text-white hover:bg-white/15'
        )}
        style={destructive ? undefined : activeStyle}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </Button>
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
        {label}
      </span>
    </div>
  );
}

export function CallControlDock({
  isVideoCall,
  isMicMuted,
  isCameraEnabled,
  isEnding,
  speakerActive,
  isCyclingSpeaker,
  onToggleMicrophone,
  onToggleCamera,
  onSpeakerPress,
  onEndCall,
}: {
  isVideoCall: boolean;
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  isEnding: boolean;
  speakerActive: boolean;
  isCyclingSpeaker: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onSpeakerPress: () => void;
  onEndCall: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-6 sm:px-6">
      <div className="flex items-end gap-4 rounded-[32px] border border-white/10 bg-black/45 px-5 py-4 shadow-2xl backdrop-blur-md">
        <CallControlButton
          label={isMicMuted ? 'Muted' : 'Mic'}
          active={!isMicMuted}
          onClick={onToggleMicrophone}
        >
          {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </CallControlButton>

        {isVideoCall ? (
          <CallControlButton
            label={isCameraEnabled ? 'Camera' : 'Camera off'}
            active={isCameraEnabled}
            onClick={onToggleCamera}
          >
            {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </CallControlButton>
        ) : null}

        <CallControlButton
          label="Speaker"
          active={speakerActive}
          disabled={isCyclingSpeaker}
          onClick={onSpeakerPress}
        >
          {isCyclingSpeaker ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Volume2 className="h-5 w-5" />
          )}
        </CallControlButton>

        <CallControlButton
          label={isEnding ? 'Ending' : 'Hang up'}
          destructive
          disabled={isEnding}
          onClick={onEndCall}
        >
          {isEnding ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <PhoneOff className="h-5 w-5" />
          )}
        </CallControlButton>
      </div>
    </div>
  );
}

export default CallControlDock;
