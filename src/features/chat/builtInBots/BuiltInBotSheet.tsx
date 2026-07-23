import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { BuiltInBotDefinition } from './types';

interface BuiltInBotSheetProps {
  bot: BuiltInBotDefinition;
  isMobileViewport: boolean;
  children: React.ReactNode;
  onClose: () => void;
}

export function BuiltInBotSheet({
  bot,
  isMobileViewport,
  children,
  onClose,
}: BuiltInBotSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const Icon = bot.Icon;

  useEffect(() => {
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, textarea, button, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  }, [bot.id]);

  return (
    <div
      ref={panelRef}
      className={cn(
        'z-50 rounded-[24px] border border-border/70 bg-background/98 p-3 shadow-2xl backdrop-blur-xl',
        isMobileViewport
          ? 'mb-0 rounded-b-none border-b-0'
          : 'absolute bottom-full left-0 right-0 mb-3'
      )}
      role="dialog"
      aria-label={bot.name}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              {bot.name}
            </span>
            <span className="block text-xs text-muted-foreground">
              {bot.description}
            </span>
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-full"
          onClick={onClose}
          aria-label={`Close ${bot.name}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {children}
    </div>
  );
}
