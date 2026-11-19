"use client";

import { useState, type FormEvent } from "react";
import { fieldClass, primaryButton } from "@/components/ui";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOk("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password, confirm }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "改密失败");
        setPending(false);
        return;
      }
      setCurrentPassword("");
      setPassword("");
      setConfirm("");
      setOk("密码已更新。");
      setPending(false);
    } catch {
      setError("网络异常，请再试一次");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block text-muted">当前密码</span>
        <input
          className={fieldClass}
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
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
      {error ? <p className="text-sm text-cinnabar-deep">{error}</p> : null}
      {ok ? <p className="text-sm text-moss">{ok}</p> : null}
      <button type="submit" className={primaryButton} disabled={pending}>
        {pending ? "请稍候…" : "更新密码"}
      </button>
    </form>
  );
}
