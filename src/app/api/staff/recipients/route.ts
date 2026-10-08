import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/constants";
import { findRecipients } from "@/lib/services";

export const dynamic = "force-dynamic";

/** Intended recipient count for a draft alert or wellbeing check. Counts only – no personal data is returned. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "citizen" || !user.missionId || !can(user.role, "alerts.draft")) return Response.json({ error: "Forbidden" }, { status: 403 });
  const u = new URL(req.url);
  const country = u.searchParams.get("country") ?? "";
  if (!country) return Response.json({ count: 0 });
  const audience = (["all", "active", "planned"].includes(u.searchParams.get("audience") ?? "") ? u.searchParams.get("audience") : "all") as "all" | "active" | "planned";
  const r = await findRecipients({ missionId: user.missionId, country, region: u.searchParams.get("region"), audience });
  return Response.json({ count: r.length });
}
