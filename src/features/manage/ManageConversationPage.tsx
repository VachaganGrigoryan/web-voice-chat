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

/** `/spaces/:spaceId/groups/:conversationId/manage/:section` or legacy `/chat/:conversationId/manage/:section`. */
export default function ManageConversationPage() {
  const { spaceId, conversationId, section = 'general' } = useParams<{
    spaceId?: string;
    conversationId: string;
    section?: string;
  }>();
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);

  const ref = useMemo(
    () =>
      conversationId
        ? ({ container_type: 'conversation', container_id: conversationId } as const)
        : null,
    [conversationId]
  );
  const { descriptor } = useContainer(ref, currentUserId);

  if (!conversationId || !descriptor) {
    return null;
  }

  const subject = subjectFromDescriptor(descriptor);
  const ownerSpaceId = spaceId ?? descriptor.identity.spaceId ?? null;
  const managePath = (next: ManageSectionId) =>
    ownerSpaceId
      ? APP_ROUTES.spaceGroupManage(ownerSpaceId, conversationId, next)
      : APP_ROUTES.chatManage(conversationId, next);

  return (
    <ManageLayout
      resource={subject.resource}
      resourceLabel="group"
      title={subject.title}
      description="Group settings"
      onBack={() => navigate(descriptor.identity.routes.chat)}
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
        <ConversationSettingsBody
          descriptor={descriptor}
          capabilities={capabilities}
          activeSectionId={section}
          onSectionChange={(next) => navigate(managePath(next))}
        />
      )}
    </ManageLayout>
  );
}

/** Separate component so the data hook is never called from a render prop. */
function ConversationSettingsBody({
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
  const subject = subjectFromDescriptor(descriptor);
  const data = useContainerSettingsData(subject);

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
