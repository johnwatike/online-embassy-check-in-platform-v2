import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SessionBridge } from "@/components/session-bridge";
import { getLang } from "@/lib/i18n";
import "@fontsource-variable/inter"; // eCitizen-style typography, self-hosted
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Embassy Connect · Republic of Kenya – Ministry of Foreign Affairs (pilot)", template: "%s · Embassy Connect" },
  description:
    "A pilot platform prepared for Kenya's Ministry of Foreign Affairs: register travel, check in abroad, receive verified embassy alerts and request consular assistance. Sample data only.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#006600",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang === "sw" ? "sw" : "en"}>
      <body className="antialiased">
        <SessionBridge />
        {children}
      </body>
    </html>
  );
}
