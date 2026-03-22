import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { APP_ROUTES, getAbsoluteAppUrl } from '@/app/routes';
import { discoveryApi } from '@/api/endpoints';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Check, Copy, Link as LinkIcon, Loader2, RefreshCw } from 'lucide-react';

export default function DiscoverySettingsTab() {
  const [code, setCode] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const regenerateCodeMutation = useMutation({
    mutationFn: () => discoveryApi.regenerateCode().then((res) => res.data),
    onSuccess: (data: any) => {
      setCode(data.data.code);
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: () => discoveryApi.createLink(604800, 10).then((res) => res.data),
    onSuccess: (data: any) => {
      const backendUrl = data.data.url;
      try {
        const urlObj = new URL(backendUrl);
        const token = urlObj.pathname.split('/').pop();
        if (token) {
          setLink(getAbsoluteAppUrl(APP_ROUTES.invite(token)));
        } else {
          setLink(backendUrl);
        }
      } catch (e) {
        setLink(backendUrl);
      }
    },
  });

  const copyToClipboard = (text: string, setCopied: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PanelSection title="Discovery" description="Generate shareable discovery codes and invite links.">
      <div className="space-y-8">
        <div>
          <h4 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">Discovery Code</h4>
          <p className="mb-4 text-sm text-muted-foreground">
            Share your personal discovery code with friends so they can find you and start a chat.
          </p>

          {code ? (
            <div className="mb-4 flex items-center gap-2">
              <div className="flex-1 rounded-lg border bg-muted/50 p-3 text-center font-mono text-lg font-bold tracking-widest">
                {code}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(code, setCopiedCode)}
                className="h-12 w-12 shrink-0"
              >
                {copiedCode ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
          ) : null}

          <Button
            onClick={() => regenerateCodeMutation.mutate()}
            disabled={regenerateCodeMutation.isPending}
            variant={code ? 'secondary' : 'default'}
            className="w-full sm:w-auto"
          >
            {regenerateCodeMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {code ? 'Regenerate Code' : 'Generate Discovery Code'}
          </Button>
        </div>

        <div className="border-t pt-6">
          <h4 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">Invite Link</h4>
          <p className="mb-4 text-sm text-muted-foreground">
            Create a shareable invite link that expires in 7 days (max 10 uses).
          </p>

          {link ? (
            <div className="mb-4 flex items-center gap-2">
              <div className="flex-1 truncate rounded-lg border bg-muted/50 p-3 text-sm">{link}</div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(link, setCopiedLink)}
                className="h-12 w-12 shrink-0"
              >
                {copiedLink ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
          ) : null}

          <Button
            onClick={() => createLinkMutation.mutate()}
            disabled={createLinkMutation.isPending}
            variant={link ? 'secondary' : 'default'}
            className="w-full sm:w-auto"
          >
            {createLinkMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="mr-2 h-4 w-4" />
            )}
            {link ? 'Create New Link' : 'Create Invite Link'}
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}
