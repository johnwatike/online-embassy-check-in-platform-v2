import type { ReactNode } from "react";
import { ShellFrame, type NavItem } from "@/components/shell-frame";
import { requireStaff } from "@/lib/auth";
import { ROLE_LABEL, can, type Permission } from "@/lib/constants";

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const { user, mission } = await requireStaff();
  const items: (NavItem & { perm: Permission })[] = [
    { href: "/staff", label: "Dashboard", icon: "▦", exact: true, perm: "reports.view" },
    { href: "/staff/registrations", label: "Citizen registrations", icon: "🧳", perm: "records.view" },
    { href: "/staff/map", label: "Check-in map", icon: "🗺", perm: "records.view" },
    { href: "/staff/cases", label: "Assistance cases", icon: "✉", perm: "cases.manage" },
    { href: "/staff/alerts", label: "Alerts", icon: "🔔", perm: "alerts.draft" },
    { href: "/staff/crisis", label: "Crisis wellbeing checks", icon: "⚠", perm: "crisis.view" },
    { href: "/staff/appointments", label: "Appointments", icon: "📅", perm: "appointments.manage" },
    { href: "/staff/mission", label: "Mission settings", icon: "⚙", perm: "mission.view" },
    { href: "/staff/audit", label: "Roles and audit history", icon: "☰", perm: "audit.view" },
  ];
  const nav = items.filter((i) => can(user.role, i.perm)).map(({ perm: _p, ...n }) => n);
  return (
    <ShellFrame variant="staff" nav={nav} userName={user.displayName} roleLabel={`${ROLE_LABEL[user.role]}${mission ? ` · ${mission.city}` : ""}`}>
      {children}
    </ShellFrame>
  );
}
