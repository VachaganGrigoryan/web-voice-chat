import type { ReactNode } from 'react';
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getCallBrandColor } from '../callBrand';

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
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        color: '#0a0a0a',
        boxShadow: `0 18px 44px ${getCallBrandColor(0.12)}`,
      }
    : undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant={destructive ? 'destructive' : 'secondary'}
        className={cn(
          'h-14 w-14 rounded-[22px] border shadow-lg backdrop-blur-md',
          destructive
            ? 'border-red-400/25 bg-red-500 text-white hover:bg-red-600'
            : active
              ? 'border-white/15 hover:bg-white'
              : 'border-white/10 bg-black/45 text-white hover:bg-black/55',
          disabled && !destructive && 'border-white/8 bg-black/35 text-white/45 hover:bg-black/35'
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
  showSpeakerButton = true,
  speakerLabel = 'Audio',
  speakerActive,
  speakerIcon,
  isCyclingSpeaker = false,
  onToggleMicrophone,
  onToggleCamera,
  onSpeakerPress,
  onEndCall,
  className,
}: {
  isVideoCall: boolean;
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  isEnding: boolean;
  showSpeakerButton?: boolean;
  speakerLabel?: string;
  speakerActive: boolean;
  speakerIcon?: ReactNode;
  isCyclingSpeaker?: boolean;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onSpeakerPress: () => void;
  onEndCall: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'absolute inset-x-0 bottom-0 flex justify-center px-4 pb-6 sm:px-6',
        className
      )}
    >
      <div className="flex items-end gap-4 rounded-[32px] border border-white/10 bg-black/60 px-5 py-4 shadow-2xl backdrop-blur-xl">
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

        {showSpeakerButton ? (
          <CallControlButton
            label={speakerLabel}
            active={speakerActive}
            disabled={isCyclingSpeaker}
            onClick={onSpeakerPress}
          >
            {isCyclingSpeaker ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              speakerIcon || <Volume2 className="h-5 w-5" />
            )}
          </CallControlButton>
        ) : null}

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
