"use client";

import { btn } from "./ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className={btn("outline")} onClick={() => window.print()}>
      {label}
    </button>
  );
}
