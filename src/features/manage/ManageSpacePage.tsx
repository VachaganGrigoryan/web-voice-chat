import { useNavigate, useParams } from 'react-router-dom';
import { APP_ROUTES } from '@/app/routes';
import { useSpaces } from '@/hooks/useSpaces';
import { ContainerSettings } from '@/features/settings-container/ContainerSettings';
import { useSpaceSettingsData } from '@/features/settings-container/useSpaceSettingsData';
import { subjectFromSpace } from '@/features/settings-container/types';
import { resolveSections } from '@/features/settings-container/sections/registry';
import { ManageLayout } from './ManageLayout';
import { SECTION_ICONS } from './sectionIcons';
import type { ManageSectionId } from './types';

/** `/spaces/:spaceId/manage/:section`. */
export default function ManageSpacePage() {
  const { spaceId, section = 'general' } = useParams<{ spaceId: string; section?: string }>();
  const navigate = useNavigate();
  const manage = useSpaces(spaceId);

  if (!spaceId || !manage.space) {
    return null;
  }

  const subject = subjectFromSpace(spaceId, manage.space.name);
  const managePath = (next: ManageSectionId) =>
    `${APP_ROUTES.spaceDetail(spaceId)}/manage/${next}`;

  return (
    <ManageLayout
      resource={subject.resource}
      resourceLabel="space"
      title={subject.title}
      description="Space settings"
      onBack={() => navigate(APP_ROUTES.spaceDetail(spaceId))}
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
        <SpaceSettingsBody
          spaceId={spaceId}
          name={manage.space!.name}
          capabilities={capabilities}
          activeSectionId={section}
          onSectionChange={(next) => navigate(managePath(next))}
        />
      )}
    </ManageLayout>
  );
}

/** Separate component so the data hook is never called from a render prop. */
function SpaceSettingsBody({
  spaceId,
  name,
  capabilities,
  activeSectionId,
  onSectionChange,
}: {
  spaceId: string;
  name: string;
  capabilities: Parameters<typeof ContainerSettings>[0]['capabilities'];
  activeSectionId: string;
  onSectionChange: (sectionId: ManageSectionId) => void;
}) {
  const navigate = useNavigate();
  const subject = subjectFromSpace(spaceId, name);
  // Deleting a space takes its channels and groups with it, so there is no
  // space surface to return to.
  const data = useSpaceSettingsData(spaceId, {
    onDeleted: () => navigate(APP_ROUTES.spaces),
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
