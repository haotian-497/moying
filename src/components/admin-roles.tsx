"use client";

import { useState } from "react";
import { panelClass, secondaryButton } from "@/components/ui";

export function AdminRoles({ users, protectedUsername }: { users: { id: number; username: string; admin: boolean }[]; protectedUsername: string }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState<number | null>(null);

  async function toggle(userId: number, admin: boolean) {
    setError("");
    setPending(userId);
    try {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, admin }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "没有保存");
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有保存");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      {error ? <p className="mb-3 text-sm text-cinnabar-deep">{error}</p> : null}
      <div className={`overflow-x-auto ${panelClass}`}>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-line bg-paper-deep/60 text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">用户名</th>
              <th className="px-4 py-3 font-medium">身份</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const locked = user.username === protectedUsername;
              return (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                        locked
                          ? "border-line bg-paper-deep text-muted"
                          : user.admin
                            ? "border-blue/25 bg-blue-soft text-blue"
                            : "border-moss/30 bg-moss-soft text-moss"
                      }`}
                    >
                      {locked ? "配置指定" : user.admin ? "管理员" : "注册"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {locked ? (
                      <span className="text-muted">不能取消</span>
                    ) : (
                      <button type="button" className={secondaryButton} disabled={pending === user.id} onClick={() => toggle(user.id, !user.admin)}>
                        {user.admin ? "取消管理员" : "标成管理员"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
