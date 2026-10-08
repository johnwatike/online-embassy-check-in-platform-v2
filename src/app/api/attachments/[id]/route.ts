import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistanceCases, caseAttachments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/constants";
import { audit } from "@/lib/services";
import { UUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Attachments are served only to the owning citizen or to staff of the case's mission. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user || !UUID.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db
    .select({ a: caseAttachments, c: assistanceCases })
    .from(caseAttachments)
    .innerJoin(assistanceCases, eq(assistanceCases.id, caseAttachments.caseId))
    .where(eq(caseAttachments.id, id))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  const owner = user.role === "citizen" && row.c.userId === user.id;
  const staff = user.role !== "citizen" && can(user.role, "cases.manage") && user.missionId === row.c.missionId;
  if (!owner && !staff) return new Response("Not found", { status: 404 });
  if (staff) await audit(user, "case.attachment_view", "case", row.c.id, `Attachment opened on ${row.c.reference}`);
  const safeName = row.a.filename.replace(/[^\w.\- ]/g, "_");
  return new Response(Buffer.from(row.a.dataBase64, "base64"), {
    headers: {
      "Content-Type": row.a.mimeType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

void and;
