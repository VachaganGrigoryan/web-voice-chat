import { Navigate, useParams } from 'react-router-dom';

import { APP_ROUTES } from '@/app/routes';
import { PanelPageLayout } from '@/components/panel/PanelPageLayout';
import { useAppNavigation } from '@/navigation/appNavigation';
import { FeedList, type FeedScope } from './FeedList';

type FeedPageKind = FeedScope['kind'];

export default function FeedPage({ kind }: { kind: FeedPageKind }) {
  const { username, channelId } = useParams<{
    username?: string;
    channelId?: string;
  }>();
  const { goBack } = useAppNavigation();

  if (kind === 'user' && !username) {
    return <Navigate to={APP_ROUTES.feeds} replace />;
  }
  if (kind === 'channel' && !channelId) {
    return <Navigate to={APP_ROUTES.feeds} replace />;
  }

  const scope: FeedScope =
    kind === 'user'
      ? { kind, username: username as string }
      : kind === 'channel'
        ? { kind, channelId: channelId as string }
        : { kind: 'home' };
  const title =
    scope.kind === 'home'
      ? 'Home feed'
      : scope.kind === 'user'
        ? `@${scope.username}`
        : 'Channel feed';
  const description =
    scope.kind === 'home'
      ? 'Newest posts from users and channels you follow.'
      : 'Newest posts first.';

  return (
    <PanelPageLayout
      title={title}
      description={description}
      onBack={() => goBack({ fallback: APP_ROUTES.chat })}
      contentClassName="mx-auto w-full max-w-3xl"
    >
      <FeedList scope={scope} />
    </PanelPageLayout>
  );
}
