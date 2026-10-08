"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark, KenyaStripe, btn, cx } from "./ui";

export type NavItem = { href: string; label: string; icon: string; badge?: number; exact?: boolean };
export type ShellLabels = { skip: string; banner: string; menu: string; close: string; urgent: string; urgentShort: string; switchUser: string; signOut: string; quick: string };

const DEFAULT_LABELS: ShellLabels = {
  skip: "Skip to main content",
  banner: "PILOT PROTOTYPE – sample data, simulated notifications. Not yet operated by the Ministry of Foreign Affairs.",
  menu: "Menu",
  close: "Close",
  urgent: "Get urgent help",
  urgentShort: "Urgent help",
  switchUser: "Switch demo user",
  signOut: "Sign out",
  quick: "Quick actions",
};

/** Shared responsive frame for citizen and staff portals: header, sidebar (desktop), menu (mobile), bottom bar (citizen, mobile). */
export function ShellFrame({
  variant,
  nav,
  bottomNav,
  userName,
  roleLabel,
  labels = DEFAULT_LABELS,
  languageSwitcher,
  languageSwitcherLight,
  children,
}: {
  variant: "citizen" | "staff";
  nav: NavItem[];
  bottomNav?: NavItem[];
  userName: string;
  roleLabel: string;
  labels?: ShellLabels;
  languageSwitcher?: ReactNode;
  languageSwitcherLight?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const isActive = (i: NavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`));

  const list = (
    <ul className="space-y-1">
      {nav.map((i) => (
        <li key={i.href}>
          <Link
            href={i.href}
            aria-current={isActive(i) ? "page" : undefined}
            className={cx(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-base font-medium transition-colors",
              isActive(i) ? "bg-navy-900 text-white" : "text-navy-800 hover:bg-navy-100",
            )}
          >
            <span aria-hidden className="w-5 text-center">{i.icon}</span>
            <span className="flex-1">{i.label}</span>
            {!!i.badge && <span className="rounded-full bg-gold-400 px-2 py-0.5 text-xs font-bold text-navy-950"><span className="sr-only">Unread: </span>{i.badge}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">{labels.skip}</a>
      <div className="no-print bg-gold-400 px-4 py-1.5 text-center text-xs font-semibold text-navy-950 sm:text-sm">{labels.banner}</div>
      <header className="no-print on-dark sticky top-0 z-30 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href={variant === "citizen" ? "/app" : "/staff"} aria-label="Embassy Connect home">
            <BrandMark light />
          </Link>
          {variant === "staff" && <span className="hidden rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-semibold sm:inline">Staff portal</span>}
          <div className="ml-auto flex items-center gap-2">
            {languageSwitcher && <div className="hidden sm:block">{languageSwitcher}</div>}
            {variant === "citizen" && (
              <Link href="/app/help/urgent" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-red-500">
                <span aria-hidden>!</span> <span className="sm:hidden">{labels.urgentShort}</span><span className="hidden sm:inline">{labels.urgent}</span>
              </Link>
            )}
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpenFor(open ? null : pathname)}
              className="inline-flex min-h-10 items-center rounded-lg border border-navy-600 px-3 py-2 text-sm font-semibold hover:bg-navy-800 lg:hidden"
            >
              {open ? labels.close : labels.menu}
            </button>
          </div>
        </div>
        <KenyaStripe />
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="border-t border-navy-800 bg-white p-3 text-navy-900 lg:hidden">
            {list}
            <div className="mt-3 border-t border-navy-100 pt-3">
              {languageSwitcherLight && <div className="mb-3 px-3 sm:hidden">{languageSwitcherLight}</div>}
              <p className="px-3 text-sm text-navy-700">{userName} · {roleLabel}</p>
              <div className="mt-2 flex gap-2 px-3">
                <Link href="/sign-in" className={btn("outline", "sm")}>{labels.switchUser}</Link>
                <form action="/api/demo/sign-out" method="post"><button className={btn("ghost", "sm")}>{labels.signOut}</button></form>
              </div>
            </div>
          </nav>
        )}
      </header>
      <div className="mx-auto flex max-w-7xl">
        <aside className="no-print hidden w-64 shrink-0 lg:block">
          <nav aria-label="Main" className="sticky top-[5.5rem] p-4">
            {list}
            <div className="mt-6 rounded-xl border border-navy-100 bg-white p-3 text-sm">
              <p className="font-semibold text-navy-950">{userName}</p>
              <p className="text-navy-700">{roleLabel}</p>
              <p className="mt-1 text-xs text-navy-600">Demo session – role switching is for demonstration only, not real access control.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href="/sign-in" className={btn("outline", "sm")}>{labels.switchUser}</Link>
                <form action="/api/demo/sign-out" method="post"><button className={btn("ghost", "sm")}>{labels.signOut}</button></form>
              </div>
            </div>
          </nav>
        </aside>
        <main id="main" tabIndex={-1} className={cx("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", bottomNav && "pb-28 lg:pb-8")}>
          {children}
        </main>
      </div>
      {bottomNav && (
        <nav aria-label={labels.quick} className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-navy-200 bg-white shadow-[0_-4px_16px_rgba(10,22,48,0.08)] lg:hidden">
          {bottomNav.map((i) => (
            <Link key={i.href} href={i.href} aria-current={isActive(i) ? "page" : undefined} className={cx("flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-semibold", isActive(i) ? "text-teal-800" : "text-navy-700")}>
              <span aria-hidden className="text-lg leading-none">{i.icon}</span>
              {i.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
