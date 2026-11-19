"use client";

import { Copy, RefreshCw, X } from "lucide-react";
import { secondaryButton } from "@/components/ui";
import type { SpokenCueLine, SpokenCues } from "@/lib/types";

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightStress(quote: string, stress: string[]) {
  let html = escapeHtml(quote);
  for (const word of stress) {
    const safe = escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!safe) continue;
    html = html.replace(new RegExp(safe, "g"), (match) => `<mark class="rounded-sm bg-cinnabar-soft px-0.5 text-cinnabar-deep">${match}</mark>`);
  }
  return html;
}

function cueMarks(cue: SpokenCueLine) {
  return [
    cue.emotion ? ["语气", cue.emotion] : null,
    cue.stress.length > 0 ? ["重读", cue.stress.join("、")] : null,
    cue.pause ? ["停顿", cue.pause] : null,
    cue.expression ? ["表情", cue.expression] : null,
    cue.gesture ? ["动作", cue.gesture] : null,
  ].filter((item): item is [string, string] => Boolean(item));
}

export function formatSpokenCopy(cues: SpokenCues) {
  const overall = cues.overall;
  const head = [
    `【整体基调】${overall.tone || "—"}`,
    `【语速节奏】${overall.pace || "—"}`,
    overall.note ? `【出镜提醒】${overall.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const body = cues.cues
    .map((cue) => {
      const marks = cueMarks(cue)
        .map(([label, value]) => `${label}：${value}`)
        .join("　");
      return marks ? `${cue.quote}\n（${marks}）` : cue.quote;
    })
    .join("\n\n");
  return `${head}\n\n${"—".repeat(20)}\n\n${body}\n`;
}

export function SpokenCuesDialog({
  open,
  cues,
  busy,
  onClose,
  onGenerate,
  onCopy,
}: {
  open: boolean;
  cues: SpokenCues | null;
  busy: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onCopy: (text: string) => void;
}) {
  if (!open) return null;
  const overall = cues?.overall;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="spoken-cues-title">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="关闭口播提示" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(36rem,calc(100vh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-card shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 id="spoken-cues-title" className="text-sm font-semibold">
              口播提示
            </h3>
            <p className="mt-0.5 text-xs leading-5 text-muted">按一口气念完的一句切段。正文一改，这里会作废。</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cues ? (
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => onCopy(formatSpokenCopy(cues))}>
                <Copy className="h-3.5 w-3.5" />
                复制
              </button>
            ) : null}
            <button type="button" className={secondaryButton} disabled={busy} onClick={onGenerate}>
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
              {busy ? "正在生成…" : cues ? "重新生成" : "生成"}
            </button>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-paper-deep hover:text-ink" onClick={onClose} aria-label="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="scrollbar-thin min-h-40 overflow-y-auto px-5 py-4">
          {busy && !cues ? <p className="text-sm text-muted">正在按句切段并标语气…</p> : null}
          {cues ? (
            <>
              <div className="space-y-1.5 text-sm leading-6">
                {overall?.tone ? (
                  <p>
                    <span className="text-xs text-muted">整体基调</span>
                    <span className="mt-0.5 block">{overall.tone}</span>
                  </p>
                ) : null}
                {overall?.pace ? (
                  <p>
                    <span className="text-xs text-muted">语速节奏</span>
                    <span className="mt-0.5 block">{overall.pace}</span>
                  </p>
                ) : null}
                {overall?.note ? (
                  <p>
                    <span className="text-xs text-muted">出镜提醒</span>
                    <span className="mt-0.5 block">{overall.note}</span>
                  </p>
                ) : null}
                {cues.coverage < 60 ? (
                  <p className="text-xs leading-5 text-muted">只覆盖了正文约 {cues.coverage}%——标题、标签这类不念的内容会跳过</p>
                ) : null}
                {cues.dropped > 0 ? <p className="text-xs leading-5 text-muted">有 {cues.dropped} 段和正文对不上，已丢掉</p> : null}
              </div>
              <ul className="mt-4 space-y-3">
                {cues.cues.map((cue, index) => {
                  const marks = cueMarks(cue);
                  return (
                    <li key={`${index}-${cue.quote.slice(0, 12)}`} className="rounded-md border border-line bg-paper/50 px-3 py-3">
                      <p className="text-sm leading-7" dangerouslySetInnerHTML={{ __html: highlightStress(cue.quote, cue.stress) }} />
                      {marks.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {marks.map(([label, value]) => (
                            <span key={label} className="rounded-md bg-card px-2 py-1 text-xs leading-5 text-muted ring-1 ring-line">
                              <span className="mr-1 text-ink">{label}</span>
                              {value}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : busy ? null : (
            <p className="text-sm text-muted">还没有口播提示。点「生成」按正文切段。</p>
          )}
        </div>
      </div>
    </div>
  );
}
