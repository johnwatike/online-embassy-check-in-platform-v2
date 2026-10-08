"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { ActionState } from "@/lib/types";
import { btn, cx, type BtnVariant } from "./ui";

const FormCtx = createContext<{ errors: Record<string, string>; pending: boolean }>({ errors: {}, pending: false });

/**
 * Wraps a server action with validation feedback. The action receives (prevState, FormData).
 * Submitting through onSubmit keeps the user's input in place if validation fails.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  hideMessage = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  hideMessage?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <FormCtx.Provider value={{ errors: state?.fieldErrors ?? {}, pending }}>
      <form
        ref={ref}
        className={cx("space-y-4", className)}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          startTransition(() => formAction(fd));
        }}
      >
        {children}
        {!hideMessage && state?.error && (
          <div role="alert" className="rounded-xl border border-red-300 border-l-4 border-l-red-700 bg-red-50 px-4 py-3 text-sm text-red-950">
            {state.error}
          </div>
        )}
        {!hideMessage && state?.ok && state.message && (
          <div role="status" className="rounded-xl border border-emerald-300 border-l-4 border-l-emerald-600 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            {state.message}
          </div>
        )}
      </form>
    </FormCtx.Provider>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md", name, value, className, pendingLabel = "Working…", disabled }: { children: ReactNode; variant?: BtnVariant; size?: "sm" | "md" | "lg"; name?: string; value?: string; className?: string; pendingLabel?: string; disabled?: boolean }) {
  const { pending } = useContext(FormCtx);
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={pending} className={cx(btn(variant, size), className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}

function FieldShell({ label, name, hint, error, required, optional, children }: { label: string; name: string; hint?: string; error?: string; required?: boolean; optional?: boolean; children: (p: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }) {
  const ctx = useContext(FormCtx);
  const id = useId();
  const err = error ?? ctx.errors[name];
  const describedBy = [hint && `${id}-hint`, err && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
        {required && <span aria-hidden className="text-red-700"> *</span>}
        {optional && <span className="ml-1 font-normal text-navy-600">(optional)</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-sm text-navy-600">{hint}</p>}
      {children({ id, describedBy, invalid: !!err })}
      {err && <p id={`${id}-err`} role="alert" className="text-sm font-medium text-red-700">{err}</p>}
    </div>
  );
}

export const inputCls = "block w-full min-h-11 rounded-lg border border-navy-300 bg-white px-3.5 py-2.5 text-base text-navy-950 placeholder:text-navy-400 disabled:bg-navy-50 disabled:text-navy-500 aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-600";

type Common = { label: string; name: string; hint?: string; error?: string; optional?: boolean };

export function TextField({ label, name, hint, error, optional, required, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} required={required} optional={optional}>
      {({ id, describedBy, invalid }) => <input id={id} name={name} required={required} aria-describedby={describedBy} aria-invalid={invalid} className={cx(inputCls, className)} {...rest} />}
    </FieldShell>
  );
}

export function SelectField({ label, name, hint, error, optional, required, className, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} required={required} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <select id={id} name={name} required={required} aria-describedby={describedBy} aria-invalid={invalid} className={cx(inputCls, className)} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, name, hint, error, optional, required, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} name={name} hint={hint} error={error} required={required} optional={optional}>
      {({ id, describedBy, invalid }) => <textarea id={id} name={name} required={required} rows={4} aria-describedby={describedBy} aria-invalid={invalid} className={cx(inputCls, className)} {...rest} />}
    </FieldShell>
  );
}

export function CheckField({ label, name, hint, error, className, ...rest }: Omit<Common, "optional"> & InputHTMLAttributes<HTMLInputElement>) {
  const ctx = useContext(FormCtx);
  const id = useId();
  const err = error ?? ctx.errors[name];
  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" name={name} aria-describedby={err ? `${id}-err` : hint ? `${id}-hint` : undefined} aria-invalid={!!err} className="mt-1 size-5 shrink-0 rounded border-navy-400 accent-teal-700" {...rest} />
        <label htmlFor={id} className="text-base text-navy-900">
          {label}
          {hint && <span id={`${id}-hint`} className="block text-sm text-navy-600">{hint}</span>}
        </label>
      </div>
      {err && <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-red-700">{err}</p>}
    </div>
  );
}

export function RadioCards({
  name,
  legend,
  options,
  defaultValue,
  value,
  onChange,
  required,
  error,
  columns = 1,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string; description?: string; icon?: string }[];
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  error?: string;
  columns?: 1 | 2;
}) {
  const ctx = useContext(FormCtx);
  const err = error ?? ctx.errors[name];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-navy-900">
        {legend}
        {required && <span aria-hidden className="text-red-700"> *</span>}
      </legend>
      <div className={cx("grid gap-3", columns === 2 && "sm:grid-cols-2")}>
        {options.map((o) => (
          <label key={o.value} className="flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border-2 border-navy-200 bg-white p-4 transition-colors hover:border-navy-400 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-700">
            <input
              type="radio"
              name={name}
              value={o.value}
              required={required}
              {...(value !== undefined ? { checked: value === o.value, onChange: () => onChange?.(o.value) } : { defaultChecked: defaultValue === o.value })}
              className="mt-1 size-5 shrink-0 accent-teal-700"
            />
            <span>
              <span className="block text-base font-semibold text-navy-950">
                {o.icon && <span aria-hidden className="mr-2">{o.icon}</span>}
                {o.label}
              </span>
              {o.description && <span className="block text-sm text-navy-700">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {err && <p role="alert" className="mt-1 text-sm font-medium text-red-700">{err}</p>}
    </fieldset>
  );
}

/** Small standalone server-action button form (no feedback state). */
export function ActionButton({ action, children, variant = "outline", size = "sm", className }: { action: () => Promise<void>; children: ReactNode; variant?: BtnVariant; size?: "sm" | "md"; className?: string }) {
  return (
    <form action={action} className="inline">
      <button type="submit" className={cx(btn(variant, size), className)}>
        {children}
      </button>
    </form>
  );
}
