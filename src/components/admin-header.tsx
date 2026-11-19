"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

export function AdminHeader({ username }: { username: string }) {
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
          <span className="hidden rounded-md border border-blue/25 bg-blue-soft px-2 py-0.5 text-[10px] font-medium text-blue sm:inline">
            管理后台
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-sm">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-muted transition hover:bg-paper-deep hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">工作台</span>
          </Link>
          <span className="hidden max-w-32 truncate text-muted md:inline">{username}</span>
          <button
            type="button"
            onClick={logout}
            disabled={pending}
            className="rounded-md border border-line px-3 py-1.5 transition hover:bg-paper-deep disabled:opacity-50"
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}
