import { useState } from 'react';
import { ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { ResourceScopeType, Role } from '@/api/types';
import { PermissionMatrix } from '../primitives';
import { unknownPermissions } from '../permissionCatalog';
import type { RolesData } from '../sectionData';

interface RolesPermissionsSectionProps {
  data: RolesData;
  scope: ResourceScopeType;
}

/**
 * Roles, and behind a disclosure what each one grants. The matrix is the
 * advanced view because answering "who can post" should not require knowing
 * the permission vocabulary — but without it a role could be created and never
 * given anything, which is the gap this closes.
 */
export function RolesPermissionsSection({ data, scope }: RolesPermissionsSectionProps) {
  const [name, setName] = useState('');
  const [showMatrix, setShowMatrix] = useState(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    data.onCreate(trimmed);
    setName('');
  };

  const toggle = (role: Role, permission: string, granted: boolean) => {
    const next = granted
      ? [...role.permissions, permission]
      : role.permissions.filter((entry) => entry !== permission);
    // Permissions this build does not know are carried through untouched, so an
    // older client cannot strip something a newer backend added.
    const preserved = unknownPermissions(role.permissions);
    data.onSetPermissions(role, Array.from(new Set([...next, ...preserved])));
  };

  return (
    <div className="space-y-4">
      <PanelSection
        title="Roles"
        description="Named permission sets you can assign to members."
        action={
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New role name"
              maxLength={60}
              className="h-9 w-40"
              aria-label="New role name"
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
            />
            <Button type="button" size="sm" disabled={data.isCreating || !name.trim()} onClick={submit}>
              {data.isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
            </Button>
          </div>
        }
      >
        {data.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data.roles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No roles yet.
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
            {data.roles.map((role) => (
              <div key={role.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">{role.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {role.permissions.length === 0
                      ? 'Grants nothing yet'
                      : `Grants ${role.permissions.length} permission${role.permissions.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {role.system ? (
                  <span className="shrink-0 text-xs text-muted-foreground">Built in</span>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 cursor-pointer rounded-full text-muted-foreground hover:text-destructive"
                    disabled={data.isDeleting}
                    aria-label={`Delete role ${role.name}`}
                    onClick={() => data.onDelete(role.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection
        title="Advanced"
        description="Exactly what each role grants."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            aria-expanded={showMatrix}
            onClick={() => setShowMatrix((open) => !open)}
          >
            <ChevronDown
              className={cn('mr-1.5 h-4 w-4 transition-transform duration-200', showMatrix && 'rotate-180')}
            />
            {showMatrix ? 'Hide' : 'Show'} permissions
          </Button>
        }
      >
        {showMatrix ? (
          <PermissionMatrix
            roles={data.roles}
            scope={scope}
            onToggle={toggle}
            savingRoleIds={data.savingRoleIds}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Open this to grant or remove individual permissions per role.
          </p>
        )}
      </PanelSection>
    </div>
  );
}
