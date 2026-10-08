"use client";

import { useEffect } from "react";

type Win = Window & { __ecs?: string };

/**
 * Keeps demo sessions alive in hosted previews that refuse cookies (embedded frames with
 * third-party storage blocked).
 *
 * Demo sign-in passes a signed `ecs` session token in the URL. While that token is present:
 *  - if the browser stores cookies (the `ec_cs` canary cookie is readable), everything is
 *    left to the normal cookie session – including Next's client-side navigation;
 *  - if not, same-origin link clicks become full page loads carrying the token (the App
 *    Router's soft navigation uses render-time hrefs, so it would drop the token), and
 *    same-origin form posts get the token as a hidden field – so server actions stay
 *    authenticated via the token forwarded by src/proxy.ts.
 * Also asks for Storage Access when framed (Safari), best effort.
 */
export function SessionBridge() {
  useEffect(() => {
    const win = window as Win;
    const initial = new URLSearchParams(window.location.search).get("ecs");
    if (initial) win.__ecs = initial;

    const cookiesWork = () => document.cookie.includes("ec_cs=");

    // Best-effort storage access for framed previews (Safari ITP).
    try {
      const doc = document as Document & {
        hasStorageAccess?: () => Promise<boolean>;
        requestStorageAccess?: () => Promise<void>;
      };
      if (window.top !== window.self && doc.hasStorageAccess && doc.requestStorageAccess) {
        doc
          .hasStorageAccess()
          .then((has) => (has ? undefined : doc.requestStorageAccess?.()))
          .catch(() => {});
      }
    } catch {
      /* best effort only */
    }

    const onClick = (e: MouseEvent) => {
      if (!win.__ecs || cookiesWork()) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a?.href) return;
      try {
        const url = new URL(a.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        e.preventDefault();
        e.stopPropagation();
        if (!url.searchParams.get("ecs")) url.searchParams.set("ecs", win.__ecs);
        window.location.assign(url.toString());
      } catch {
        /* leave the link alone */
      }
    };

    const onSubmit = (e: Event) => {
      if (!win.__ecs || cookiesWork()) return;
      const form = e.target as HTMLFormElement | null;
      if (!form || form.tagName !== "FORM") return;
      try {
        const url = new URL(form.action || window.location.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname.endsWith("/api/demo/sign-out")) {
          win.__ecs = undefined; // signed out: stop carrying the token
          return;
        }
        if (!form.querySelector("input[name='ecs']")) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "ecs";
          input.value = win.__ecs;
          form.appendChild(input);
        }
      } catch {
        /* leave the form alone */
      }
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
  return null;
}
