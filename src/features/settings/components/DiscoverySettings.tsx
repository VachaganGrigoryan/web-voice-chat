import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { discoveryApi } from '@/api/endpoints';
import { Button } from '@/shared/components/ui/Button';
import { Loader2, RefreshCw, Link as LinkIcon, Copy, Check } from 'lucide-react';

export default function DiscoverySettings() {
  const [code, setCode] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const regenerateCodeMutation = useMutation({
    mutationFn: () => discoveryApi.regenerateCode().then(res => res.data),
    onSuccess: (data: any) => {
      setCode(data.data.code);
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: () => discoveryApi.createLink(604800, 10).then(res => res.data),
    onSuccess: (data: any) => {
      const backendUrl = data.data.url;
      try {
        const urlObj = new URL(backendUrl);
        const token = urlObj.pathname.split('/').pop();
        if (token) {
          setLink(`${window.location.origin}/#/invite/${token}`);
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
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Discovery Code</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Share your personal discovery code with friends so they can find you and start a chat.
        </p>
        
        {code ? (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 bg-muted/50 p-3 rounded-lg border font-mono text-center tracking-widest text-lg font-bold">
              {code}
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => copyToClipboard(code, setCopiedCode)}
              className="shrink-0 h-12 w-12"
            >
              {copiedCode ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
            </Button>
          </div>
        ) : null}

        <Button 
          onClick={() => regenerateCodeMutation.mutate()} 
          disabled={regenerateCodeMutation.isPending}
          variant={code ? "secondary" : "default"}
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

      <div className="pt-6 border-t">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Invite Link</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Create a shareable invite link that expires in 7 days (max 10 uses).
        </p>
        
        {link ? (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 bg-muted/50 p-3 rounded-lg border text-sm truncate">
              {link}
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => copyToClipboard(link, setCopiedLink)}
              className="shrink-0 h-12 w-12"
            >
              {copiedLink ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
            </Button>
          </div>
        ) : null}

        <Button 
          onClick={() => createLinkMutation.mutate()} 
          disabled={createLinkMutation.isPending}
          variant={link ? "secondary" : "default"}
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
  );
}
