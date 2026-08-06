import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { APP_ROUTES } from '@/app/routes';
import { useContainer } from '@/container';
import { useAuthStore } from '@/store/authStore';
import { ContainerSettings } from '@/features/settings-container/ContainerSettings';
import { useContainerSettingsData } from '@/features/settings-container/useContainerSettingsData';
import { subjectFromDescriptor } from '@/features/settings-container/types';
import { resolveSections } from '@/features/settings-container/sections/registry';
import { ManageLayout } from './ManageLayout';
import { SECTION_ICONS } from './sectionIcons';
import type { ManageSectionId } from './types';

/** `/spaces/:spaceId/channels/:channelId/manage/:section` or legacy `/channels/:channelId/manage/:section`. */
export default function ManageChannelPage() {
  const { spaceId, channelId, section = 'general' } = useParams<{
    spaceId?: string;
    channelId: string;
    section?: string;
  }>();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);

  const ref = useMemo(
    () => (channelId ? ({ container_type: 'channel', container_id: channelId } as const) : null),
    [channelId]
  );
  const { descriptor } = useContainer(ref, currentUserId);

  if (!channelId || !descriptor) {
    return null;
  }

  const subject = subjectFromDescriptor(descriptor);
  const ownerSpaceId = spaceId ?? descriptor.identity.spaceId ?? null;
  const channelPath = ownerSpaceId
    ? APP_ROUTES.spaceChannel(ownerSpaceId, channelId)
    : APP_ROUTES.channel(channelId);
  const managePath = (next: ManageSectionId) =>
    ownerSpaceId
      ? APP_ROUTES.spaceChannelManage(ownerSpaceId, channelId, next)
      : APP_ROUTES.channelManage(channelId, next);

  return (
    <ManageLayout
      resource={subject.resource}
      resourceLabel="channel"
      title={subject.title}
      description="Channel settings"
      onBack={() => navigate(channelPath)}
      sections={[]}
      activeSection={section as ManageSectionId}
      onSelectSection={(next) => navigate(managePath(next))}
      sectionsFor={(capabilities) =>
        resolveSections(subject.kind, capabilities).map((entry) => ({
          id: entry.id,
          label: entry.label,
          icon: SECTION_ICONS[entry.id],
        }))
      }
    >
      {(capabilities) => (
        <ChannelSettingsBody
          descriptor={descriptor}
          capabilities={capabilities}
          activeSectionId={section}
          onSectionChange={(next) => navigate(managePath(next))}
        />
      )}
    </ManageLayout>
  );
}

/**
 * A child rather than an inline render, because the data hook must not be
 * called inside `ManageLayout`'s render prop — that would break the rules of
 * hooks the first time the capability gate flips.
 */
function ChannelSettingsBody({
  descriptor,
  capabilities,
  activeSectionId,
  onSectionChange,
}: {
  descriptor: NonNullable<ReturnType<typeof useContainer>['descriptor']>;
  capabilities: Parameters<typeof ContainerSettings>[0]['capabilities'];
  activeSectionId: string;
  onSectionChange: (sectionId: ManageSectionId) => void;
}) {
  const navigate = useNavigate();
  const subject = subjectFromDescriptor(descriptor);
  // A management route for a deleted channel has nothing left to manage, so
  // deletion returns the viewer to the inbox rather than a dead page.
  const data = useContainerSettingsData(subject, {
    onDeleted: () => navigate(APP_ROUTES.chat),
  });

  return (
    <ContainerSettings
      subject={subject}
      capabilities={capabilities}
      data={data}
      activeSectionId={activeSectionId}
      onSectionChange={onSectionChange}
      showNav={false}
    />
  );
}
