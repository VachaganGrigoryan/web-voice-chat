import { useNavigate } from 'react-router-dom';
import { Ban, ExternalLink, Loader2, LogOut, Settings } from 'lucide-react';

import { APP_ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/Button';
import { ResponsiveModal } from '@/components/ui/ResponsiveModal';
import { FollowButton } from '@/components/FollowButton';
import type { ContainerDescriptor } from '@/container';
import { useConnections } from '@/hooks/useConnections';
import { useConversationActions } from '@/features/chat/hooks/useConversationActions';
import { useChannelInbox } from '@/features/chat/hooks/useChannelInbox';
import { DmInfoBody } from './DmInfoBody';
import { GroupInfoBody } from './GroupInfoBody';
import { ChannelInfoBody } from './ChannelInfoBody';
import { buildInfoActionIds, type InfoContainerKind } from './infoActions';

interface ContainerInfoModalProps {
  descriptor: ContainerDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
  /** Opens the settings sheet the header action already opens. */
  onOpenSettings: () => void;
}

const TITLE: Record<InfoContainerKind, string> = {
  dm: 'Profile',
  group: 'Group info',
  channel: 'Channel info',
};

/**
 * One summary of whatever container is open, reached by clicking the header
 * title. It replaced three behaviours: a group dialog, a channel navigation
 * that dropped the reader out of the chat, and a direct-message click that set
 * a flag nothing read.
 *
 * The body is chosen by `identity.badge` and the actions by `infoActions.ts`;
 * nothing here branches on the container kind to decide what a viewer may do.
 */
export function ContainerInfoModal({
  descriptor,
  open,
  onOpenChange,
  currentUserId,
  onOpenSettings,
}: ContainerInfoModalProps) {
  const navigate = useNavigate();
  const { blockUser, isBlocking } = useConnections();
  const { leaveGroup } = useConversationActions();
  const channelInbox = useChannelInbox(false);

  const isChannel = descriptor.source.kind === 'channel';
  const channel = descriptor.source.kind === 'channel' ? descriptor.source.channel : null;
  const conversation =
    descriptor.source.kind === 'conversation' ? descriptor.source.conversation : null;

  const kind: InfoContainerKind = isChannel
    ? 'channel'
    : conversation?.type === 'dm'
      ? 'dm'
      : 'group';

  const peerUserId =
    descriptor.conversationOnly?.presence.peerUserId ?? conversation?.peer_user?.id ?? null;
  const surfaceRoute = isChannel ? descriptor.identity.routes.social : null;
  const profileRoute = peerUserId ? APP_ROUTES.profile(peerUserId) : null;
  const openRoute = kind === 'dm' ? profileRoute : surfaceRoute;

  const allowed = new Set(
    buildInfoActionIds({
      kind,
      canManage: descriptor.capabilities.canManage,
      hasSurface: Boolean(openRoute),
      hasPeer: Boolean(peerUserId),
    })
  );

  const close = () => onOpenChange(false);
  const go = (path: string) => {
    close();
    navigate(path);
  };

  const containerId = descriptor.ref.container_id;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={TITLE[kind]}
      description={descriptor.identity.title}
      footer={
        <div className="flex flex-wrap gap-2">
          {allowed.has('open_surface') && openRoute ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={() => go(openRoute)}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {kind === 'dm' ? 'Open profile' : 'Open channel'}
            </Button>
          ) : null}

          {allowed.has('settings') ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 cursor-pointer"
              onClick={() => {
                close();
                onOpenSettings();
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          ) : null}

          {allowed.has('follow') ? (
            <div className="flex-1 [&>button]:w-full">
              <FollowButton
                targetType={kind === 'channel' ? 'channel' : 'user'}
                targetId={kind === 'channel' ? containerId : (peerUserId as string)}
              />
            </div>
          ) : null}

          {allowed.has('leave') ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 cursor-pointer text-destructive hover:bg-destructive/10"
              onClick={() => {
                close();
                if (isChannel) channelInbox.leave.mutate(containerId);
                else leaveGroup.mutate(containerId);
              }}
            >
              {leaveGroup.isPending || channelInbox.leave.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Leave
            </Button>
          ) : null}

          {allowed.has('block') && peerUserId ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1 cursor-pointer text-destructive hover:bg-destructive/10"
              disabled={isBlocking}
              onClick={() => {
                close();
                void blockUser(peerUserId);
              }}
            >
              <Ban className="mr-2 h-4 w-4" />
              Block
            </Button>
          ) : null}
        </div>
      }
    >
      {kind === 'dm' && peerUserId ? <DmInfoBody peerUserId={peerUserId} /> : null}

      {kind === 'group' && conversation ? (
        <GroupInfoBody
          conversation={conversation}
          currentUserId={currentUserId}
          open={open}
          onClose={close}
        />
      ) : null}

      {kind === 'channel' && channel ? <ChannelInfoBody channel={channel} /> : null}
    </ResponsiveModal>
  );
}
