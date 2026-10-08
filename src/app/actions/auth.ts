"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { citizenProfiles, emergencyContacts, notificationPreferences, users } from "@/db/schema";
import { signSession, startSession } from "@/lib/auth";
import { DIAL_CODES, LANGUAGES } from "@/lib/constants";
import { ensureSeeded } from "@/lib/seed";
import { audit } from "@/lib/services";
import type { ActionState } from "@/lib/types";
import { bool, fail, formObj, optionalEmail, phoneText, requiredText, shortText } from "@/lib/validation";

// Demo sign-in, sign-out, reset and language switching are plain form posts handled by route handlers under
// /api/demo and /api/lang, so they keep working even when a page was opened before a new deployment.

const accountSchema = z.object({
  fullName: requiredText(120, "Full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  citizenship: requiredText(60, "Citizenship"),
  phoneDial: z.enum(DIAL_CODES as [string, ...string[]], { message: "Choose a dialling code" }),
  phoneNumber: phoneText.refine((v) => v.length >= 4, "Enter a phone number"),
  preferredLanguage: z.enum(LANGUAGES as [string, ...string[]], { message: "Choose a language" }),
  ecName: shortText(120).optional().default(""),
  ecRelationship: shortText(60).optional().default(""),
  ecPhone: phoneText,
  ecEmail: optionalEmail,
});

/** Creates a demo citizen account and starts a demo session. */
export async function createDemoAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await ensureSeeded();
  const parsed = accountSchema.safeParse(formObj(fd));
  if (!parsed.success) return fail(parsed.error);
  const d = parsed.data;
  if (d.ecName && (!d.ecPhone || !d.ecRelationship)) {
    return { error: "To add an emergency contact, enter their name, relationship and phone number – or leave all of them empty.", fieldErrors: { ecPhone: "Phone number is required for an emergency contact" } };
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (existing) return { error: "A demo account already uses that email. Choose a different email, or sign in with a demo persona.", fieldErrors: { email: "Already used by a demo account" } };

  const [u] = await db.insert(users).values({ email: d.email, displayName: d.fullName, role: "citizen" }).returning();
  await db.insert(citizenProfiles).values({ userId: u.id, fullName: d.fullName, citizenship: d.citizenship, phoneDial: d.phoneDial, phoneNumber: d.phoneNumber, preferredLanguage: d.preferredLanguage });
  await db.insert(notificationPreferences).values({ userId: u.id, email: bool(fd, "notifyEmail"), sms: bool(fd, "notifySms"), push: bool(fd, "notifyPush") });
  if (d.ecName) await db.insert(emergencyContacts).values({ userId: u.id, name: d.ecName, relationship: d.ecRelationship, phone: d.ecPhone, email: d.ecEmail || null });
  await audit(u, "account.create", "user", u.id, "Demo citizen account created");
  await startSession(u.id);
  redirect(`/app?welcome=1&ecs=${encodeURIComponent(signSession(u.id))}`);
}
