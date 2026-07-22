import { useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { usePings } from '@/hooks/usePings';
import { useAppNavigation } from '@/navigation/appNavigation';
import { Loader2, MessageCircle, User } from 'lucide-react';

function contactName(contact: { display_name: string | null; username: string }) {
  return contact.display_name || contact.username;
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const { goBack, goTo } = useAppNavigation();
  const { contacts, isLoadingContacts } = usePings();

  return (
    <PanelPageLayout
      title="Contacts"
      description="Accepted pings and direct conversations."
      onBack={() => goBack({ fallback: APP_ROUTES.chat })}
      onClose={() => goTo(APP_ROUTES.chat)}
      contentClassName="scrollbar-hidden space-y-4"
    >
      <PanelSection title="Ping List">
        {isLoadingContacts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-5 text-sm text-muted-foreground">
            No contacts yet.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border/70">
            {contacts.map((item) => {
              const name = contactName(item.peer);
              return (
                <div key={item.peer.id} className="flex items-center gap-3 p-4">
                  <Avatar className="h-11 w-11">
                    {item.peer.avatar?.url ? <AvatarImage src={item.peer.avatar.url} className="object-cover" /> : null}
                    <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{name}</div>
                    <div className="truncate text-xs text-muted-foreground">@{item.peer.username}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(APP_ROUTES.profile(item.peer.id))}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Button>
                    {item.conversation_id ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => navigate(APP_ROUTES.chatConversation(item.conversation_id!))}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>
    </PanelPageLayout>
  );
}
