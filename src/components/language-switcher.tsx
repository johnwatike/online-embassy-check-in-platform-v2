import { getLang, tr } from "@/lib/i18n";
import { cx } from "./ui";

/** English / Kiswahili toggle. A plain form post to /api/lang, so it works without JavaScript and survives redeploys. */
export async function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const lang = await getLang();
  const opts = [
    { code: "en", label: "English", short: "EN", lang: "en" },
    { code: "sw", label: "Kiswahili", short: "SW", lang: "sw" },
  ];
  return (
    <form action="/api/lang" method="post" role="group" aria-label={tr(lang, "nav.language")} className="inline-flex overflow-hidden rounded-lg border border-current/30 text-sm font-semibold">
      {opts.map((o) => (
        <button
          key={o.code}
          type="submit"
          name="lang"
          value={o.code}
          lang={o.lang}
          aria-pressed={lang === o.code}
          aria-label={o.label}
          className={cx(
            "min-h-9 px-3 py-1.5",
            lang === o.code ? (dark ? "bg-gold-400 text-navy-950" : "bg-navy-900 text-white") : dark ? "text-navy-100 hover:bg-navy-800" : "text-navy-800 hover:bg-navy-100",
          )}
        >
          {o.short}
        </button>
      ))}
    </form>
  );
}
