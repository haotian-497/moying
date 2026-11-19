"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { Bookmark, ChevronDown, ChevronUp, Flame, PenTool } from "lucide-react";
import { chipButton, fieldClass, secondaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import type { TopicPoolItem, WorkHotspot } from "@/lib/types";

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function TopicPool({
  accountId,
  refreshKey,
  onUse,
  onChange,
}: {
  accountId: number | null;
  refreshKey: number;
  onUse: (subject: string, hotspot: WorkHotspot | null) => void;
  onChange: () => void;
}) {
  const [items, setItems] = useState<TopicPoolItem[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!accountId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    api<{ pool: TopicPoolItem[] }>(`/api/accounts/${accountId}/pool`)
      .then((data) => {
        if (!cancelled) setItems(data.pool);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, refreshKey]);

  async function add() {
    const subject = draft.trim();
    if (!accountId || subject.length < 2 || pending) return;
    setPending(true);
    setError("");
    try {
      await api(`/api/accounts/${accountId}/pool`, { method: "POST", body: JSON.stringify({ subject, source: "手动" }) });
      setDraft("");
      setOpen(true);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有存进选题池");
    } finally {
      setPending(false);
    }
  }

  async function patch(id: number, body: { planDate?: string; status?: "idea" | "done" }) {
    if (!accountId) return;
    setError("");
    try {
      await api(`/api/accounts/${accountId}/pool/${id}`, { method: "PUT", body: JSON.stringify(body) });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有改成");
    }
  }

  async function remove(id: number) {
    if (!accountId) return;
    setError("");
    try {
      await api(`/api/accounts/${accountId}/pool/${id}`, { method: "DELETE" });
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有删掉");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void add();
    }
  }

  if (!accountId) return null;
  const waiting = items.filter((item) => item.status !== "done");
  const due = waiting.filter((item) => item.planDate && item.planDate <= today()).length;
  const note = items.length === 0 ? "空的" : `${waiting.length} 条待写${due ? ` · ${due} 条到期` : ""}`;

  return (
    <section className="mt-4 rounded-lg border border-line bg-card">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p className="text-sm font-medium">
          选题池 <span className="text-xs font-normal text-muted">{note}</span>
        </p>
        <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink" onClick={() => setOpen((current) => !current)}>
          {open ? "收起" : "展开"}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-line px-3 py-3">
          {items.length === 0 ? (
            <p className="text-sm leading-6 text-muted">还没攒选题。热点里能蹭的、推荐题材里想留的，都可以先存进来。</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const overdue = Boolean(item.planDate && item.planDate <= today() && item.status !== "done");
                return (
                  <li key={item.id} className={`rounded-md border px-3 py-2 ${item.status === "done" ? "border-line opacity-60" : overdue ? "border-cinnabar/40 bg-cinnabar-soft" : "border-line"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 text-sm leading-6">
                        {item.source === "热点" ? <Flame className="mr-1 inline h-3 w-3 text-cinnabar" /> : null}
                        <span className="mr-2 text-xs text-muted">{item.source}</span>
                        <span className={item.status === "done" ? "line-through" : ""} title={item.note}>{item.subject}</span>
                      </p>
                      <span className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className={chipButton}
                          onClick={() => {
                            onUse(item.subject, item.hotspot);
                            if (item.status !== "done") void patch(item.id, { status: "done" });
                          }}
                        >
                          <PenTool className="h-3 w-3" />
                          写这条
                        </button>
                        <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => void remove(item.id)}>
                          删
                        </button>
                      </span>
                    </div>
                    {item.note ? <p className="mt-1 text-xs leading-5 text-muted">{item.note}</p> : null}
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                      排到
                      <input
                        type="date"
                        className="rounded-sm border border-line bg-card px-2 py-1 text-xs text-ink"
                        value={item.planDate}
                        title="排到哪天，留空就只是待选"
                        onChange={(event) => void patch(item.id, { planDate: event.target.value })}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <input className={fieldClass} value={draft} maxLength={300} placeholder="想到什么先记一条，回车存入" onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} />
            <button type="button" className={secondaryButton} disabled={pending || draft.trim().length < 2} onClick={() => void add()}>
              <Bookmark className="h-3.5 w-3.5" />
              存入
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-cinnabar-deep">{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
