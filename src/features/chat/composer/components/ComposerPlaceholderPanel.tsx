import React from 'react';

interface ComposerPlaceholderPanelProps {
  title: string;
  description: string;
}

export function ComposerPlaceholderPanel({
  title,
  description,
}: ComposerPlaceholderPanelProps) {
  return (
    <div className="flex h-[18rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 text-center">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
}
