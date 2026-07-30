import { PageTabs } from '@/components/page/PageTabs';
import type { PageTab } from '@/components/page/pageTypes';
import type { ManageSectionId } from './types';

interface ManageSectionNavProps {
  sections: readonly PageTab[];
  activeSection: ManageSectionId;
  onSelect: (section: ManageSectionId) => void;
}

/** The section switcher for a management page — the app's one shared tab treatment. */
export function ManageSectionNav({ sections, activeSection, onSelect }: ManageSectionNavProps) {
  return (
    <PageTabs
      tabs={sections}
      activeTabId={activeSection}
      onSelect={(id) => onSelect(id as ManageSectionId)}
      aria-label="Manage sections"
    />
  );
}
