import { z } from "zod";
import type { ActionState } from "./types";

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
export const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date").optional().default("");
export const shortText = (max: number, label = "This field") => z.string().trim().max(max, `${label} must be ${max} characters or fewer`);
export const requiredText = (max: number, label = "This field") => z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);
export const optionalEmail = z.string().trim().max(200).refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address").optional().default("");
export const phoneText = z.string().trim().max(30).refine((v) => v === "" || /^\+?[0-9 ()\-.]{4,30}$/.test(v), "Use digits, spaces, dashes and an optional leading +").optional().default("");

export function fail(err: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { error: `Please check the highlighted fields: ${Object.values(fieldErrors).slice(0, 3).join(" · ")}`, fieldErrors };
}

export const formObj = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
export const bool = (fd: FormData, key: string) => fd.get(key) === "on" || fd.get(key) === "true";
export const UUID = /^[0-9a-f-]{36}$/;
