import type { ReactNode } from "react";

export const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink shadow-sm transition hover:border-ink/20 hover:bg-paper-deep disabled:cursor-not-allowed disabled:opacity-50";

export const ghostButton =
  "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-paper-deep hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";

export const chipButton =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs transition hover:border-ink/20 hover:bg-paper-deep";

export const fieldClass =
  "w-full rounded-md border border-line bg-card px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-blue focus:ring-2 focus:ring-blue/15";

export function Banner({ tone, children }: { tone: "warn" | "bad" | "ok"; children: ReactNode }) {
  const toneClass =
    tone === "bad"
      ? "border border-red-200 bg-red-50 text-red-700"
      : tone === "ok"
        ? "border border-moss/25 bg-moss-soft text-moss"
        : "border border-amber-200 bg-amber-50 text-amber-800";
  return <div className={`rounded-md px-4 py-3 text-sm leading-6 ${toneClass}`}>{children}</div>;
}

export const panelClass = "rounded-lg border border-line bg-card shadow-sm";
export const panelPadClass = "rounded-lg border border-line bg-card px-4 py-4 shadow-sm";
export const softPanelClass = "rounded-md bg-paper-deep px-3 py-3";
export const pageTitleClass = "text-xl font-semibold tracking-tight";
export const pageDescClass = "mt-1.5 text-sm leading-6 text-muted";
export const sectionTitleClass = "text-sm font-semibold tracking-tight";
export const metaBadgeClass = "inline-flex items-center rounded-md border border-line bg-card px-2 py-0.5 text-[10px] font-medium text-muted";
