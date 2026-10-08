import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/components/public";
import { Card, Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy and your data" };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card>
    <h2 className="text-xl font-semibold text-navy-950">{title}</h2>
    <div className="mt-2 space-y-2 text-navy-800">{children}</div>
  </Card>
);

export default function PrivacyPage() {
  return (
    <>
      <PublicHeader />
      <main id="main" className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-serif text-4xl font-semibold text-navy-950">Privacy and your data</h1>
        <p className="mt-2 text-lg text-navy-700">We collect only what the service needs, tell you why, and give you control.</p>
        <Notice tone="gold" className="mt-4" title="This is a demonstration">This pilot is prepared for Kenya&apos;s Ministry of Foreign Affairs and uses sample data only. The statements below describe how the platform is designed to behave; the section “What this demo does and doesn’t do” is the honest status of this build.</Notice>
        <div className="mt-8 space-y-5">
          <Section title="What we ask for, and why">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Name, citizenship, email, phone:</strong> so the embassy can identify and contact you.</li>
              <li><strong>Destination and dates:</strong> so the right mission can send you relevant alerts.</li>
              <li><strong>Accommodation address (optional):</strong> only to help in an emergency. Leave it blank if you prefer.</li>
              <li><strong>Emergency contact (optional):</strong> used only if you ask the embassy to contact someone.</li>
              <li><strong>Dependants:</strong> only with the consent confirmation shown at registration.</li>
            </ul>
            <p>We do <strong>not</strong> ask for passport numbers or document uploads to register travel. Documents may be requested later for a specific consular service.</p>
          </Section>
          <Section title="What we never do">
            <ul className="list-disc space-y-1 pl-5">
              <li>Track your location continuously. Location can be shared once, for one wellbeing request, with your explicit consent. You can withdraw it.</li>
              <li>Share your status or location with emergency contacts automatically.</li>
              <li>Publish a directory of citizens. Staff only see records within their mission&apos;s jurisdiction, and every access is logged.</li>
              <li>Treat a missed update or reply as a sign you are missing or in danger.</li>
            </ul>
          </Section>
          <Section title="Kenyan law and cross-border data">
            <p>Personal data of Kenyan citizens is protected by Kenya&apos;s <strong>Data Protection Act, 2019</strong>. Before launch, the Ministry (as data controller) must register with the Office of the Data Protection Commissioner, publish a lawful basis and retention schedule for each kind of data, and decide where data is hosted and how transfers between Nairobi and missions abroad are protected. Citizens keep their rights to access, correct and request deletion of their data. This pilot has had no legal review.</p>
          </Section>
          <Section title="Retention, correction, export and deletion">
            <p>You can correct your travel details and profile at any time, download a copy of your data, and request deletion from your profile. Some records (for example assistance cases and audit logs) may need to be kept for a legally required period. Retention periods are configurable by the operating institution; the demo uses illustrative values only.</p>
          </Section>
          <Section title="What this demo does and doesn’t do">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Works:</strong> server-side permission checks by role and mission, scoped citizen records, input validation, attachment type and size limits, audit logging without sensitive content.</li>
              <li><strong>Simulated:</strong> email, SMS and push delivery (messages are shown in-app and labelled as simulated); identity verification; staff multi-factor authentication.</li>
              <li><strong>Not implemented:</strong> real authentication, encryption at rest and key management, malware scanning for attachments, regional data residency. These are required before real use.</li>
            </ul>
          </Section>
          <Section title="What registration is — and isn’t">
            <p>Travel registration helps the embassy communicate with you and provide assistance. It does not replace visas, immigration registration or local emergency services, and it does not guarantee assistance. Support depends on each mission&apos;s real services and capabilities.</p>
          </Section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
