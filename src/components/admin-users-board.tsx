"use client";

import { useState } from "react";
import { fieldClass, pageDescClass, pageTitleClass, panelClass, primaryButton, secondaryButton } from "@/components/ui";
import { formatTime, formatTokens } from "@/lib/format";

type AdminUser = {
  id: number;
  username: string;
  guest: boolean;
  admin: boolean;
  createdAt: string;
  workCount: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  lastAt: string | null;
};

function identityBadge(user: { guest: boolean; admin: boolean }) {
  if (user.admin) return { label: "管理员", className: "border-blue/25 bg-blue-soft text-blue" };
  if (user.guest) return { label: "游客", className: "border-amber-200 bg-amber-50 text-amber-700" };
  return { label: "注册", className: "border-moss/30 bg-moss-soft text-moss" };
}

export function AdminUsersBoard({ users }: { users: AdminUser[] }) {
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    setTarget(null);
    setPassword("");
    setConfirm("");
    setError("");
    setOk("");
    setPending(false);
  }

  async function submit() {
    if (!target) return;
    setError("");
    setOk("");
    setPending(true);
    try {
      const response = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id, password, confirm }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || "重置失败");
        setPending(false);
        return;
      }
      setOk(`已重置「${target.username}」的密码。`);
      setPassword("");
      setConfirm("");
      setPending(false);
    } catch {
      setError("网络异常，请再试一次");
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className={pageTitleClass}>用户</h1>
      <p className={pageDescClass}>共 {users.length} 个。可对注册用户重置密码；正文仍不在这里展示。</p>
      <div className={`mt-6 overflow-x-auto ${panelClass}`}>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line bg-paper-deep/60 text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">用户名</th>
              <th className="px-4 py-3 font-medium">身份</th>
              <th className="px-4 py-3 font-medium">注册</th>
              <th className="px-4 py-3 font-medium">稿子</th>
              <th className="px-4 py-3 font-medium">调用</th>
              <th className="px-4 py-3 font-medium">token</th>
              <th className="px-4 py-3 font-medium">最近使用</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const badge = identityBadge(user);
              return (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatTime(user.createdAt)}</td>
                  <td className="px-4 py-3">{user.workCount}</td>
                  <td className="px-4 py-3">{user.calls}</td>
                  <td className="px-4 py-3 text-muted">{formatTokens(user.inputTokens + user.outputTokens)}</td>
                  <td className="px-4 py-3 text-muted">{user.lastAt ? formatTime(user.lastAt) : "还没有"}</td>
                  <td className="px-4 py-3">
                    {user.guest ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      <button type="button" className={secondaryButton} onClick={() => setTarget(user)}>
                        重置密码
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {target ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="reset-user-password-title">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="关闭" onClick={close} />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-lg">
            <h2 id="reset-user-password-title" className="text-base font-semibold">
              重置密码 · {target.username}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">设置新密码后，该用户需用新密码登录。看不到旧密码明文。</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">新密码</span>
                <input className={fieldClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-muted">再输入一次</span>
                <input className={fieldClass} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" />
              </label>
              {error ? <p className="text-sm text-cinnabar-deep">{error}</p> : null}
              {ok ? <p className="text-sm text-moss">{ok}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={secondaryButton} onClick={close} disabled={pending}>
                关闭
              </button>
              <button type="button" className={primaryButton} onClick={() => void submit()} disabled={pending}>
                {pending ? "请稍候…" : "确认重置"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
