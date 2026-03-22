import React from 'react';
import { FileText, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

interface ComposerAttachmentPanelProps {
  attachMode: 'media' | 'file';
  onAttachModeChange: (mode: 'media' | 'file') => void;
  onPickAttachments: (mode: 'media' | 'file') => void;
  isBusy: boolean;
}

export function ComposerAttachmentPanel({
  attachMode,
  onAttachModeChange,
  onPickAttachments,
  isBusy,
}: ComposerAttachmentPanelProps) {
  return (
    <Tabs
      value={attachMode}
      onValueChange={(value) => onAttachModeChange(value as 'media' | 'file')}
      className="w-full"
    >
      <TabsList className="grid h-11 w-full grid-cols-2 rounded-2xl bg-muted/50">
        <TabsTrigger value="media" className="rounded-xl text-xs sm:text-sm">
          Media
        </TabsTrigger>
        <TabsTrigger value="file" className="rounded-xl text-xs sm:text-sm">
          Files
        </TabsTrigger>
      </TabsList>

      <TabsContent value="media" className="mt-3">
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
      </TabsContent>

      <TabsContent value="file" className="mt-3">
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
