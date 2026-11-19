"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bookmark, BookmarkCheck, ChevronDown, PenTool, RefreshCw, Zap } from "lucide-react";
import { api } from "@/lib/client";
import { secondaryButton } from "@/components/ui";
import { HOT_RELEVANCE_LABEL, HOT_SOURCE_LABEL, HOT_SOURCES, type HotMatch, type HotTake, type Platform } from "@/lib/types";

function formatHeat(heat: number) {
  if (heat < 10000) return String(heat);
  const wan = heat / 10000;
  const text = wan >= 100 ? String(Math.round(wan)) : wan.toFixed(1).replace(/\.0$/, "");
  return `${text} 万`;
}

function clock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function creationTheme(item: HotMatch) {
  const parts = [`借热点「${item.title}」来写`];
  if (item.summary) parts.push(item.summary);
  if (item.bridge) parts.push(item.bridge);
  return parts.join("。").replace(/。{2,}/g, "。").slice(0, 300);
}

function fitTone(fit: HotMatch["fit"]) {
  if (fit === "high") return "border-cinnabar/30 bg-cinnabar-soft text-cinnabar-deep";
  if (fit === "mid") return "border-blue/20 bg-blue-soft text-blue";
  return "border-line bg-paper-deep text-muted";
}

export function HotspotPanel({
  accountId,
  platform,
  enabled,
  onTake,
  onCreate,
  onPooled,
}: {
  accountId: number | null;
  platform: Platform;
  enabled: boolean;
  onTake?: (take: HotTake | null) => void;
  onCreate?: (theme: string, hotspot: { title: string; summary: string }) => void;
  onPooled?: () => void;
}) {
  const [take, setTake] = useState<HotTake | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reusedBoard, setReusedBoard] = useState(false);
  const [usedKey, setUsedKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const report = useRef(onTake);
  const seenAccount = useRef<number | null>(null);
  report.current = onTake;

  function apply(next: HotTake | null, accountChanged: boolean) {
    setTake(next);
    report.current?.(next);
    setReusedBoard(Boolean(accountChanged && next));
  }

  useEffect(() => {
    if (!enabled || !accountId) {
      setTake(null);
      report.current?.(null);
      setError("");
      setLoading(false);
      setRefreshing(false);
      setReusedBoard(false);
      return;
    }
    let cancelled = false;
    const accountChanged = seenAccount.current !== null && seenAccount.current !== accountId;
    seenAccount.current = accountId;
    setLoading(true);
    setError("");
    api<{ take: HotTake | null; refreshing?: boolean; error?: string }>(`/api/hotspots?accountId=${accountId}&platform=${platform}`)
      .then((data) => {
        if (cancelled) return;
        apply(data.take, accountChanged);
        setRefreshing(Boolean(data.refreshing));
        if (data.error && !data.refreshing) setError(data.error);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "热点整理失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, platform, enabled]);

  useEffect(() => {
    if (!enabled || !accountId || !refreshing) return;
    let cancelled = false;
    const tick = () => {
      void api<{ take: HotTake | null; refreshing?: boolean; error?: string }>(`/api/hotspots?accountId=${accountId}&platform=${platform}`)
        .then((data) => {
          if (cancelled) return;
          if (data.take) apply(data.take, false);
          if (data.error && !data.refreshing) setError(data.error);
          setRefreshing(Boolean(data.refreshing));
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "热点抓取失败");
        });
    };
    const timer = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accountId, platform, enabled, refreshing]);

  async function grab() {
    if (!accountId || refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      const data = await api<{ take: HotTake | null; refreshing?: boolean }>(`/api/hotspots?accountId=${accountId}&platform=${platform}`, {
        method: "POST",
      });
      apply(data.take, false);
      setRefreshing(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "热点抓取失败");
      setRefreshing(false);
    }
  }

  if (!enabled || !accountId) return null;

  const board = take?.board ?? [];
  const sources = take?.sources?.length
    ? take.sources
    : HOT_SOURCES.map((id) => ({ id, ok: board.some((item) => item.source === id), error: board.length ? "" : "还没抓取" }));
  const picked = new Set((take?.matches ?? []).map((item) => `${item.source}:${item.title}`));
  const busy = loading || refreshing;

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">热点趋势</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            来源：
            {HOT_SOURCES.map((id, index) => {
              const source = sources.find((item) => item.id === id);
              const failed = source ? !source.ok : false;
              return (
                <span key={id}>
                  {index > 0 ? "、" : ""}
                  <span className={failed ? "text-cinnabar-deep" : ""}>
                    {HOT_SOURCE_LABEL[id]}
                    {failed && source?.error ? `（${source.error}）` : ""}
                  </span>
                </span>
              );
            })}
            {take ? ` · ${clock(take.fetchedAt)}` : ""}
          </p>
        </div>
        <button type="button" className={secondaryButton} onClick={grab} disabled={busy}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {refreshing ? "正在抓取…" : "抓取热点"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-cinnabar-deep">{error}</p> : null}
      {loading && !take ? <p className="mt-3 text-sm text-muted">正在查看上次的榜…</p> : null}
      {reusedBoard ? <p className="mt-3 text-sm leading-6 text-muted">已按这个账号，用刚才的榜再看了一次。要更新榜单，再点抓取热点。</p> : null}
      {take?.matchedBy === "local" && take.matches.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-muted">模型还没接上。下面只留了标题和账号定位用词对得上的，蹭点和建议是按定位拼出来的。接上模型后，会把每一条都判一遍。</p>
      ) : null}
      {take?.note ? <p className="mt-3 text-sm leading-6">{take.note}</p> : null}

      {!take && !loading ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-line bg-paper/50 px-6 py-14 text-center">
          <Zap className="mx-auto mb-3 h-8 w-8 text-muted/40" />
          <p className="text-sm leading-6 text-muted">
            还没有榜单。点「抓取热点」，拉取微博、百度、抖音、今日头条、知乎和 B 站的热榜，再按这个账号的定位逐条看哪些可蹭。
          </p>
        </div>
      ) : null}

      {take && take.matches.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-base font-semibold tracking-tight">可蹭的热点</h3>
          <p className="mt-1 pl-4 text-xs leading-5 text-muted">每一条都和这个账号的定位对照过，下面只留可蹭的。热度数字是各家自己的，不能放在一起比。</p>
          <ul className="mt-3 space-y-3">
            {take.matches.map((item) => {
              const key = `${item.source}:${item.title}`;
              const used = usedKey === key;
              return (
                <li
                  key={key}
                  className={`overflow-hidden rounded-lg border bg-card transition ${used ? "border-blue" : "border-line hover:border-ink/15"}`}
                >
                  <div className="border-b border-line/60 bg-paper-deep/70 px-4 py-3">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded px-1.5 py-0.5 font-medium text-muted ring-1 ring-inset ring-line">{HOT_SOURCE_LABEL[item.source]}</span>
                      <span className="rounded bg-paper-deep px-1.5 py-0.5 font-medium text-muted">第 {item.rank} 名</span>
                      {typeof item.heat === "number" ? <span className="rounded px-1.5 py-0.5 font-semibold text-cinnabar-deep">热度 {formatHeat(item.heat)}</span> : null}
                      <span className={`rounded px-1.5 py-0.5 font-medium ${fitTone(item.fit)}`}>{HOT_RELEVANCE_LABEL[item.fit]}</span>
                      {item.link ? <span className="text-muted">对照{item.link}</span> : null}
                      {used ? <span className="ml-auto rounded bg-blue px-2 py-0.5 text-[10px] font-medium text-white">已用来创作</span> : null}
                    </div>
                    <h4 className="text-base font-semibold leading-snug tracking-tight">{item.title}</h4>
                    {item.summary ? <p className="mt-1.5 text-sm leading-6 text-muted">{item.summary}</p> : null}
                  </div>
                  <div className="grid gap-0 sm:grid-cols-2">
                    <div className="border-b border-line px-4 py-3 sm:border-b-0 sm:border-r">
                      <span className="inline-block rounded bg-blue-soft px-1.5 py-0.5 text-[11px] font-medium text-blue">蹭点</span>
                      <p className="mt-1.5 text-sm leading-6 text-ink/80">{item.reason}</p>
                    </div>
                    <div className="border-b border-line px-4 py-3 sm:border-b-0">
                      <span className="inline-block rounded bg-blue-soft px-1.5 py-0.5 text-[11px] font-medium text-blue">建议</span>
                      <p className="mt-1.5 text-sm leading-6 text-ink/80">{item.bridge}</p>
                    </div>
                  </div>
                  {item.caution ? (
                    <p className="flex items-center gap-1.5 bg-cinnabar-soft px-4 py-2 text-xs leading-5 text-cinnabar-deep">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {item.caution}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-2 border-t border-line">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-paper-deep"
                      onClick={async () => {
                        setSaveError("");
                        try {
                          await api(`/api/accounts/${accountId}/pool`, {
                            method: "POST",
                            body: JSON.stringify({
                              subject: creationTheme(item),
                              note: item.reason,
                              source: "热点",
                              hotspot: { title: item.title, summary: item.summary },
                            }),
                          });
                          setSavedKey(key);
                          onPooled?.();
                        } catch (err) {
                          setSaveError(err instanceof Error ? err.message : "没有存进选题池");
                        }
                      }}
                    >
                      {savedKey === key ? <BookmarkCheck className="h-3.5 w-3.5 text-blue" /> : <Bookmark className="h-3.5 w-3.5" />}
                      {savedKey === key ? "已存进选题池" : "先存进选题池"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 border-l border-line bg-blue py-2.5 text-sm font-medium text-white transition hover:bg-blue/90 disabled:opacity-60"
                      onClick={() => {
                        setUsedKey(key);
                        onCreate?.(creationTheme(item), { title: item.title, summary: item.summary });
                      }}
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      {used ? "已用来创作" : "使用该题材创作"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {saveError ? <p className="mt-3 text-sm text-cinnabar-deep">{saveError}</p> : null}
        </div>
      ) : null}

      {board.length > 0 ? (
        <details className="mt-6 rounded-2xl border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
            原始榜单
            <ChevronDown className="h-4 w-4 text-muted" />
          </summary>
          <div className="border-t border-line px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {HOT_SOURCES.map((source) => {
              const rows = board.filter((item) => item.source === source);
              if (rows.length === 0) return null;
              return (
                <div key={source}>
                  <h4 className="text-sm">{HOT_SOURCE_LABEL[source]}</h4>
                  <ol className="mt-2 space-y-1">
                    {rows.map((item) => {
                      const key = `${item.source}:${item.title}`;
                      const chosen = picked.has(key);
                      return (
                        <li key={key} className={`flex items-baseline justify-between gap-3 rounded-xl px-2 py-1.5 text-sm leading-6 ${chosen ? "bg-paper-deep" : ""}`}>
                          <span className="min-w-0">{item.title}</span>
                          {typeof item.heat === "number" ? <span className="shrink-0 text-xs text-muted">热度 {formatHeat(item.heat)}</span> : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
          </div>
        </details>
      ) : null}
    </section>
  );
}
