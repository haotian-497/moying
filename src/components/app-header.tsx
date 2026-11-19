"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenTool, TrendingUp } from "lucide-react";
import { Logo } from "@/components/logo";
import { UsageGuideButton } from "@/components/usage-guide";

function ModeSwitch({ mode, onMode }: { mode: "create" | "hot" | null; onMode?: (mode: "create" | "hot") => void }) {
  const items = [
    { id: "create" as const, label: "创作 Studio", href: "/", Icon: PenTool },
    { id: "hot" as const, label: "热点趋势 Hotspots", href: "/?mode=hot", Icon: TrendingUp },
  ];
  return (
    <div role="tablist" aria-label="创作或热点" className="inline-flex h-9 items-center rounded-lg bg-paper-deep p-1 text-muted">
      {items.map(({ id, label, href, Icon }) => {
        const on = mode === id;
        const className = `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition sm:px-4 ${
          on ? "bg-card text-ink shadow-sm" : "hover:text-ink"
        }`;
        if (onMode) {
          return (
            <button key={id} type="button" role="tab" aria-selected={on} className={className} onClick={() => onMode(id)}>
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{id === "create" ? "创作" : "热点"}</span>
            </button>
          );
        }
        return (
          <Link key={id} href={href} role="tab" aria-selected={on} className={className}>
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{id === "create" ? "创作" : "热点"}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function AppHeader({
  username,
  guest,
  mode = null,
  onMode,
}: {
  username: string;
  guest: boolean;
  mode?: "create" | "hot" | null;
  onMode?: (mode: "create" | "hot") => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card">
      <div className="relative mx-auto flex h-14 w-full max-w-[100rem] items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Logo href="/" />
          <span
            className={`hidden rounded-md border px-2 py-0.5 text-[10px] font-medium sm:inline ${
              guest ? "border-amber-200 bg-amber-50 text-amber-700" : "border-moss/30 bg-moss-soft text-moss"
            }`}
          >
            {guest ? "游客模式" : "已登录"}
          </span>
        </div>

        {onMode || mode !== null ? (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <ModeSwitch mode={mode} onMode={onMode} />
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2 text-sm">
          <UsageGuideButton />
          {guest ? (
            <>
              <Link href="/login" className="rounded-md px-3 py-1.5 text-muted transition hover:bg-paper-deep hover:text-ink">
                登录
              </Link>
              <Link href="/register" className="rounded-md bg-ink px-3 py-1.5 text-white transition hover:bg-ink/90">
                注册
              </Link>
            </>
          ) : (
            <>
              <span className="hidden max-w-32 truncate text-muted md:inline">{username}</span>
              <Link href="/password" className="hidden rounded-md px-3 py-1.5 text-muted transition hover:bg-paper-deep hover:text-ink sm:inline">
                改密
              </Link>
              <button
                type="button"
                onClick={logout}
                disabled={pending}
                className="rounded-md border border-line px-3 py-1.5 transition hover:bg-paper-deep disabled:opacity-50"
              >
                退出
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
