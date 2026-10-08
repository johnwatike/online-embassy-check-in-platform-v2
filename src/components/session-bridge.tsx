"use client";

import { useEffect } from "react";

type Win = Window & { __ecs?: string };

/**
 * Keeps demo sessions alive in hosted previews that refuse cookies (embedded frames with
 * third-party storage blocked). When the page URL carries a signed `ecs` session token:
 *  - same-origin link clicks get the token appended,
 *  - same-origin form posts get it as a hidden field,
 * so navigation and server actions stay authenticated without any cookie.
 * Also asks for Storage Access when framed (Safari), best effort.
 * No-ops when there is no token in the URL (normal cookie-based sessions).
 */
export function SessionBridge() {
  useEffect(() => {
    const win = window as Win;
    const initial = new URLSearchParams(window.location.search).get("ecs");
    if (initial) win.__ecs = initial;

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
      if (!win.__ecs) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a?.href) return;
      try {
        const url = new URL(a.href, window.location.href);
        if (url.origin !== window.location.origin || url.searchParams.get("ecs")) return;
        url.searchParams.set("ecs", win.__ecs);
        a.href = url.toString();
      } catch {
        /* leave the link alone */
      }
    };

    const onSubmit = (e: Event) => {
      if (!win.__ecs) return;
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
