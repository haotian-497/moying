"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const DAYS = [1, 7, 30, 90];

export function AdminDays({ path, days, className = "mt-4" }: { path: string; days: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-card px-3 text-sm font-medium shadow-sm transition hover:bg-paper-deep"
      >
        近 {days} 天
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div id={menuId} role="menu" className="absolute right-0 z-20 mt-1.5 min-w-32 rounded-md border border-line bg-card p-1 shadow-lg">
          {DAYS.map((item) => (
            <Link
              key={item}
              role="menuitem"
              href={`${path}?days=${item}`}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm transition ${
                item === days ? "bg-paper-deep font-medium text-ink" : "text-muted hover:bg-paper hover:text-ink"
              }`}
            >
              近 {item} 天
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
