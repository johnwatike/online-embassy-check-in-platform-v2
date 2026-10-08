import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ShellFrame, type NavItem } from "@/components/shell-frame";
import { requireCitizen } from "@/lib/auth";
import { unreadCount } from "@/lib/data";
import { getLang, tr, type Key } from "@/lib/i18n";

export default async function CitizenLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireCitizen();
  const [unread, lang] = await Promise.all([unreadCount(user.id), getLang()]);
  const t = (k: Key) => tr(lang, k);
  const nav: NavItem[] = [
    { href: "/app", label: t("nav.dashboard"), icon: "⌂", exact: true },
    { href: "/app/trips/new", label: t("nav.checkIn"), icon: "✓" },
    { href: "/app/trips", label: t("nav.myTrips"), icon: "🧳", exact: true },
    { href: "/app/status", label: t("nav.status"), icon: "♥" },
    { href: "/app/alerts", label: t("nav.alerts"), icon: "🔔", badge: unread },
    { href: "/app/help", label: t("nav.help"), icon: "?" },
    { href: "/app/embassy", label: t("nav.embassy"), icon: "✉" },
    { href: "/app/appointments", label: t("nav.appointments"), icon: "📅" },
    { href: "/app/card", label: t("nav.card"), icon: "▤" },
    { href: "/app/profile", label: t("nav.profile"), icon: "⚙" },
  ];
  const bottom: NavItem[] = [
    { href: "/app", label: t("nav.bottomHome"), icon: "⌂", exact: true },
    { href: "/app/trips/new", label: t("nav.checkIn"), icon: "✓" },
    { href: "/app/status", label: t("nav.bottomStatus"), icon: "♥" },
    { href: "/app/help", label: t("nav.help"), icon: "?" },
  ];
  return (
    <ShellFrame
      variant="citizen"
      nav={nav}
      bottomNav={bottom}
      userName={profile.fullName}
      roleLabel="Citizen (demo)"
      labels={{ skip: t("nav.skip"), banner: t("banner.short"), menu: t("nav.menu"), close: t("nav.close"), urgent: t("nav.urgent"), urgentShort: t("nav.urgentShort"), switchUser: t("nav.switchUser"), signOut: t("nav.signOut"), quick: "Quick actions" }}
      languageSwitcher={<LanguageSwitcher dark />}
      languageSwitcherLight={<LanguageSwitcher />}
    >
      {children}
    </ShellFrame>
  );
}
