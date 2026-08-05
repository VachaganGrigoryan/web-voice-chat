import React from 'react';
import { Image, Loader2, Paperclip, Smile } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  POST_STYLES,
  canStylePost,
  resolvePostStyle,
  type PostStyleId,
} from '../postStyles';

interface ComposerPostBoxProps {
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  isBusy: boolean;
  attachmentCount: number;
  styleId: PostStyleId;
  submitLabel: string;
  onTextChange: (value: string) => void;
  onStyleChange: (styleId: PostStyleId) => void;
  onTogglePanel: (panel: 'emoji' | 'attachments') => void;
  onPickMedia: () => void;
  onSubmit: () => void;
}

/**
 * The post-box chrome: a large body, a background picker for short text-only
 * posts, and one row of the same attachment affordances the docked bar offers.
 * It owns no upload, no send and no panel state — those come from the composer
 * it renders inside.
 */
export function ComposerPostBox({
  text,
  textareaRef,
  isBusy,
  attachmentCount,
  styleId,
  submitLabel,
  onTextChange,
  onStyleChange,
  onTogglePanel,
  onPickMedia,
  onSubmit,
}: ComposerPostBoxProps) {
  const style = resolvePostStyle(styleId);
  const stylingAllowed = canStylePost(text, attachmentCount);
  const isStyled = stylingAllowed && style.id !== 'plain';
  const canSubmit = text.trim().length > 0 && !isBusy;

  return (
    <div className="space-y-3">
      <label htmlFor="post-composer-body" className="sr-only">
        Write a post
      </label>
      <textarea
        id="post-composer-body"
        ref={textareaRef}
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        rows={isStyled ? 5 : 6}
        placeholder="What do you want to share?"
        className={cn(
          'w-full resize-none rounded-2xl border border-input px-4 py-3 transition-colors duration-200',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          isStyled
            ? cn(
                'border-transparent text-center text-lg font-semibold leading-8 placeholder:text-white/70',
                style.className
              )
            : 'bg-background text-sm leading-6'
        )}
      />

      {stylingAllowed ? (
        <div role="radiogroup" aria-label="Post background" className="flex flex-wrap items-center gap-2">
          {POST_STYLES.map((option) => {
            const isActive = option.id === styleId;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={option.label}
                title={option.label}
                onClick={() => onStyleChange(option.id)}
                className={cn(
                  'h-8 w-8 cursor-pointer rounded-full transition-transform duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  option.swatchClassName,
                  isActive && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                )}
              />
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 cursor-pointer rounded-full"
            aria-label="Add photos or video"
            title="Add photos or video"
            onClick={onPickMedia}
          >
            <Image className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 cursor-pointer rounded-full"
            aria-label="More attachments"
            title="Files, polls, location and contacts"
            onClick={() => onTogglePanel('attachments')}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 cursor-pointer rounded-full"
            aria-label="Add an emoji"
            title="Add an emoji"
            onClick={() => onTogglePanel('emoji')}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </div>

        <Button type="button" disabled={!canSubmit} onClick={onSubmit} className="cursor-pointer">
          {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
