import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Role } from '@/api/types';

interface RolesSectionProps {
  roles: readonly Role[];
  isLoading: boolean;
  onCreate: (name: string) => void;
  isCreating: boolean;
  onDelete: (roleId: string) => void;
  isDeleting: boolean;
}

/**
 * Role definitions for a channel or a space — the generic `rolesApi` entity.
 * Conversations don't have this: they gate on a flat Admin/Member string, so
 * `ManageConversationPage` doesn't include this section at all.
 */
export function RolesSection({ roles, isLoading, onCreate, isCreating, onDelete, isDeleting }: RolesSectionProps) {
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
  };

  return (
    <PanelSection
      title="Roles"
      description="Named permission sets members can be assigned."
      action={
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New role name"
            maxLength={60}
            className="h-9 w-40"
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
          <Button type="button" size="sm" disabled={isCreating || !name.trim()} onClick={submit}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No roles yet.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between gap-3 p-4">
              <span className="min-w-0 truncate text-sm font-medium">{role.name}</span>
              {role.system ? (
                <span className="text-xs text-muted-foreground">Built in</span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                  disabled={isDeleting}
                  aria-label={`Delete role ${role.name}`}
                  onClick={() => onDelete(role.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}
