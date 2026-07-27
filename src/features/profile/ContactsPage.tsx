import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { APP_ROUTES } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { useConnections } from '@/hooks/useConnections';
import { useContacts } from '@/hooks/useContacts';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppNavigation } from '@/navigation/appNavigation';
import { useAuthStore } from '@/store/authStore';
import { ROLE_ADMIN } from '@/api/types';
import { conversationsApi, membershipsApi, spacesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { startCall } from '@/features/calls/callController';
import { ConnectionListItem } from '@/api/types';
import {
  Ban,
  Building2,
  Loader2,
  MessageCircle,
  MoreVertical,
  Phone,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContactActionsMenu, type ContactMenuItem } from './ContactActionsMenu';

function contactName(contact: { display_name: string | null; username: string }) {
  return contact.display_name || contact.username;
}

type ContactPeer = ConnectionListItem['peer'];
type ContactDirection = 'incoming' | 'outgoing';

function DirectionTag({ direction }: { direction: ContactDirection }) {
  const isOutgoing = direction === 'outgoing';
  return (
    <span
      title={isOutgoing ? 'You sent the request' : 'They sent the request'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        isOutgoing
          ? 'bg-sky-500/10 text-sky-600 dark:text-sky-300'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', isOutgoing ? 'bg-sky-500' : 'bg-amber-500')} />
      {isOutgoing ? 'Sent' : 'Received'}
    </span>
  );
}

function PresenceAvatar({ peer }: { peer: ContactPeer }) {
  const name = contactName(peer);
  return (
    <div className="relative shrink-0">
      <Avatar className="h-11 w-11">
        {peer.avatar?.url ? <AvatarImage src={peer.avatar.url} className="object-cover" /> : null}
        <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
      </Avatar>
      {peer.is_online ? (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
      ) : null}
    </div>
  );
}

function InviteToConversationDialog({
  peer,
  open,
  onOpenChange,
}: {
  peer: ContactPeer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const conversationsQuery = useQuery({
    queryKey: ['conversations', 'invitable'],
    queryFn: () => conversationsApi.getConversations(50).then((res) => res.data),
    enabled: open,
  });

  const addMemberMutation = useMutation({
    mutationFn: (conversationId: string) =>
      membershipsApi.invite('conversation', conversationId, peer.id),
    onSuccess: () => {
      toast.success(`Invited ${contactName(peer)}`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to invite to conversation'));
    },
  });

  const invitable = (conversationsQuery.data ?? []).filter(
    (conversation) =>
      conversation.type === 'group' &&
      !conversation.participant_ids.includes(peer.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to group</DialogTitle>
          <DialogDescription>
            Add {contactName(peer)} to one of your groups or channels.
          </DialogDescription>
        </DialogHeader>
        {conversationsQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : invitable.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            No groups or channels available to invite this contact to.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {invitable.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                disabled={addMemberMutation.isPending}
                onClick={() => addMemberMutation.mutate(conversation.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
              >
                <div className="rounded-full bg-muted p-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {conversation.title || 'Untitled conversation'}
                  </div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {conversation.type} · {conversation.member_count} members
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InviteToSpaceDialog({
  peer,
  open,
  onOpenChange,
}: {
  peer: ContactPeer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const myUserId = useAuthStore((state) => state.userId);
  const spacesQuery = useQuery({
    queryKey: ['spaces', 'owned'],
    queryFn: () => spacesApi.list(),
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: async (spaceId: string) => {
      await spacesApi.inviteUser(spaceId, peer.id);
    },
    onSuccess: () => {
      toast.success(`Invite sent to ${contactName(peer)}`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to send space invite'));
    },
  });

  const managedSpaces = (spacesQuery.data ?? []).filter(
    (space) =>
      space.owner_user_id === myUserId || space.viewer_role === ROLE_ADMIN
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to Space</DialogTitle>
          <DialogDescription>
            Send {contactName(peer)} a direct invitation to one of your spaces.
          </DialogDescription>
        </DialogHeader>
        {spacesQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : managedSpaces.length === 0 ? (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            You don't manage any spaces to invite this contact to.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {managedSpaces.map((space) => (
              <button
                key={space.id}
                type="button"
                disabled={inviteMutation.isPending}
                onClick={() => inviteMutation.mutate(space.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
              >
                <div className="rounded-full bg-muted p-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{space.name}</div>
                  <div className="truncate text-xs text-muted-foreground">/{space.slug}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { goBack, goTo } = useAppNavigation();
  const { contacts, isLoadingContacts, removeContact, isRemoving } = useContacts();
  const { blockUser, isBlocking } = useConnections();

  const [inviteConvContact, setInviteConvContact] = useState<ContactPeer | null>(null);
  const [inviteSpaceContact, setInviteSpaceContact] = useState<ContactPeer | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ConnectionListItem | null>(null);
  const [menu, setMenu] = useState<{ peerId: string; anchorRect: DOMRect | null } | null>(null);

  const messageMutation = useMutation({
    mutationFn: (item: ConnectionListItem) =>
      item.conversation_id
        ? Promise.resolve(item.conversation_id)
        : conversationsApi.createOrGetDm(item.peer.id).then((conversation) => conversation.id),
    onSuccess: (conversationId) => {
      navigate(APP_ROUTES.chatConversation(conversationId));
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Failed to open conversation'));
    },
  });

  const directionFor = (item: ConnectionListItem): ContactDirection =>
    item.direction;

  const openProfile = (peerId: string) => navigate(APP_ROUTES.profile(peerId));
  const handleCall = (peer: ContactPeer) =>
    void startCall({ peerUserId: peer.id, type: 'audio', peerUser: peer });

  const activeContact = menu ? contacts.find((c) => c.peer.id === menu.peerId) ?? null : null;

  const buildMenuItems = (item: ConnectionListItem): ContactMenuItem[] => {
    const mobileOnly: ContactMenuItem[] = isMobile
      ? [
          { key: 'profile', label: 'View profile', icon: User, onSelect: () => openProfile(item.peer.id) },
          { key: 'call', label: 'Voice call', icon: Phone, onSelect: () => handleCall(item.peer) },
          { key: 'message', label: 'Message', icon: MessageCircle, onSelect: () => messageMutation.mutate(item) },
        ]
      : [];
    return [
      ...mobileOnly,
      { key: 'invite-group', label: 'Invite to Group / Channel', icon: Users, onSelect: () => setInviteConvContact(item.peer) },
      { key: 'invite-space', label: 'Invite to Space', icon: Building2, onSelect: () => setInviteSpaceContact(item.peer) },
      { key: 'block', label: 'Block user', icon: Ban, onSelect: () => void blockUser(item.peer.id), destructive: true, disabled: isBlocking },
      { key: 'remove', label: 'Remove contact', icon: Trash2, onSelect: () => setRemoveTarget(item), destructive: true },
    ];
  };

  const openMenu = (peerId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    setMenu({ peerId, anchorRect: event.currentTarget.getBoundingClientRect() });
  };

  return (
    <PanelPageLayout
      title="Contacts"
      description="People you're connected with. Call, message, invite, or manage each contact."
      onBack={() => goBack({ fallback: APP_ROUTES.chat })}
      onClose={() => goTo(APP_ROUTES.chat)}
      contentClassName="scrollbar-hidden space-y-4"
    >
      <PanelSection
        title="Ping List"
        description={contacts.length ? `${contacts.length} contact${contacts.length === 1 ? '' : 's'}` : undefined}
      >
        {isLoadingContacts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No contacts yet. Accepted pings show up here.
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
            {contacts.map((item) => {
              const name = contactName(item.peer);
              const direction = directionFor(item);
              return (
                <div
                  key={item.peer.id}
                  className={
                    'group relative border-l-2 ' +
                    (direction === 'outgoing' ? 'border-l-sky-400/50' : 'border-l-amber-400/50')
                  }
                >
                  {/* Mobile: tappable card row */}
                  <div className="flex items-center gap-3 p-4 md:hidden">
                    <button
                      type="button"
                      onClick={() => openProfile(item.peer.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <PresenceAvatar peer={item.peer} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{name}</span>
                          <DirectionTag direction={direction} />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">@{item.peer.username}</div>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 shrink-0 rounded-full"
                      aria-label="Message"
                      onClick={() => messageMutation.mutate(item)}
                      disabled={messageMutation.isPending}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-11 w-11 shrink-0 rounded-full"
                      aria-label="More actions"
                      onClick={(event) => openMenu(item.peer.id, event)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Desktop: dense row with inline actions */}
                  <div className="hidden items-center gap-4 p-4 md:flex">
                    <button
                      type="button"
                      onClick={() => openProfile(item.peer.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <PresenceAvatar peer={item.peer} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium group-hover:underline">{name}</span>
                          <DirectionTag direction={direction} />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">@{item.peer.username}</div>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => messageMutation.mutate(item)}
                        disabled={messageMutation.isPending}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleCall(item.peer)}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Call
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openProfile(item.peer.id)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        aria-label="More actions"
                        onClick={(event) => openMenu(item.peer.id, event)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>

      <ContactActionsMenu
        open={activeContact !== null}
        isMobile={isMobile}
        anchorRect={menu?.anchorRect ?? null}
        title={activeContact ? contactName(activeContact.peer) : undefined}
        items={activeContact ? buildMenuItems(activeContact) : []}
        onClose={() => setMenu(null)}
      />

      {inviteConvContact ? (
        <InviteToConversationDialog
          peer={inviteConvContact}
          open={inviteConvContact !== null}
          onOpenChange={(open) => {
            if (!open) setInviteConvContact(null);
          }}
        />
      ) : null}
      {inviteSpaceContact ? (
        <InviteToSpaceDialog
          peer={inviteSpaceContact}
          open={inviteSpaceContact !== null}
          onOpenChange={(open) => {
            if (!open) setInviteSpaceContact(null);
          }}
        />
      ) : null}

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove contact</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `Remove ${contactName(removeTarget.peer)} from your contacts? This deletes the connection and revokes chat permission until you ping again.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isRemoving}
              onClick={async () => {
                if (!removeTarget) return;
                try {
                  await removeContact(removeTarget.relationship.id);
                } finally {
                  setRemoveTarget(null);
                }
              }}
            >
              {isRemoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PanelPageLayout>
  );
}
