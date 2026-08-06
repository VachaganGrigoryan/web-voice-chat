import { Fragment } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ResourceScopeType, Role } from '@/api/types';
import {
  PERMISSION_GROUPS,
  isEffectivelyGranted,
  permissionsForScope,
} from '../permissionCatalog';

interface PermissionMatrixProps {
  roles: readonly Role[];
  scope: ResourceScopeType;
  onToggle: (role: Role, permission: string, granted: boolean) => void;
  /** Roles with a save in flight; their column is left interactive but marked. */
  savingRoleIds?: ReadonlySet<string>;
  disabled?: boolean;
}

/**
 * Roles down the columns, permissions down the rows. Wide by nature, so the
 * grid scrolls inside its own container rather than pushing the page sideways,
 * and the permission column stays pinned while the roles scroll.
 */
export function PermissionMatrix({
  roles,
  scope,
  onToggle,
  savingRoleIds,
  disabled = false,
}: PermissionMatrixProps) {
  const permissions = permissionsForScope(scope);

  if (roles.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        No roles yet. Create a role before assigning permissions.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Permissions granted by each role
        </caption>
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-muted/40 px-4 py-2.5 text-left font-medium"
            >
              Permission
            </th>
            {roles.map((role) => (
              <th
                key={role.id}
                scope="col"
                className="whitespace-nowrap px-3 py-2.5 text-center font-medium"
              >
                <span className="inline-flex items-center gap-1.5">
                  {role.name}
                  {savingRoleIds?.has(role.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {PERMISSION_GROUPS.map((group) => {
            const groupPermissions = permissions.filter((entry) => entry.group === group.id);
            if (groupPermissions.length === 0) return null;

            return (
              <Fragment key={group.id}>
                <tr className="border-b border-border/60 bg-background">
                  <th
                    scope="colgroup"
                    colSpan={roles.length + 1}
                    className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group.label}
                  </th>
                </tr>

                {groupPermissions.map((entry) => (
                  <tr key={entry.value} className="border-b border-border/40 last:border-b-0">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-background px-4 py-2.5 text-left font-normal"
                    >
                      <span className="block font-medium">{entry.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {entry.description}
                      </span>
                    </th>

                    {roles.map((role) => {
                      const explicit = role.permissions.includes(entry.value);
                      const effective = isEffectivelyGranted(role.permissions, entry.value);
                      // Implied by the `.any` sibling: shown as granted, but the
                      // box reflects only what this role explicitly carries.
                      const impliedOnly = effective && !explicit;

                      return (
                        <td key={role.id} className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={explicit}
                            disabled={disabled}
                            aria-label={`${entry.label} for ${role.name}`}
                            onChange={(event) =>
                              onToggle(role, entry.value, event.target.checked)
                            }
                            className={cn(
                              'h-4 w-4 cursor-pointer rounded border-border accent-primary',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                              disabled && 'cursor-not-allowed opacity-60'
                            )}
                          />
                          {impliedOnly ? (
                            <span
                              className="mt-0.5 block text-2xs text-muted-foreground"
                              title={`Already granted by ${entry.anyEquivalent}`}
                            >
                              implied
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
