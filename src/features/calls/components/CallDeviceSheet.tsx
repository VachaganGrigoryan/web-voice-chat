import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  setBrowserAudioOutput,
  switchCamera,
  switchMicrophone,
  useCallStore,
} from '../callController';
import { CALL_BRAND_PRIMARY, getCallBrandColor } from '../callBrand';
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
          ? 'text-white'
          : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10',
        disabled && 'cursor-wait opacity-70'
      )}
      style={
        selected
          ? {
              borderColor: getCallBrandColor(0.38),
              backgroundColor: getCallBrandColor(0.14),
            }
          : undefined
      }
      onClick={onClick}
      disabled={disabled}
    >
      <span className="pr-4 text-sm font-medium">{label}</span>
      {selected ? <Check className="h-4 w-4" style={{ color: CALL_BRAND_PRIMARY }} /> : null}
    </button>
  );
}

export function CallDeviceSheet({
  open,
  onOpenChange,
  isVideoCall,
  allowCameraSelection = false,
  desktopMode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isVideoCall: boolean;
  allowCameraSelection?: boolean;
  desktopMode?: boolean;
}) {
  const availableMicrophones = useCallStore((state) => state.availableMicrophones);
  const availableCameras = useCallStore((state) => state.availableCameras);
  const availableAudioRoutes = useCallStore((state) => state.availableAudioRoutes);
  const browserAudioOutputSupported = useCallStore((state) => state.browserAudioOutputSupported);
  const selectedMicrophoneId = useCallStore((state) => state.selectedMicrophoneId);
  const selectedCameraId = useCallStore((state) => state.selectedCameraId);
  const selectedAudioRouteId = useCallStore((state) => state.selectedAudioRouteId);
  const [pendingSection, setPendingSection] = useState<
    'camera' | 'microphone' | 'audio' | null
  >(null);

  const showCameraSection = allowCameraSelection && isVideoCall;
  const showMicrophoneSection = desktopMode || availableMicrophones.length > 1;
  const showAudioSection = desktopMode || browserAudioOutputSupported || availableAudioRoutes.length > 1;

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
            {desktopMode ? 'Call settings' : 'Audio devices'}
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/60">
            {desktopMode
              ? 'Change camera, microphone, and speaker settings without leaving the current call.'
              : 'Change microphones and speakers without leaving the current call.'}
          </DialogDescription>
        </div>

        <div className="space-y-6 px-6 py-6">
          {showCameraSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Camera
              </div>
              {availableCameras.length ? (
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
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                  No camera devices are available right now.
                </div>
              )}
            </div>
          ) : null}

          {showAudioSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Speaker
              </div>
              {browserAudioOutputSupported ? (
                availableAudioRoutes.length ? (
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
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                    No alternate speaker outputs are available right now.
                  </div>
                )
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                  This browser does not let websites switch speaker outputs during a call.
                </div>
              )}
            </div>
          ) : null}

          {showMicrophoneSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Microphone
              </div>
              {availableMicrophones.length ? (
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
              ) : (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
                  No microphone devices are available right now.
                </div>
              )}
            </div>
          ) : null}

          {!desktopMode && !showAudioSection && !showMicrophoneSection && isVideoCall ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65">
              Camera switching is handled from the flip button on the call screen.
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CallDeviceSheet;
