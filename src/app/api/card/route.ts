import { getSessionUser } from "@/lib/auth";
import { buildCardData } from "@/lib/card";
import { FALLBACK_CONTACT } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const esc = (s: string | null | undefined) => (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Standalone, offline-friendly HTML emergency contact card. Only the signed-in citizen's own data is used. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "citizen") return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const d = await buildCardData(user.id, url.searchParams.get("trip") ?? undefined, url.searchParams.get("contact") ?? undefined);
  const trip = d.trip;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Emergency contact card – ${esc(d.name)}</title>
<style>body{font-family:"Inter Variable",Inter,system-ui,sans-serif;background:#fbf8f2;color:#11213f;margin:0;padding:16px}.card{max-width:640px;margin:auto;border:3px solid #006600;border-radius:16px;background:#fff;padding:20px}.stripe{height:6px;background:linear-gradient(90deg,#000 0 31%,#fff 31% 34.5%,#bb0000 34.5% 65.5%,#fff 65.5% 69%,#006600 69% 100%);border-radius:12px 12px 0 0;margin:-20px -20px 16px}h1{font-size:22px;margin:0}small{color:#435a80}dt{font-size:12px;color:#435a80;margin-top:12px}dd{margin:2px 0;font-size:16px}.big{font-size:22px;font-weight:700}.demo{background:#f0e2b8;color:#7a5c14;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;text-transform:uppercase}</style></head><body><div class="card"><div class="stripe"></div>
<small>REPUBLIC OF KENYA · MINISTRY OF FOREIGN AFFAIRS – EMBASSY CONNECT · EMERGENCY CONTACT CARD <span class="demo">Pilot – sample data</span></small>
<h1>${esc(d.name)}</h1><small>Kenyan citizen</small>
<dl>
<dt>Trip reference</dt><dd class="big">${esc(trip?.reference ?? "—")}</dd><dd>${esc(trip ? trip.destinations.map((x) => x.country).join(" → ") : "")}${trip?.endsOn ? " · until " + esc(fmtDate(trip.endsOn)) : ""}</dd>
<dt>Responsible embassy</dt><dd><strong>${esc(d.mission?.name ?? "No mission covers this destination")}</strong></dd><dd>${esc(d.mission?.address)}</dd>
<dt>Embassy emergency line</dt><dd class="big">${esc(d.mission?.emergencyPhone ?? FALLBACK_CONTACT.phone)} <span class="demo">Placeholder – not a working line</span></dd>
<dt>Embassy general contact</dt><dd>${esc(d.mission?.phone)} · ${esc(d.mission?.email)}</dd>
<dt>Local emergency services${d.dest ? " (" + esc(d.dest.country) + ")" : ""}</dt><dd class="big">${esc(d.local ?? "Check official local sources")}</dd><dd><small>Public reference – confirm locally</small></dd>
<dt>Where I'm staying</dt><dd>${trip ? esc([trip.lodgingName, trip.accommodation].filter(Boolean).join(" · ")) || "Not included" : "—"}${trip?.lodgingLat != null && trip?.lodgingLng != null ? ` · 📍 ${esc(trip.lodgingPlace)} (${trip.lodgingLat}, ${trip.lodgingLng})` : ""}</dd>
<dt>My emergency contact</dt><dd>${d.contact ? esc(d.contact.name) + " (" + esc(d.contact.relationship) + ") – " + esc(d.contact.phone) : "Not included"}</dd>
</dl>
<p><small>Last updated ${esc(fmtDateTime(d.updatedAt))}. Registration does not replace visas, immigration registration or local emergency services. Demo contact details are placeholders and not verified.</small></p>
</div></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="emergency-contact-card${trip ? "-" + trip.reference : ""}.html"`,
      "Cache-Control": "private, no-store",
    },
  });
}
