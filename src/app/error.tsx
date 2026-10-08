"use client";

import Link from "next/link";
import { unstable_isUnrecognizedActionError as isUnrecognizedActionError } from "next/navigation";
import { useEffect } from "react";

const RELOAD_KEY = "ec_stale_reload_at";

/** True when the page was loaded from an older deployment than the server (form ids no longer exist). */
function looksStale(error: Error) {
  const message = String(error.message ?? "");
  return /unexpected response was received from the server|server action not found|failed to find server action/i.test(message) || isUnrecognizedActionError(error);
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = looksStale(error);

  useEffect(() => {
    // Only the digest is logged – never page content or personal data.
    console.error("Embassy Connect error", error.digest ?? error.name);
    if (!stale) return;
    // The app was updated while this page was open. Reload once automatically to pick up the new version.
    // The timestamp guard stops a reload loop if something else is wrong.
    try {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last > 15000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      /* sessionStorage unavailable (private mode or blocked in a frame) – the buttons below still work */
    }
  }, [error, stale]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Embassy Connect</p>
      {stale ? (
        <>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-navy-950">This page is out of date</h1>
          <p className="mt-3 text-navy-800">
            Embassy Connect was updated while this page was open, so this button no longer matches the service. We&apos;re trying to reload the latest version automatically — if nothing happens, reload the page, then try again.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-navy-950">Something went wrong</h1>
          <p className="mt-3 text-navy-800">We couldn&apos;t complete that. Please reload the page and try again.</p>
        </>
      )}
      <p className="mt-3 rounded-xl border border-red-300 border-l-4 border-l-red-700 bg-red-50 px-4 py-3 text-sm text-red-950">
        If you are in immediate danger, contact local emergency services or your embassy&apos;s published emergency line. This website cannot replace them.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center rounded-lg bg-navy-900 px-5 font-semibold text-white hover:bg-navy-800">
          Reload the page
        </button>
        {!stale && (
          <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-lg border border-navy-300 bg-white px-5 font-semibold text-navy-900 hover:bg-navy-50">
            Try again
          </button>
        )}
        {/* A normal link (full page load), so it always fetches the current version of the sign-in page. */}
        <a href="/sign-in" className="inline-flex min-h-11 items-center rounded-lg border border-navy-300 bg-white px-5 font-semibold text-navy-900 hover:bg-navy-50">
          Back to sign-in
        </a>
      </div>
      {error.digest && <p className="mt-6 text-xs text-navy-600">Reference: {error.digest}</p>}
      <p className="sr-only"><Link href="/">Home</Link></p>
    </main>
  );
}
