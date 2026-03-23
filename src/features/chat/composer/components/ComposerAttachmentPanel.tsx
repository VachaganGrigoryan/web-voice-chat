import React from 'react';
import { FileText, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';

interface ComposerAttachmentPanelProps {
  isMobileViewport?: boolean;
  attachMode: 'media' | 'file';
  onAttachModeChange: (mode: 'media' | 'file') => void;
  onPickAttachments: (mode: 'media' | 'file') => void;
  isBusy: boolean;
  isAutoOpeningMedia?: boolean;
}

export function ComposerAttachmentPanel({
  isMobileViewport = false,
  attachMode,
  onAttachModeChange,
  onPickAttachments,
  isBusy,
  isAutoOpeningMedia = false,
}: ComposerAttachmentPanelProps) {
  const renderMobileMediaPanel = () => (
    <button
      type="button"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-muted/20 text-left transition-colors hover:bg-muted/30"
      onClick={() => onPickAttachments('media')}
      disabled={isBusy}
    >
      <div className="grid flex-1 grid-cols-4 gap-1 p-1.5">
        {Array.from({ length: 12 }, (_, index) => (
          <div
            key={index}
            className={cn(
              'aspect-square rounded-xl bg-muted/70',
              index % 3 === 0 && 'bg-muted/55',
              index % 5 === 0 && 'bg-muted/45'
            )}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2.5">
        {isAutoOpeningMedia ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {isAutoOpeningMedia ? 'Opening gallery…' : 'Recent media'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Tap anywhere to reopen your device gallery.
          </div>
        </div>
      </div>
    </button>
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
                  Choose photos and videos. Batch preview, caption, retry, and send keep the current working flow.
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
                Attach documents, images, audio, and supported files using the existing validated upload flow.
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
