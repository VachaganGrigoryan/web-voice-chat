import { useEffect, useMemo, useState } from 'react';
import { Loader2, LocateFixed, MapPin, Send, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { ContactListItem, RichContactInput, RichLocationInput } from '@/api/types';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface LocationDialogProps {
  open: boolean;
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (location: RichLocationInput) => Promise<void>;
}

interface ContactDialogProps {
  open: boolean;
  contacts: ContactListItem[];
  isSending: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (contact: RichContactInput) => Promise<void>;
}

const isValidCoordinate = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

function contactLabel(contact: ContactListItem) {
  return contact.peer.display_name || contact.peer.username || contact.peer.id;
}

export function ComposerLocationDialog({
  open,
  isSending,
  onOpenChange,
  onSend,
}: LocationDialogProps) {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLatitude('');
      setLongitude('');
      setName('');
      setAddress('');
      setError(null);
      setIsLocating(false);
      return;
    }

    if (!navigator.geolocation) {
      setError('Location permission is not available in this browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      () => {
        setError('Location permission was denied. Enter coordinates manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, [open]);

  const handleSend = async () => {
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(longitude);
    if (!isValidCoordinate(nextLatitude, nextLongitude)) {
      setError('Enter valid latitude and longitude values.');
      return;
    }

    setError(null);
    await onSend({
      latitude: nextLatitude,
      longitude: nextLongitude,
      name: name.trim() || null,
      address: address.trim() || null,
    });
    onOpenChange(false);
    toast.success('Location sent');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Share location</DialogTitle>
          <DialogDescription>
            Use your current location or enter coordinates manually.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <LocateFixed className="h-4 w-4 text-primary" />
              )}
              {isLocating ? 'Requesting current location' : 'Current location'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Coordinates remain editable before sending.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="location-latitude" className="mb-1 block text-xs font-medium text-muted-foreground">
                Latitude
              </label>
              <Input
                id="location-latitude"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                inputMode="decimal"
                disabled={isSending}
              />
            </div>
            <div>
              <label htmlFor="location-longitude" className="mb-1 block text-xs font-medium text-muted-foreground">
                Longitude
              </label>
              <Input
                id="location-longitude"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                inputMode="decimal"
                disabled={isSending}
              />
            </div>
          </div>

          <div>
            <label htmlFor="location-name" className="mb-1 block text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              id="location-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Optional place name"
              maxLength={120}
              disabled={isSending}
            />
          </div>

          <div>
            <label htmlFor="location-address" className="mb-1 block text-xs font-medium text-muted-foreground">
              Address
            </label>
            <Input
              id="location-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Optional address"
              maxLength={240}
              disabled={isSending}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => void handleSend()}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              Send location
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ComposerContactDialog({
  open,
  contacts,
  isSending,
  onOpenChange,
  onSend,
}: ContactDialogProps) {
  const [filter, setFilter] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFilter('');
      setDisplayName('');
      setPhone('');
      setEmail('');
      setError(null);
    }
  }, [open]);

  const filteredContacts = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    return contacts.filter((contact) =>
      normalized ? contactLabel(contact).toLowerCase().includes(normalized) : true
    );
  }, [contacts, filter]);

  const sendContact = async (contact: RichContactInput) => {
    await onSend(contact);
    onOpenChange(false);
    toast.success('Contact sent');
  };

  const sendManualContact = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('Add a display name before sending.');
      return;
    }
    setError(null);
    await sendContact({
      display_name: trimmedName,
      phone: phone.trim() || null,
      email: email.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[82vh] max-w-md flex-col rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Share contact</DialogTitle>
          <DialogDescription>
            Pick a Vogi contact or enter contact details manually.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4">
          <div>
            <label htmlFor="contact-search" className="mb-1 block text-xs font-medium text-muted-foreground">
              Vogi contacts
            </label>
            <Input
              id="contact-search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search contacts"
              disabled={isSending}
            />
            <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-border/70">
              {filteredContacts.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No contacts found.
                </p>
              ) : (
                filteredContacts.map((contact) => {
                  const label = contactLabel(contact);
                  return (
                    <button
                      key={contact.peer.id}
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
                      disabled={isSending}
                      onClick={() =>
                        void sendContact({
                          display_name: label,
                          user_id: contact.peer.id,
                        })
                      }
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{contact.peer.username || contact.peer.id}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-border/70 pt-3">
            <div className="text-xs font-medium text-muted-foreground">
              Manual contact
            </div>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              maxLength={120}
              disabled={isSending}
              aria-label="Manual contact display name"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone"
                maxLength={80}
                disabled={isSending}
                aria-label="Manual contact phone"
              />
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                maxLength={255}
                disabled={isSending}
                aria-label="Manual contact email"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={cn('rounded-full', isSending && 'cursor-wait')}
              onClick={() => void sendManualContact()}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send manual
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
