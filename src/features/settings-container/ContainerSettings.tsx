import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DangerSection } from '@/features/manage/sections/DangerSection';
import { InvitesSection } from '@/features/manage/sections/InvitesSection';
import { MembersSection } from '@/features/manage/sections/MembersSection';
import { RequestsSection } from '@/features/manage/sections/RequestsSection';
import { AccessSection } from './sections/AccessSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { OverviewSection } from './sections/OverviewSection';
import { RolesPermissionsSection } from './sections/RolesPermissionsSection';
import {
  resolveActiveSection,
  resolveSections,
  type SectionCapabilityView,
  type SettingsSectionDefinition,
  type SettingsSectionId,
} from './sections/registry';
import type { SettingsSectionData } from './sectionData';
import type { SettingsSubject } from './types';

interface ContainerSettingsProps {
  subject: SettingsSubject;
  capabilities: SectionCapabilityView;
  data: SettingsSectionData;
  /** The section to show. Falls back to the first visible one when unknown. */
  activeSectionId?: string;
  onSectionChange: (sectionId: SettingsSectionId) => void;
  /** The route shell already renders a nav, so it suppresses this one. */
  showNav?: boolean;
  className?: string;
}

/**
 * The one settings component. It owns which sections exist for a subject and
 * what each one renders; the shells around it own only chrome. Two shells use
 * it — a slide-over from the container header and the management route — and
 * both get the same sections for the same viewer because both resolve through
 * the same registry.
 */
export function ContainerSettings({
  subject,
  capabilities,
  data,
  activeSectionId,
  onSectionChange,
  showNav = true,
  className,
}: ContainerSettingsProps) {
  const visible = useMemo(
    () => resolveSections(subject.kind, capabilities),
    [subject.kind, capabilities]
  );
  const active = resolveActiveSection(activeSectionId, visible);

  if (!active) {
    return (
      <div className={cn('p-6 text-center text-sm text-muted-foreground', className)}>
        There are no settings you can change here.
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {showNav ? (
        <SectionNav sections={visible} activeId={active.id} onSelect={onSectionChange} />
      ) : null}
      <SectionPane subject={subject} section={active} data={data} />
    </div>
  );
}

function SectionNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: readonly SettingsSectionDefinition[];
  activeId: SettingsSectionId;
  onSelect: (sectionId: SettingsSectionId) => void;
}) {
  return (
    <div className="scrollbar-hidden -mx-1 overflow-x-auto px-1">
      <div role="tablist" aria-label="Settings sections" className="flex gap-1.5">
        {sections.map((section) => {
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={section.description}
              onClick={() => onSelect(section.id)}
              className={cn(
                'min-h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A section whose data is `null` renders nothing rather than an error: the
 * registry already keeps it off the nav, so this is only reachable through a
 * stale deep link.
 */
function SectionPane({
  subject,
  section,
  data,
}: {
  subject: SettingsSubject;
  section: SettingsSectionDefinition;
  data: SettingsSectionData;
}) {
  switch (section.id) {
    case 'general':
      return <OverviewSection data={data.overview} />;

    case 'notifications':
      return data.notifications ? <NotificationsSection data={data.notifications} /> : null;

    case 'access':
      return data.access ? <AccessSection data={data.access} /> : null;

    case 'members':
      return data.members ? (
        <MembersSection
          members={data.members.members}
          isLoading={data.members.isLoading}
          roleSelect={
            data.members.roleOptions && data.members.roleValueFor && data.members.onChangeRole
              ? {
                  options: data.members.roleOptions,
                  valueFor: data.members.roleValueFor,
                  onChange: data.members.onChangeRole,
                  isUpdating: data.members.isUpdatingRole,
                }
              : undefined
          }
          onRemove={data.members.onRemove ?? undefined}
          isRemoving={data.members.isRemoving}
        />
      ) : null;

    case 'roles':
      return data.roles ? (
        <RolesPermissionsSection data={data.roles} scope={subject.resource.type} />
      ) : null;

    case 'invites':
      return data.invites ? (
        <InvitesSection
          onInviteUser={data.invites.onInviteUser}
          isInvitingUser={data.invites.isInvitingUser}
          inviteLinks={data.invites.links ?? undefined}
        />
      ) : null;

    case 'requests':
      return data.requests ? (
        <RequestsSection
          requests={data.requests.requests}
          isLoading={data.requests.isLoading}
          onApprove={data.requests.onApprove}
          onReject={data.requests.onReject}
          isMutating={data.requests.isMutating}
        />
      ) : null;

    case 'danger':
      return <DangerSection actions={data.danger} />;

    default: {
      const exhaustive: never = section.id;
      return exhaustive;
    }
  }
}
