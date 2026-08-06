import * as React from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './Dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './Sheet';

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Read out to assistive tech; pass a string when the visible title is a node. */
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * One modal that changes shape with the viewport: a bottom sheet where the
 * thumb is, a centred dialog where there is room.
 *
 * Both halves are the same Radix dialog underneath — `Sheet` and `Dialog` only
 * differ in where the content anchors — so this is a wrapper rather than a
 * third dialog implementation. A short body would waste a full-height panel on
 * a wide screen and put its actions out of reach on a narrow one, which is why
 * the shape is chosen rather than fixed.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn('max-h-[85vh] rounded-t-3xl', className)}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer ? <div className="border-t border-border px-4 py-3">{footer}</div> : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-w-md rounded-3xl', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">{children}</div>
        {footer ? <div className="border-t border-border pt-3">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}
