import { PERMISSIONS, ROLE_LABEL, type Permission } from "@/lib/constants";
import type { Role } from "@/db/schema";
import { ButtonLink, Notice } from "./ui";

/** Shown when a signed-in staff member opens a page their role has no permission for. Enforced on the server. */
export function AccessDenied({ permission, role }: { permission: Permission; role: Role }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Notice tone="warning" title="Your role doesn't have access to this page">
        <p>
          <strong>{ROLE_LABEL[role]}</strong> accounts cannot: {PERMISSIONS[permission].label.toLowerCase()}. This follows the least-privilege model — access is checked on the server for every request, not just hidden in the menu.
        </p>
        {role === "platform_admin" && <p className="mt-1">Platform administrators see aggregate reporting, mission settings and audit history, but not individual citizen records.</p>}
        <div className="mt-3"><ButtonLink href="/staff" variant="outline" size="sm">Back to dashboard</ButtonLink></div>
      </Notice>
    </div>
  );
}

export function MissionScopeNote({ name }: { name: string | null }) {
  return <p className="mb-4 text-sm text-navy-600">Scope: {name ? <>records within <strong>{name}</strong>&apos;s jurisdiction only. Access to individual records is logged.</> : "all missions (aggregate only)."}</p>;
}
