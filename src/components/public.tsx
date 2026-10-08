import Image from "next/image";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getLang, tr } from "@/lib/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { BrandMark, KenyaStripe, btn } from "./ui";

export async function PublicHeader() {
  const [user, lang] = await Promise.all([getSessionUser(), getLang()]);
  const links = [
    { href: "/embassies", label: tr(lang, "pub.findEmbassy") },
    { href: "/guidance", label: tr(lang, "pub.guidance") },
    { href: "/privacy", label: tr(lang, "pub.privacy") },
  ];
  return (
    <>
      <a href="#main" className="skip-link">{tr(lang, "nav.skip")}</a>
      <div className="bg-gold-400 px-4 py-1.5 text-center text-xs font-semibold text-navy-950 sm:text-sm">{tr(lang, "banner.short")}</div>
      <header className="on-dark bg-navy-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" aria-label="Embassy Connect home"><BrandMark light /></Link>
          <nav aria-label="Public" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-navy-100 hover:bg-navy-800">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher dark />
            {user ? (
              <Link href={user.role === "citizen" ? "/app" : "/staff"} className={btn("gold", "sm")}>{tr(lang, "pub.openDash")}</Link>
            ) : (
              <Link href="/sign-in" className={btn("gold", "sm")}>{tr(lang, "pub.signIn")}</Link>
            )}
          </div>
        </div>
        <KenyaStripe />
      </header>
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-navy-100 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-navy-700 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-4">
            <Image src="/mfa-logo.png" alt="Seal of the Ministry of Foreign Affairs, Republic of Kenya" width={1408} height={768} sizes="96px" className="h-14 w-auto" />
            <BrandMark emblemSize="h-9" />
          </div>
          <p className="mt-2">A pilot prepared for Kenya&apos;s Ministry of Foreign Affairs and its missions abroad. The coat of arms and ministry seal artwork shown in this prototype are illustrative placeholders until the Ministry supplies official marks.</p>
        </div>
        <div>
          <p className="font-semibold text-navy-950">Important</p>
          <ul className="mt-2 space-y-1">
            <li>Travel registration does not replace visas or immigration registration.</li>
            <li>Online requests do not replace local emergency services.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-navy-950">Explore</p>
          <ul className="mt-2 space-y-1">
            <li><Link className="underline" href="/embassies">Kenyan missions abroad</Link></li>
            <li><Link className="underline" href="/guidance">Consular guidance</Link></li>
            <li><Link className="underline" href="/privacy">Privacy and your data</Link></li>
            <li><Link className="underline" href="/sign-in">Demo sign-in</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
