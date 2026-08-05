import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '@/app/routes';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { useManageCapabilities } from '@/features/manage/useManageCapabilities';
import type { ContainerDescriptor } from '@/container';
import { ContainerSettings } from './ContainerSettings';
import { useContainerSettingsData } from './useContainerSettingsData';
import { subjectFromDescriptor } from './types';
import type { SettingsSectionId } from './sections/registry';

interface ContainerSettingsSheetProps {
  descriptor: ContainerDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Settings without leaving the conversation. The same component the management
 * route renders — only the chrome differs — so a viewer sees the same sections
 * whichever way they opened it.
 */
export function ContainerSettingsSheet({
  descriptor,
  open,
  onOpenChange,
}: ContainerSettingsSheetProps) {
  const [sectionId, setSectionId] = useState<SettingsSectionId>('general');
  const navigate = useNavigate();
  const subject = subjectFromDescriptor(descriptor);
  const capabilities = useManageCapabilities(subject.resource);
  const data = useContainerSettingsData(subject, {
    // A deleted container has no chat to return to, so the sheet closes and the
    // inbox takes over rather than leaving a dead surface open.
    onDeleted: () => {
      onOpenChange(false);
      navigate(APP_ROUTES.chat);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{subject.title}</SheetTitle>
          <SheetDescription>Settings for this conversation.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <ContainerSettings
            subject={subject}
            capabilities={capabilities}
            data={data}
            activeSectionId={sectionId}
            onSectionChange={setSectionId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
