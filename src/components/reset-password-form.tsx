"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { fieldClass, primaryButton } from "@/components/ui";

const LAST_USERNAME_KEY = "moyin_last_username";

export function ResetPasswordForm({ resetEnabled }: { resetEnabled: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetKey, setResetKey] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_USERNAME_KEY)?.trim() ?? "";
      if (saved) setUsername(saved);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOk("");
    if (!resetEnabled) {
      setError("还没开启重置。请在 .env.local 配置 PASSWORD_RESET_KEY 或至少 8 位的 SESSION_SECRET，然后重启服务。");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirm, resetKey }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; username?: string };
      if (!response.ok) {
        setError(data.error || "重置失败");
        setPending(false);
        return;
      }
      try {
        localStorage.setItem(LAST_USERNAME_KEY, (data.username || username).trim());
      } catch {
        /* ignore */
      }
      setOk("密码已重置，请用新密码登录。");
      setPending(false);
      window.setTimeout(() => router.push("/login"), 800);
    } catch {
      setError("网络异常，请再试一次");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <Logo href="/" />
      <div className="mt-8 rounded-3xl border border-line bg-card px-6 py-7 shadow-[0_16px_40px_rgba(28,24,20,0.05)]">
        <h1 className="text-3xl">重置密码</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          本机部署没有邮箱验证。填写用户名、新密码，以及 .env.local 里的本机重置口令（优先{" "}
          <code className="rounded bg-paper-deep px-1">PASSWORD_RESET_KEY</code>，未配置则用{" "}
          <code className="rounded bg-paper-deep px-1">SESSION_SECRET</code>）。
        </p>
        {!resetEnabled ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-800">
            当前还不能重置：请配置至少 8 位的 SESSION_SECRET，或单独设置 PASSWORD_RESET_KEY，然后重启 npm run dev。
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">用户名</span>
            <input className={fieldClass} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">新密码</span>
            <input
              className={fieldClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">再输入一次新密码</span>
            <input
              className={fieldClass}
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">本机重置口令</span>
            <input
              className={fieldClass}
              type="password"
              value={resetKey}
              onChange={(event) => setResetKey(event.target.value)}
              autoComplete="off"
              required={resetEnabled}
              disabled={!resetEnabled}
            />
          </label>
          {error ? <p className="text-sm text-cinnabar-deep">{error}</p> : null}
          {ok ? <p className="text-sm text-moss">{ok}</p> : null}
          <button type="submit" className={`${primaryButton} w-full`} disabled={pending || !resetEnabled}>
            {pending ? "请稍候…" : "重置并去登录"}
          </button>
        </form>
        <p className="mt-5 text-sm text-muted">
          <Link href="/login" className="text-ink underline">
            返回登录
          </Link>
        </p>
      </div>
    </main>
  );
}
