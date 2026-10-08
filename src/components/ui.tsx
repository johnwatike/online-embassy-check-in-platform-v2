import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_NOTICE, NOTICES, type Tone } from "@/lib/constants";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

const BTN_VARIANT = {
  primary: "bg-ke-green text-white hover:bg-teal-800 border border-ke-green",
  teal: "bg-teal-700 text-white hover:bg-teal-800 border border-teal-700",
  danger: "bg-red-700 text-white hover:bg-red-800 border border-red-700",
  outline: "bg-white text-navy-900 hover:bg-navy-50 border border-navy-300",
  ghost: "bg-transparent text-navy-800 hover:bg-navy-100 border border-transparent",
  gold: "bg-gold-400 text-navy-950 hover:bg-gold-300 border border-gold-500",
} as const;
export type BtnVariant = keyof typeof BTN_VARIANT;

export function btn(variant: BtnVariant = "primary", size: "sm" | "md" | "lg" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 text-center",
    BTN_VARIANT[variant],
    size === "sm" && "min-h-9 px-3 py-1.5 text-sm",
    size === "md" && "min-h-11 px-4 py-2.5 text-base",
    size === "lg" && "min-h-13 px-6 py-3 text-lg",
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", className, children, ...rest }: { href: string; variant?: BtnVariant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={cx(btn(variant, size), className)} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx("rounded-2xl border border-navy-100 bg-white p-5 shadow-sm sm:p-6", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 id={id} className="text-lg font-semibold text-navy-950">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-teal-700">{eyebrow}</p>}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-base text-navy-700">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE: Record<Tone, string> = {
  neutral: "bg-navy-100 text-navy-800 ring-navy-200",
  navy: "bg-navy-900 text-white ring-navy-900",
  teal: "bg-teal-50 text-teal-900 ring-teal-200",
  gold: "bg-gold-200 text-gold-700 ring-gold-300",
  red: "bg-red-50 text-red-900 ring-red-200",
  amber: "bg-amber-50 text-amber-900 ring-amber-200",
  green: "bg-emerald-50 text-emerald-900 ring-emerald-200",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", BADGE[tone], className)}>{children}</span>;
}

const NOTICE: Record<string, string> = {
  info: "border-navy-200 bg-navy-50 text-navy-900",
  success: "border-emerald-300 bg-emerald-50 text-emerald-950",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  danger: "border-red-300 bg-red-50 text-red-950",
  gold: "border-gold-400 bg-gold-200/50 text-navy-950",
};

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "danger" | "gold"; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border-l-4 border px-4 py-3 text-sm sm:text-base", NOTICE[tone], tone === "danger" && "border-l-red-700", tone === "warning" && "border-l-amber-600", tone === "success" && "border-l-emerald-600", tone === "info" && "border-l-navy-600", tone === "gold" && "border-l-gold-500", className)}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cx(title && "mt-0.5")}>{children}</div>}
    </div>
  );
}

export function Flash({ notice }: { notice?: string | string[] }) {
  const key = Array.isArray(notice) ? notice[0] : notice;
  if (!key || !NOTICES[key]) return null;
  return (
    <div role="status" className="mb-5">
      <Notice tone="success">{NOTICES[key]}</Notice>
    </div>
  );
}

