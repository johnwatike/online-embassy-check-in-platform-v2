import Image from "next/image";
import { PublicFooter, PublicHeader } from "@/components/public";
import { ButtonLink, Card, DemoNotice, Notice } from "@/components/ui";
import { getLang, tr, type Key } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Home() {
  const lang = await getLang();
  const t = (k: Key) => tr(lang, k);
  const features = [
    { icon: "🧳", title: t("home.f1t"), text: t("home.f1d") },
    { icon: "📍", title: t("home.f2t"), text: t("home.f2d") },
    { icon: "🔔", title: t("home.f3t"), text: t("home.f3d") },
    { icon: "🤝", title: t("home.f4t"), text: t("home.f4d") },
  ];
  const actions = [
    [t("home.a1t"), t("home.a1d")],
    [t("home.a2t"), t("home.a2d")],
    [t("home.a3t"), t("home.a3d")],
    [t("home.a4t"), t("home.a4d")],
  ];
  return (
    <>
      <PublicHeader />
      <main id="main">
        <section className="on-dark bg-gradient-to-b from-ke-black via-mfa-navy to-navy-800 text-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
            <div className="mb-6 flex items-center gap-5">
              <Image src="/mfa-logo.png" alt="Seal of the Ministry of Foreign Affairs, Republic of Kenya" width={1408} height={768} sizes="96px" className="h-16 w-auto sm:h-20" />
              <Image src="/kenya-coat-of-arms.png" alt="Coat of arms of the Republic of Kenya" width={1408} height={768} sizes="96px" className="h-16 w-auto sm:h-20" />
            </div>
            <p className="mb-3 inline-block rounded-full border border-gold-400/60 px-3 py-1 text-sm font-semibold text-gold-300">{t("home.eyebrow")}</p>
            <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{t("home.h1")}</h1>
            <p className="mt-5 max-w-2xl text-lg text-navy-100">{t("home.lead")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/sign-in" variant="gold" size="lg">{t("home.getStarted")}</ButtonLink>
              <ButtonLink href="/embassies" variant="outline" size="lg">{t("home.findEmbassy")}</ButtonLink>
            </div>
            <p className="mt-6 max-w-xl text-sm text-navy-200">{t("home.immediate")}</p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4">
          <DemoNotice className="relative -mt-6 shadow-md" />

          <section aria-labelledby="how" className="mt-12">
            <h2 id="how" className="font-serif text-3xl font-semibold text-navy-950">{t("home.whatTitle")}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <Card key={f.title}>
                  <div aria-hidden className="mb-3 flex size-12 items-center justify-center rounded-xl bg-teal-50 text-2xl">{f.icon}</div>
                  <h3 className="text-lg font-semibold text-navy-950">{f.title}</h3>
                  <p className="mt-1 text-navy-700">{f.text}</p>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="coverage" className="mt-12 grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h2 id="coverage" className="font-serif text-2xl font-semibold text-navy-950">Kenya&apos;s missions around the world</h2>
              <p className="mt-2 text-navy-800">Embassies, high commissions and consulates general across Africa, Europe, the Middle East, Asia, the Americas and the Pacific. If Kenya has no mission where you are, we show you which mission is responsible — for example, Nepal and Sri Lanka are served from New Delhi, Lesotho from Pretoria, and Malta from Rome.</p>
              <div className="mt-4"><ButtonLink href="/embassies" variant="outline">Browse the directory</ButtonLink></div>
            </Card>
            <Card>
              <h2 className="font-serif text-2xl font-semibold text-navy-950">Kiswahili na Kiingereza</h2>
              <p className="mt-2 text-navy-800">Use the <strong>EN | SW</strong> switch at the top of the page. Main screens are available in both languages; more are coming.</p>
            </Card>
          </section>

          <section aria-labelledby="actions" className="mt-14 rounded-3xl bg-navy-950 p-6 text-white sm:p-10">
            <h2 id="actions" className="font-serif text-3xl font-semibold">{t("home.fourTitle")}</h2>
            <p className="mt-2 text-navy-100">{t("home.fourSub")}</p>
            <div className="on-dark mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {actions.map(([title, desc]) => (
                <div key={title} className="rounded-xl border border-navy-600 bg-navy-900 p-4">
                  <p className="font-semibold text-gold-300">{title}</p>
                  <p className="text-sm text-navy-100">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-6"><ButtonLink href="/sign-in" variant="gold">{t("home.tryDemo")}</ButtonLink></div>
          </section>

          <section aria-labelledby="trust" className="mt-14 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 id="trust" className="font-serif text-2xl font-semibold text-navy-950">Privacy by design</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-navy-800">
                <li>No passport or ID number, and no document upload, is needed to register travel.</li>
                <li>Sensitive fields are optional and each one explains why it is asked.</li>
                <li>Your status and location are never shared with emergency contacts automatically.</li>
                <li>Location sharing during a crisis is optional, specific to one request, and can be withdrawn.</li>
                <li>There is no public citizen directory and no continuous tracking.</li>
              </ul>
            </Card>
            <Card>
              <h2 className="font-serif text-2xl font-semibold text-navy-950">What this service is not</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-navy-800">
                <li>Registering your travel does not replace visas or immigration registration.</li>
                <li>It does not replace local emergency services.</li>
                <li>Missing an update never means the embassy assumes you are missing or in danger.</li>
                <li>Assistance depends on each mission&apos;s real services. Evacuation or financial support is never promised.</li>
              </ul>
              <Notice tone="warning" className="mt-4" title="In an emergency">{tr(lang, "disclaimer")}</Notice>
            </Card>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
