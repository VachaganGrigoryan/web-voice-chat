import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { startRegistration } from '@simplewebauthn/browser';
import { authApi } from '@/api/endpoints';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatMessageDay } from '@/utils/dateUtils';
import { AlertTriangle, KeyRound, Loader2, Trash2 } from 'lucide-react';

export default function PasskeysSettingsTab() {
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    setIsIframe(window !== window.top);
  }, []);

  const { data: passkeys = [], isLoading } = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => authApi.passkeys.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authApi.passkeys.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
    },
  });

  const handleAddPasskey = async () => {
    setIsRegistering(true);
    setError(null);
    try {
      const deviceName = nickname.trim() || 'My Device';
      const optionsPayload = await authApi.passkeys.registerStart(deviceName) as Record<string, any>;
      const options = 'optionsJSON' in optionsPayload
        ? { ...optionsPayload }
        : { optionsJSON: optionsPayload };

      if (options.optionsJSON?.authenticatorSelection) {
        options.optionsJSON.authenticatorSelection.authenticatorAttachment = undefined;
        options.optionsJSON.authenticatorSelection.residentKey = 'preferred';
        options.optionsJSON.authenticatorSelection.userVerification = 'preferred';
      } else {
        options.optionsJSON = {
          ...options.optionsJSON,
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
        };
      }

      const credential = await startRegistration(options as Parameters<typeof startRegistration>[0]);

      try {
        if (credential.response && credential.response.clientDataJSON) {
          const base64 = credential.response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/');
          const padLen = (4 - (base64.length % 4)) % 4;
          const padded = base64 + '='.repeat(padLen);
          const jsonStr = atob(padded);
          const clientData = JSON.parse(jsonStr);

          let modified = false;
          if (clientData.crossOrigin) {
            clientData.crossOrigin = false;
            modified = true;
          }
          if (clientData.sameOriginWithAncestors === false) {
            delete clientData.sameOriginWithAncestors;
            modified = true;
          }

          if (modified) {
            const modifiedJsonStr = JSON.stringify(clientData);
            const modifiedBase64 = btoa(modifiedJsonStr);
            credential.response.clientDataJSON = modifiedBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
          }
        }
      } catch (e) {
        console.error('Failed to patch clientDataJSON', e);
      }

      await authApi.passkeys.registerFinish({ credential, nickname: deviceName });

      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      setNickname('');
    } catch (err: any) {
      console.error('Failed to register passkey:', err);
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || err.message || 'Failed to register passkey';
      setError(message);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <PanelSection title="Passkeys" description="Manage hardware-backed and password-manager-backed sign-in methods.">
      <div className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">Passkeys</h4>
          <p className="text-sm text-muted-foreground">
            Passkeys allow you to sign in without entering a verification code.
            They use your device security (FaceID, TouchID, Windows Hello).
            Compatible with password managers like Bitwarden.
          </p>
        </div>

        <div className="space-y-4">
          {isIframe ? (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/15 p-3 text-sm text-amber-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                You are running in a preview iframe. If passkey registration fails, please <strong>open the app in a new tab</strong> using the button in the top right corner of AI Studio.
              </p>
            </div>
          ) : null}

          {error ? <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div> : null}

          <div className="space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : passkeys.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No passkeys registered yet.</p>
            ) : (
              <div className="space-y-2">
                {passkeys.map((passkey: any) => {
                  const id = passkey.credential_id || passkey.id;
                  return (
                    <div key={id} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                      <div>
                        <p className="text-sm font-medium">{passkey.nickname || passkey.device_name || passkey.name || 'Unknown Device'}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {passkey.created_at ? formatMessageDay(passkey.created_at) : 'Unknown date'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => deleteMutation.mutate(id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Input
              placeholder="Device name (e.g. MacBook Pro)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1"
              disabled={isRegistering}
            />
            <Button onClick={handleAddPasskey} disabled={isRegistering} className="w-full sm:w-auto">
              {isRegistering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Add Passkey
            </Button>
          </div>
        </div>
      </div>
    </PanelSection>
  );
}