export function EmptyState({ title, children, action, icon = "○" }: { title: string; children?: ReactNode; action?: ReactNode; icon?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-navy-300 bg-white/60 px-6 py-10 text-center">
      <div aria-hidden className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-navy-100 text-xl text-navy-700">{icon}</div>
      <h3 className="text-lg font-semibold text-navy-950">{title}</h3>
      {children && <p className="mx-auto mt-1 max-w-md text-navy-700">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, href, hint, tone = "neutral" }: { label: string; value: ReactNode; href?: string; hint?: string; tone?: Tone }) {
  const inner = (
    <>
      <p className="text-sm font-medium text-navy-700">{label}</p>
      <p className={cx("mt-1 font-serif text-3xl font-semibold", tone === "red" ? "text-red-700" : "text-navy-950")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-navy-600">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-navy-100 bg-white p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cx(cls, "transition hover:border-teal-600 hover:shadow-md")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function BarList({ items, labelMap, suppress = false }: { items: { label: string; value: number }[]; labelMap?: Record<string, string>; suppress?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-navy-600">No data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-navy-800">{labelMap?.[i.label] ?? i.label}</span>
            <span className="font-semibold tabular-nums text-navy-950">{suppress && i.value > 0 && i.value < 5 ? "<5" : i.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-navy-100" role="presentation">
            <div className="h-full rounded-full bg-teal-700" style={{ width: `${Math.max(4, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ColumnChart({ items, title }: { items: { label: string; value: number }[]; title: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="flex h-40 items-end gap-2" role="img" aria-label={`${title}: ${items.map((i) => `${i.label} ${i.value}`).join(", ")}`}>
        {items.map((i) => (
          <div key={i.label} className="flex h-full flex-1 flex-col justify-end">
            <span className="mb-1 text-center text-xs font-semibold tabular-nums text-navy-800">{i.value}</span>
            <div className="w-full rounded-t-md bg-navy-800" style={{ height: `${Math.max(3, (i.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2" aria-hidden>
        {items.map((i) => (
          <span key={i.label} className="flex-1 text-center text-[10px] leading-tight text-navy-600">
            {i.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

export function Pagination({ basePath, params, page, pages, total }: { basePath: string; params: Record<string, string | undefined>; page: number; pages: number; total: number }) {
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set("page", String(p));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-navy-700">{total} result{total === 1 ? "" : "s"} · page {page} of {pages}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link className={btn("outline", "sm")} href={href(page - 1)}>← Previous</Link> : <span className={cx(btn("outline", "sm"), "opacity-50")} aria-disabled>← Previous</span>}
        {page < pages ? <Link className={btn("outline", "sm")} href={href(page + 1)}>Next →</Link> : <span className={cx(btn("outline", "sm"), "opacity-50")} aria-disabled>Next →</span>}
      </div>
    </nav>
  );
}

export function DefList({ items, cols = 2 }: { items: { label: string; value: ReactNode }[]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-3", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-sm font-medium text-navy-600">{i.label}</dt>
          <dd className="mt-0.5 text-navy-950">{i.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({ items }: { items: { id: string; at: string; title: string; detail?: string; tag?: ReactNode }[] }) {
  if (!items.length) return <p className="text-sm text-navy-600">Nothing here yet.</p>;
  return (
    <ol className="relative space-y-5 border-l-2 border-navy-100 pl-5">
      {items.map((i) => (
        <li key={i.id} className="relative">
          <span aria-hidden className="absolute -left-[1.62rem] top-1.5 size-3 rounded-full border-2 border-white bg-teal-700 ring-2 ring-teal-700/30" />
          <p className="text-xs font-medium text-navy-600">{i.at}</p>
          <p className="font-medium text-navy-950">{i.title} {i.tag}</p>
          {i.detail && <p className="text-sm text-navy-700">{i.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

export function DemoNote({ children }: { children?: ReactNode }) {
  return <span className="ml-1 inline-block rounded bg-gold-200 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-700">{children ?? "Demo placeholder"}</span>;
}

export function DemoNotice({ className }: { className?: string }) {
  return (
    <Notice tone="gold" title="Demonstration platform" className={className}>
      {DEMO_NOTICE}
    </Notice>
  );
}

export function BrandMark({ light = false, className, emblemSize = "h-10" }: { light?: boolean; className?: string; emblemSize?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-3 text-left", className)}>
      <Image src="/kenya-coat-of-arms.png" alt="Coat of arms of the Republic of Kenya" width={1408} height={768} sizes="96px" className={cx("w-auto shrink-0", emblemSize)} />
      <span className="flex flex-col leading-tight">
        <span className={cx("font-serif text-lg font-semibold tracking-tight", light ? "text-white" : "text-navy-950")}>
          Embassy <span className={light ? "text-gold-300" : "text-ke-green"}>Connect</span>
        </span>
        <span className={cx("text-[11px] font-medium", light ? "text-navy-100" : "text-navy-700")}>Republic of Kenya · Ministry of Foreign Affairs</span>
      </span>
    </span>
  );
}

/** The black–white–red–white–green of the Kenyan flag. A design nod to Kenya – rendered for the pilot, not an official flag artwork. */
export function KenyaStripe() {
  return (
    <div
      aria-hidden
      className="h-1.5 w-full"
      style={{ background: "linear-gradient(90deg,#000000 0 31%,#ffffff 31% 34.5%,#bb0000 34.5% 65.5%,#ffffff 65.5% 69%,#006600 69% 100%)" }}
    />
  );
}

export const tableCls = {
  wrap: "overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm",
  table: "w-full min-w-[640px] text-left text-sm",
  th: "whitespace-nowrap bg-navy-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-navy-700",
  td: "border-t border-navy-100 px-4 py-3 align-top",
};
