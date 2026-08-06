import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, PenSquare, RefreshCw, Rss, UserRound } from 'lucide-react';

import { APP_ROUTES, FeedTab, isFeedTab } from '@/app/routes';
import { useCreateIntent } from '@/app/shell/useCreateIntent';
import { PageBody } from '@/components/page/PageBody';
import { PageHeader } from '@/components/page/PageHeader';
import { PageTabs } from '@/components/page/PageTabs';
import { PageTab } from '@/components/page/pageTypes';
import { useAppNavigation } from '@/navigation/appNavigation';
import { FeedList, type FeedScope } from './FeedList';
import { SavedFeed } from './SavedFeed';

type FeedPageKind = FeedScope['kind'];

export default function FeedPage({ kind }: { kind: FeedPageKind }) {
  const { username, channelId, tab } = useParams<{
    username?: string;
    channelId?: string;
    tab?: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goBack } = useAppNavigation();
  const pendingIntent = useCreateIntent((state) => state.pendingIntent);
  const clearIntent = useCreateIntent((state) => state.clearIntent);

  // Posting always happens inside a channel, and the viewer's own profile channel
  // is the one they can always write to.
  useEffect(() => {
    if (pendingIntent !== 'new-post') return;
    clearIntent();
    navigate(APP_ROUTES.me);
  }, [pendingIntent, clearIntent, navigate]);

  if (kind === 'user' && !username) {
    return <Navigate to={APP_ROUTES.feed} replace />;
  }
  if (kind === 'channel' && !channelId) {
    return <Navigate to={APP_ROUTES.feed} replace />;
  }

  const activeTab: FeedTab = isFeedTab(tab) ? tab : 'home';
  const scope: FeedScope =
    kind === 'user'
      ? { kind, username: username as string }
      : kind === 'channel'
        ? { kind, channelId: channelId as string }
        : { kind: 'home' };

  const isHome = scope.kind === 'home';
  const isSaved = isHome && activeTab === 'saved';
  const title =
    isSaved
      ? 'Saved'
      : scope.kind === 'home'
      ? 'Feed'
      : scope.kind === 'user'
        ? `@${scope.username}`
        : 'Channel feed';
  const description =
    isSaved
      ? 'Posts you save for later'
      : scope.kind === 'home'
        ? 'Newest posts from the people and channels you follow'
        : 'Newest posts first';
  const tabs: readonly PageTab[] = [
    { id: 'home', label: 'Home', icon: Rss },
    { id: 'saved', label: 'Saved', icon: Bookmark },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <PageHeader
        title={title}
        description={description}
        // Home is a top-level destination and needs no back affordance; the scoped
        // feeds are drill-downs and do.
        onBack={isHome ? undefined : () => goBack({ fallback: APP_ROUTES.feed })}
        tabs={
          isHome ? (
            <PageTabs
              tabs={tabs}
              activeTabId={activeTab}
              onSelect={(next) => navigate(APP_ROUTES.feedTab(next as FeedTab))}
              aria-label="Feed sections"
            />
          ) : undefined
        }
        primaryAction={{
          id: 'new-post',
          label: 'New post',
          icon: PenSquare,
          onSelect: () => navigate(APP_ROUTES.me),
        }}
        secondaryActions={[
          {
            id: 'refresh',
            label: 'Refresh feed',
            icon: RefreshCw,
            onSelect: () =>
              void queryClient.invalidateQueries({
                queryKey: isSaved ? ['saved-messages'] : ['feeds'],
              }),
          },
        ]}
        overflowActions={[
          {
            id: 'my-profile',
            label: 'Go to my profile',
            icon: UserRound,
            onSelect: () => navigate(APP_ROUTES.me),
          },
        ]}
      />

      <PageBody narrow>
        {isSaved ? <SavedFeed /> : <FeedList scope={scope} />}
      </PageBody>
    </div>
  );
}
