import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  setBrowserAudioOutput,
  switchCamera,
  switchMicrophone,
  useCallStore,
} from '../callController';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

function CallDeviceOption({
  label,
  selected,
  disabled = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between rounded-3xl border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-sky-400/35 bg-sky-500/10 text-white'
          : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10',
        disabled && 'cursor-wait opacity-70'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="pr-4 text-sm font-medium">{label}</span>
      {selected ? <Check className="h-4 w-4 text-sky-300" /> : null}
    </button>
  );
}

export function CallDeviceSheet({
  open,
  onOpenChange,
  isVideoCall,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isVideoCall: boolean;
}) {
  const availableMicrophones = useCallStore((state) => state.availableMicrophones);
  const availableCameras = useCallStore((state) => state.availableCameras);
  const availableAudioRoutes = useCallStore((state) => state.availableAudioRoutes);
  const selectedMicrophoneId = useCallStore((state) => state.selectedMicrophoneId);
  const selectedCameraId = useCallStore((state) => state.selectedCameraId);
  const selectedAudioRouteId = useCallStore((state) => state.selectedAudioRouteId);
  const [pendingSection, setPendingSection] = useState<
    'microphone' | 'camera' | 'audio' | null
  >(null);

  const showMicrophoneSection = availableMicrophones.length > 1;
  const showCameraSection = isVideoCall && availableCameras.length > 1;
  const showAudioSection = availableAudioRoutes.length > 1;

  const selectMicrophone = async (deviceId: string) => {
    setPendingSection('microphone');
    try {
      await switchMicrophone(deviceId);
    } catch (error) {
      console.error('Failed to switch microphone:', error);
      toast.error('Unable to switch the microphone.');
    } finally {
      setPendingSection(null);
    }
  };

  const selectCamera = async (deviceId: string) => {
    setPendingSection('camera');
    try {
      await switchCamera(deviceId);
    } catch (error) {
      console.error('Failed to switch camera:', error);
      toast.error('Unable to switch the camera.');
    } finally {
      setPendingSection(null);
    }
  };

  const selectAudioOutput = async (routeId: string) => {
    setPendingSection('audio');
    try {
      await setBrowserAudioOutput(routeId);
    } catch (error) {
      console.error('Failed to switch audio output:', error);
    } finally {
      setPendingSection(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[119] bg-black/88 backdrop-blur-md"
        className="z-[120] max-w-xl border-white/10 bg-slate-950/95 p-0 text-white shadow-2xl sm:rounded-[30px]"
      >
        <div className="border-b border-white/10 px-6 py-5">
          <DialogTitle className="text-base font-semibold text-white">
            Audio and camera
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/60">
            Change devices without leaving the current call.
          </DialogDescription>
        </div>

        <div className="space-y-6 px-6 py-6">
          {showAudioSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Speaker
              </div>
              <div className="space-y-2">
                {availableAudioRoutes.map((route) => (
                  <CallDeviceOption
                    key={route.id}
                    label={route.label}
                    selected={selectedAudioRouteId === route.id}
                    disabled={pendingSection === 'audio'}
                    onClick={() => void selectAudioOutput(route.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {showMicrophoneSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Microphone
              </div>
              <div className="space-y-2">
                {availableMicrophones.map((device) => (
                  <CallDeviceOption
                    key={device.id}
                    label={device.label}
                    selected={selectedMicrophoneId === device.id}
                    disabled={pendingSection === 'microphone'}
                    onClick={() => void selectMicrophone(device.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {showCameraSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Camera
              </div>
              <div className="space-y-2">
                {availableCameras.map((device) => (
                  <CallDeviceOption
                    key={device.id}
                    label={device.label}
                    selected={selectedCameraId === device.id}
                    disabled={pendingSection === 'camera'}
                    onClick={() => void selectCamera(device.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CallDeviceSheet;
