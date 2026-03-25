import React from 'react';
import { FileText, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';

interface ComposerAttachmentPanelProps {
  isMobileViewport?: boolean;
  attachMode: 'media' | 'file';
  onAttachModeChange: (mode: 'media' | 'file') => void;
  onPickAttachments: (mode: 'media' | 'file') => void;
  isBusy: boolean;
}

export function ComposerAttachmentPanel({
  isMobileViewport = false,
  attachMode,
  onAttachModeChange,
  onPickAttachments,
  isBusy,
}: ComposerAttachmentPanelProps) {
  const renderMobileMediaPanel = () => (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
          <ImagePlus className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">
            Gallery / Media
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Choose photos, videos, or audio clips using the current media picker flow.
          </div>
        </div>
      </div>
      <Button
        className="mt-4 w-full rounded-full"
        onClick={() => onPickAttachments('media')}
        disabled={isBusy}
      >
        Open media picker
      </Button>
    </div>
  );

  return (
    <Tabs
      value={attachMode}
      onValueChange={(value) => onAttachModeChange(value as 'media' | 'file')}
      className="flex h-full min-h-0 w-full flex-col"
    >
      <TabsList
        className={cn(
          'grid w-full shrink-0 grid-cols-2 bg-muted/50',
          isMobileViewport ? 'h-10 rounded-xl' : 'h-11 rounded-2xl'
        )}
      >
        <TabsTrigger
          value="media"
          className={cn(
            'text-xs sm:text-sm',
            isMobileViewport ? 'rounded-lg' : 'rounded-xl'
          )}
        >
          Media
        </TabsTrigger>
        <TabsTrigger
          value="file"
          className={cn(
            'text-xs sm:text-sm',
            isMobileViewport ? 'rounded-lg' : 'rounded-xl'
          )}
        >
          Files
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="media"
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          isMobileViewport ? 'mt-2' : 'mt-3'
        )}
      >
        {isMobileViewport ? (
          renderMobileMediaPanel()
        ) : (
          <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
                <ImagePlus className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">
                  Gallery / Media
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Choose photos, videos, or audio clips. Batch preview, caption, retry, and send keep the current working flow.
                </div>
              </div>
            </div>
            <Button
              className="mt-4 w-full rounded-full"
              onClick={() => onPickAttachments('media')}
              disabled={isBusy}
            >
              Open media picker
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent
        value="file"
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          isMobileViewport ? 'mt-2' : 'mt-3'
        )}
      >
        <div className="rounded-2xl border border-border/70 bg-muted/15 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-primary/10 p-2 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">Files</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Attach documents, archives, or other supported files up to 25MB.
              </div>
            </div>
          </div>
          <Button
            className="mt-4 w-full rounded-full"
            onClick={() => onPickAttachments('file')}
            disabled={isBusy}
          >
            Open file picker
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
