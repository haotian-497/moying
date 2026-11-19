"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { fieldClass, primaryButton } from "@/components/ui";

const LAST_USERNAME_KEY = "moyin_last_username";

export function AuthForm({ mode, nextPath }: { mode: "login" | "register"; nextPath: string }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const passwordRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isRegister) return;
    try {
      const saved = localStorage.getItem(LAST_USERNAME_KEY)?.trim() ?? "";
      if (saved) {
        setUsername(saved);
        queue.queueMicrotask(() => passwordRef.current?.focus());
      }
    } catch {
      /* private mode / blocked storage */
    }
  }, [isRegister]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (isRegister && password !== confirm) {
      setError("两次密码不一致");
      return;
    }
    setPending(true);
    try {
      const response = await fetch(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "请求失败");
        setPending(false);
        return;
      }
      try {
        localStorage.setItem(LAST_USERNAME_KEY, username.trim());
      } catch {
        /* ignore */
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("网络异常，请再试一次");
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <Logo href="/" />
      <div className="mt-8 rounded-3xl border border-line bg-card px-6 py-7 shadow-[0_16px_40px_rgba(28,24,20,0.05)]">
        <h1 className="text-3xl">{isRegister ? "注册账号" : "登录"}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {isRegister ? "注册后，这台浏览器里已经写的稿会留在这个账号上。" : "登录后回到你自己的稿库。"}
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">用户名</span>
            <input
              className={fieldClass}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted">密码</span>
            <input
              ref={passwordRef}
              className={fieldClass}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </label>
          {isRegister ? (
            <label className="block text-sm">
              <span className="mb-1.5 block text-muted">再输入一次密码</span>
              <input
                className={fieldClass}
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}
          {error ? <p className="text-sm text-cinnabar-deep">{error}</p> : null}
          <button type="submit" className={`${primaryButton} w-full`} disabled={pending}>
            {pending ? "请稍候…" : isRegister ? "注册并进入" : "登录"}
          </button>
        </form>
        <p className="mt-5 text-sm text-muted">
          {isRegister ? (
            <>
              已有账号？{" "}
              <Link href="/login" className="text-ink underline">
                登录
              </Link>
            </>
          ) : (
            <>
              还没有账号？{" "}
              <Link href="/register" className="text-ink underline">
                注册
              </Link>
              <span className="mx-2 text-line">·</span>
              <Link href="/reset-password" className="text-ink underline">
                忘记密码
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
