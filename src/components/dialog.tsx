"use client";

import { useId, useRef, type ReactNode } from "react";
import { btn, cx, type BtnVariant } from "./ui";

/**
 * Accessible confirmation dialog built on the native <dialog> element
 * (focus is trapped, Escape closes it, and focus returns to the trigger).
 */
export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  confirmLabel,
  action,
  triggerVariant = "outline",
  confirmVariant = "primary",
  triggerSize = "md",
  children,
}: {
  triggerLabel: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  action: (fd: FormData) => Promise<void>;
  triggerVariant?: BtnVariant;
  confirmVariant?: BtnVariant;
  triggerSize?: "sm" | "md";
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  return (
    <>
      <button type="button" className={btn(triggerVariant, triggerSize)} onClick={() => ref.current?.showModal()}>
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-navy-200 bg-white p-0 text-navy-900 shadow-2xl"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <form action={action} onSubmit={() => ref.current?.close()} className="space-y-4 p-6">
          <h2 id={titleId} className="font-serif text-2xl font-semibold text-navy-950">
            {title}
          </h2>
          <div id={descId} className="text-navy-700">
            {description}
          </div>
          {children}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" className={btn("outline")} onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className={cx(btn(confirmVariant))}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
