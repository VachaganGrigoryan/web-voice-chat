import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Loader2, Trash2, KeyRound, AlertTriangle } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { format } from 'date-fns';

export default function PasskeysSettings() {
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
    queryFn: () => authApi.passkeys.list().then(res => res.data?.data?.items || []),
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
      
      // 1. Get options from server
      const optionsRes = await authApi.passkeys.registerStart(deviceName);
      
      // Extract publicKey from response based on API spec
      const options = optionsRes.data.publicKey || optionsRes.data.data?.publicKey || optionsRes.data.data || optionsRes.data;

      // Ensure Bitwarden / password manager support
      if (options.authenticatorSelection) {
        // undefined allows both platform (FaceID/TouchID) and cross-platform (YubiKey/Bitwarden)
        options.authenticatorSelection.authenticatorAttachment = undefined; 
        options.authenticatorSelection.residentKey = "preferred";
        options.authenticatorSelection.userVerification = "preferred";
      } else {
        options.authenticatorSelection = {
          residentKey: "preferred",
          userVerification: "preferred"
        };
      }

      // 2. Call browser API
      const credential = await startRegistration(options);

      // Hack for cross-origin iframe (AI Studio preview)
      // The backend might reject sameOriginWithAncestors: false
      // Since attestation is usually 'none', we can safely patch clientDataJSON
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

      // 3. Send credential to server
      await authApi.passkeys.registerFinish({ credential, nickname: deviceName });

      // 4. Refresh list
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      setNickname('');
    } catch (err: any) {
      console.error('Failed to register passkey:', err);
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || err.message || 'Failed to register passkey';
      setError(message);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Passkeys</h4>
        <p className="text-sm text-muted-foreground">
          Passkeys allow you to sign in without entering a verification code.
          They use your device security (FaceID, TouchID, Windows Hello).
          Compatible with password managers like Bitwarden.
        </p>
      </div>

      <div className="space-y-4">
        {isIframe && (
          <div className="rounded-md bg-amber-500/15 p-3 text-sm text-amber-600 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              You are running in a preview iframe. If passkey registration fails, please <strong>open the app in a new tab</strong> using the button in the top right corner of AI Studio.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : passkeys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No passkeys registered yet.</p>
          ) : (
            <div className="space-y-2">
              {passkeys.map((passkey: any) => {
                const id = passkey.credential_id || passkey.id;
                return (
                <div key={id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium text-sm">{passkey.nickname || passkey.device_name || passkey.name || 'Unknown Device'}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {passkey.created_at ? format(new Date(passkey.created_at), 'MMM d, yyyy') : 'Unknown date'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
              )})}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
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
  );
}
