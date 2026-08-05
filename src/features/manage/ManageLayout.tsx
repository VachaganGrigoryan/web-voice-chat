import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { PanelPageLayout } from '@/components/panel/PanelPageLayout';
import type { PageTab } from '@/components/page/pageTypes';
import { ManageForbidden } from './ManageForbidden';
import { ManageSectionNav } from './ManageSectionNav';
import { useManageCapabilities, type ManageCapabilities } from './useManageCapabilities';
import type { ManageResource, ManageSectionId } from './types';

interface ManageLayoutProps {
  resource: ManageResource;
  resourceLabel: string;
  title: string;
  description?: string;
  onBack: () => void;
  sections: readonly PageTab[];
  /**
   * Derives the nav from resolved capabilities, so the route shows exactly the
   * sections the settings registry resolves. Takes precedence over `sections`.
   */
  sectionsFor?: (capabilities: ManageCapabilities) => readonly PageTab[];
  activeSection: ManageSectionId;
  onSelectSection: (section: ManageSectionId) => void;
  children: (capabilities: ManageCapabilities) => ReactNode;
}

/**
 * The shared chrome for every management page: a back-to-resource header, the
 * section nav, and the one capability guard the whole subtree relies on.
 * `resource.manage` decides whether anything past this point renders.
 */
export function ManageLayout({
  resource,
  resourceLabel,
  title,
  description,
  onBack,
  sections,
  sectionsFor,
  activeSection,
  onSelectSection,
  children,
}: ManageLayoutProps) {
  const capabilities = useManageCapabilities(resource);

  if (capabilities.isLoading) {
    return (
      <PanelPageLayout title={title} onBack={onBack}>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PanelPageLayout>
    );
  }

  if (!capabilities.canManage) {
    return (
      <PanelPageLayout title={title} onBack={onBack}>
        <ManageForbidden resourceLabel={resourceLabel} />
      </PanelPageLayout>
    );
  }

  return (
    <PanelPageLayout
      title={title}
      description={description}
      onBack={onBack}
      nav={
        <ManageSectionNav
          sections={sectionsFor ? sectionsFor(capabilities) : sections}
          activeSection={activeSection}
          onSelect={onSelectSection}
        />
      }
    >
      {children(capabilities)}
    </PanelPageLayout>
  );
}
