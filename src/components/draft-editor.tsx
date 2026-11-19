"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Copy, Download, FileText, MessageCircle, Mic, Pencil, Plus, Send, Sparkles } from "lucide-react";
import { primaryButton, secondaryButton } from "@/components/ui";
import { ArticleBody } from "@/components/article-body";
import { SpokenCuesDialog } from "@/components/spoken-cues";
import { countChars, formatCopy, formatMarkdown } from "@/lib/format";
import { QuotedText } from "@/components/quoted-text";
import { INSERT_ACTIONS, REWRITE_ACTIONS, copyTitle, type AssistRequest, type CopyContent, type CopyIssueWhere, type InsertAction, type RewriteAction, type SpokenCues } from "@/lib/types";

type Proposal = {
  kind: "rewrite" | "insert";
  start: number;
  end: number;
  text: string;
  base: string;
};

function around(text: string, start: number, end: number) {
  return {
    before: text.slice(Math.max(0, start - 240), start),
    after: text.slice(end, end + 240),
  };
}

function caretBox(textarea: HTMLTextAreaElement, index: number) {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const copy = ["boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "lineHeight", "textAlign"] as const;
  mirror.style.position = "fixed";
  mirror.style.left = "0";
  mirror.style.top = "0";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  for (const key of copy) mirror.style[key] = computed[key];
  mirror.textContent = textarea.value.slice(0, index);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  mirror.remove();
  const area = textarea.getBoundingClientRect();
  return {
    x: area.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft,
    y: area.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop,
    line: markerRect.height || parseFloat(computed.lineHeight) || 32,
  };
}

function menuPoint(textarea: HTMLTextAreaElement, end: number) {
  const box = caretBox(textarea, end);
  const half = Math.min(220, (window.innerWidth - 16) / 2);
  return {
    top: box.y,
    left: Math.min(window.innerWidth - half - 8, Math.max(half + 8, box.x)),
    line: box.line,
  };
}

function insertAt(source: string, index: number, text: string) {
  const chunk = text.trim();
  const before = source.slice(0, index);
  const after = source.slice(index);
  const lead = before.length === 0 || before.endsWith("\n") ? "" : "\n";
  const trail = after.length === 0 || after.startsWith("\n") ? "" : "\n";
  return `${before}${lead}${chunk}${trail}${after}`;
}

function fileStem(theme: string) {
  const stem = theme.replace(/[\\/:*?"<>|\s]+/g, " ").trim().slice(0, 40);
  return stem || "成稿";
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function DraftEditor({
  body,
  content,
  theme,
  disabled,
  accountId,
  onSave,
  onAssist,
  onKeepVoice,
  onOpenPlatforms,
  onSpokenCues,
  onReview,
  cues,
  pin,
}: {
  body: string;
  content: CopyContent;
  theme: string;
  disabled: boolean;
  accountId: number | null;
  onSave: (body: string) => Promise<void>;
  onAssist: (request: AssistRequest) => Promise<string>;
  onKeepVoice: (text: string) => Promise<void>;
  onOpenPlatforms: () => void;
  onSpokenCues: () => Promise<void>;
  onReview: () => Promise<void>;
  cues: SpokenCues | null;
  pin?: { where: CopyIssueWhere; quote: string; nonce: number } | null;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(body);
  const [editing, setEditing] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "confirm" | "export">(null);
  const [cuesOpen, setCuesOpen] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number; line: number } | null>(null);
  const [slash, setSlash] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<null | "save" | "assist" | "voice" | "cues">(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDraft(body);
    setSelection(null);
    setAnchor(null);
    setSlash(null);
    setProposal(null);
  }, [body]);

  useEffect(() => {
    if (!pin || pin.where !== "body" || !editing) return;
    const el = field.current;
    if (!el) return;
    const index = el.value.indexOf(pin.quote);
    if (index < 0) return;
    el.focus();
    el.setSelectionRange(index, index + pin.quote.length);
    const line = el.value.slice(0, index).split("\n").length - 1;
    const lineHeight = Number.parseFloat(window.getComputedStyle(el).lineHeight) || 32;
    el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 3);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pin, editing]);

  useLayoutEffect(() => {
    const el = field.current;
    if (!editing || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, draft]);

  useEffect(() => {
    if (!selection) {
      setAnchor(null);
      return;
    }
    function place() {
      const el = field.current;
      if (!el || !selection) return;
      setAnchor(menuPoint(el, selection.end));
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [selection, draft]);

  useEffect(() => {
    if (!selection) return;
    function onPointerDown(event: PointerEvent) {
      if (proposal) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target) || field.current?.contains(target)) return;
      setSelection(null);
    }
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (proposal?.kind === "rewrite") setProposal(null);
      else setSelection(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [selection, proposal]);

  useEffect(() => {
    if (!openMenu) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && barRef.current?.contains(target)) return;
      setOpenMenu(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openMenu]);

  const locked = disabled || busy !== null;
  const dirty = draft !== body;
  const selectedText = selection ? draft.slice(selection.start, selection.end) : "";

  function syncSelection() {
    const el = field.current;
    if (!el || proposal || slash !== null) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (end - start < 4) {
      setSelection(null);
      return;
    }
    setSelection({ start, end });
    setAnchor(menuPoint(el, end));
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || locked || proposal) return;
    const el = event.currentTarget;
    const pos = el.selectionStart ?? 0;
    const lineStart = draft.lastIndexOf("\n", pos - 1) + 1;
    if (draft.slice(lineStart, pos).trim() !== "") return;
    event.preventDefault();
    setSelection(null);
    setSlash(pos);
    setInstruction("");
    setError("");
  }

  async function run(request: AssistRequest, start: number, end: number) {
    setBusy("assist");
    setError("");
    setNotice("");
    try {
      const text = await onAssist(request);
      setProposal({ kind: request.kind, start, end, text, base: draft });
    } catch (err) {
      setError(err instanceof Error ? err.message : "改写失败");
    } finally {
      setBusy(null);
    }
  }

  function rewrite(action: RewriteAction) {
    if (!selection) return;
    const { before, after } = around(draft, selection.start, selection.end);
    void run(
      { kind: "rewrite", action, selection: draft.slice(selection.start, selection.end).trim(), before, after, instruction: "" },
      selection.start,
      selection.end,
    );
  }

  function insert(action: InsertAction) {
    if (slash === null) return;
    const { before, after } = around(draft, slash, slash);
    void run({ kind: "insert", action, selection: "", before, after, instruction: action === "custom" ? instruction.trim() : instruction.trim() }, slash, slash);
  }

  async function apply() {
    if (!proposal) return;
    const next = proposal.kind === "rewrite" ? proposal.base.slice(0, proposal.start) + proposal.text + proposal.base.slice(proposal.end) : insertAt(proposal.base, proposal.start, proposal.text);
    setProposal(null);
    setSelection(null);
    setSlash(null);
    setInstruction("");
    setDraft(next);
    setBusy("save");
    setError("");
    try {
      await onSave(next.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    setError("");
    try {
      await onSave(draft.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  function requireSaved() {
    if (!dirty) return true;
    setError("先保存正文，再做这一步");
    setOpenMenu(null);
    return false;
  }

  function toggleEditing() {
    if (editing) {
      if (dirty && !window.confirm("正文还没保存。离开编辑会丢掉这次修改。")) return;
      setDraft(body);
      setEditing(false);
      setSelection(null);
      setSlash(null);
      setProposal(null);
      return;
    }
    setEditing(true);
    setError("");
    window.setTimeout(() => field.current?.focus(), 0);
  }

  function savedCopy() {
    return formatCopy({ ...content, body });
  }

  async function keepVoice() {
    if (!requireSaved()) return;
    if (!accountId) {
      setError("这篇没有对应的账号设定");
      return;
    }
    const text = body.trim();
    if (text.length < 40) {
      setError("这篇太短，先写成一段再收语气");
      return;
    }
    const sample = text.slice(0, 1500);
    if (text.length > 1500 && !window.confirm("正文比较长，收进语气样本的是开头 1500 字。继续吗？")) return;
    setBusy("voice");
    setError("");
    setNotice("");
    try {
      await onKeepVoice(sample);
      setNotice("已收成这个账号的语气样本。下一篇生成和改写会参考它。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "没收进语气样本");
    } finally {
      setBusy(null);
    }
  }

  function openPlatforms() {
    if (!requireSaved()) return;
    setError("");
    try {
      onOpenPlatforms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "还不能出多平台版本");
    }
  }

  async function testReply() {
    if (!requireSaved()) return;
    setError("");
    setNotice("");
    try {
      await onReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "这次没检查成");
    }
  }

  async function spokenCues() {
    if (!requireSaved()) return false;
    setBusy("cues");
    setError("");
    setNotice("");
    try {
      await onSpokenCues();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "口播提示没有写成");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function openSpokenCues() {
    if (!requireSaved()) return;
    setOpenMenu(null);
    setCuesOpen(true);
    if (!cues) await spokenCues();
  }

  async function copyDraft() {
    if (!requireSaved()) return;
    try {
      await navigator.clipboard.writeText(savedCopy());
      setError("");
      setNotice("已复制");
    } catch {
      setError("复制失败，可以手动选择正文。");
    }
  }

  function exportMarkdown() {
    if (!requireSaved()) return;
    downloadText(`${fileStem(theme)}.md`, formatMarkdown(theme, { ...content, body }), "text/markdown;charset=utf-8");
    setError("");
    setNotice("已导出 Markdown");
  }

  function exportPdf() {
    if (!requireSaved()) return;
    const page = window.open("", "_blank", "noopener,noreferrer");
    if (!page) {
      setError("浏览器拦截了导出窗口，允许弹窗后再试。");
      return;
    }
    const title = escapeHtml(theme);
    page.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:"Songti SC","Source Han Serif SC","Noto Serif SC",serif;max-width:680px;margin:48px auto;color:#1c1917;line-height:1.85}h1{font-size:22px}pre{white-space:pre-wrap;font-family:inherit;font-size:15px}</style></head><body><h1>${title}</h1><pre>${escapeHtml(savedCopy())}</pre></body></html>`);
    page.document.close();
    page.focus();
    page.print();
    setError("");
    setNotice("在打印窗口里选择「另存为 PDF」。");
  }

  return (
    <div className="mt-6">
      <div ref={barRef} className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={`${secondaryButton} ${editing ? "border-ink bg-paper-deep" : ""}`} aria-pressed={editing} disabled={locked} onClick={toggleEditing}>
          {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          {editing ? "完成" : "编辑"}
        </button>
        <div className="relative">
          <button type="button" className={secondaryButton} aria-expanded={openMenu === "confirm"} aria-haspopup="menu" disabled={locked} onClick={() => setOpenMenu(openMenu === "confirm" ? null : "confirm")}>
            <Send className="h-3.5 w-3.5" />
            确认
            <ChevronDown className="h-3.5 w-3.5 text-muted" />
          </button>
          {openMenu === "confirm" ? (
            <div role="menu" className="absolute left-0 z-30 mt-2 min-w-44 rounded-lg border border-line bg-card py-1 shadow-lg">
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => void openSpokenCues()}>
                <Mic className="h-3.5 w-3.5 text-muted" />
                口播提示
              </button>
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => { setOpenMenu(null); openPlatforms(); }}>
                <Plus className="h-3.5 w-3.5 text-muted" />
                出多平台版本
              </button>
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => { setOpenMenu(null); void keepVoice(); }}>
                <Sparkles className="h-3.5 w-3.5 text-muted" />
                喂给帐号学习
              </button>
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => { setOpenMenu(null); void testReply(); }}>
                <MessageCircle className="h-3.5 w-3.5 text-muted" />
                测试回复
              </button>
            </div>
          ) : null}
        </div>
        <div className="relative">
          <button type="button" className={secondaryButton} aria-expanded={openMenu === "export"} aria-haspopup="menu" disabled={locked} onClick={() => setOpenMenu(openMenu === "export" ? null : "export")}>
            <Download className="h-3.5 w-3.5" />
            导出
            <ChevronDown className="h-3 w-3 text-muted" />
          </button>
          {openMenu === "export" ? (
            <div role="menu" className="absolute left-0 z-30 mt-2 min-w-44 rounded-lg border border-line bg-card py-1 shadow-lg">
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => { setOpenMenu(null); void copyDraft(); }}>
                <Copy className="h-3.5 w-3.5 text-muted" />
                复制
              </button>
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => { setOpenMenu(null); exportMarkdown(); }}>
                <FileText className="h-3.5 w-3.5 text-muted" />
                导出 Markdown
              </button>
              <button type="button" role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => { setOpenMenu(null); exportPdf(); }}>
                <FileText className="h-3.5 w-3.5 text-muted" />
                导出 PDF
              </button>
            </div>
          ) : null}
        </div>
        <span className="ml-auto text-xs text-muted">{countChars(editing ? draft : body)} 字</span>
      </div>
      {editing ? <p className="mt-2 text-xs leading-5 text-muted">选中一段会出改写，空行打 / 可以接着写。</p> : null}
      {editing && anchor && selection && selectedText.trim().length >= 4 && slash === null && proposal?.kind !== "insert"
        ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-40 max-w-[min(28rem,calc(100vw-1rem))] rounded-2xl border border-line bg-card p-1.5 shadow-lg"
          style={{
            top: anchor.top > 280 ? anchor.top - 8 : anchor.top + anchor.line + 8,
            left: anchor.left,
            transform: anchor.top > 280 ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          }}
          onMouseDown={(event) => event.preventDefault()}
        >
          {proposal?.kind === "rewrite" ? (
            <div className="max-h-52 overflow-auto px-2 py-1.5">
              <p className="text-xs text-muted">建议。确认后才写进正文。</p>
              <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{proposal.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded-md border border-ink bg-card px-3 py-1.5 text-sm text-ink disabled:opacity-50" disabled={locked} onClick={() => void apply()}>
                  用这版
                </button>
                <button type="button" className="rounded-full px-3 py-1.5 text-sm text-muted disabled:opacity-50" disabled={locked} onClick={() => setProposal(null)}>
                  留下原文
                </button>
              </div>
            </div>
          ) : busy === "assist" ? (
            <p className="px-3 py-1.5 text-sm text-muted">正在写这一段…</p>
          ) : (
            <div className="flex min-w-36 flex-col py-1">
              {REWRITE_ACTIONS.map((item) => (
                <button key={item.id} type="button" role="menuitem" className="rounded-xl px-3 py-2 text-left text-sm hover:bg-paper disabled:opacity-50" disabled={locked} onClick={() => rewrite(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      ) : null}
      {editing && slash !== null && !proposal ? (
        <div className="mt-3 rounded-2xl border border-line bg-paper px-3 py-3">
          <p className="text-xs text-muted">在这里接着写。确认后才进正文。</p>
          <input
            className="mt-2 w-full rounded-2xl border border-line bg-card px-3 py-2 text-sm outline-none focus:border-ink"
            value={instruction}
            placeholder="想写什么，也可以直接点下面的做法"
            maxLength={200}
            disabled={locked}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && instruction.trim().length >= 2) {
                event.preventDefault();
                insert("custom");
              }
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {INSERT_ACTIONS.map((item) => (
              <button key={item.id} type="button" className="rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:border-ink disabled:opacity-50" disabled={locked} onClick={() => insert(item.id)}>
                {item.label}
              </button>
            ))}
            <button type="button" className={secondaryButton} disabled={locked || instruction.trim().length < 2} onClick={() => insert("custom")}>
              按这句写
            </button>
            <button type="button" className="text-sm text-muted" disabled={locked} onClick={() => setSlash(null)}>
              取消
            </button>
          </div>
        </div>
      ) : null}
      {editing && proposal?.kind === "insert" ? (
        <div className="mt-3 rounded-2xl bg-paper px-4 py-3">
          <p className="text-xs text-muted">建议。确认后才写进正文。</p>
          <p className="mt-2 text-sm leading-7 whitespace-pre-wrap">{proposal.text}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className={secondaryButton} disabled={locked} onClick={() => void apply()}>
              用这版
            </button>
            <button type="button" className="text-sm text-muted" disabled={locked} onClick={() => setProposal(null)}>
              留下原文
            </button>
          </div>
        </div>
      ) : null}
      {busy === "assist" && !selection ? <p className="mt-3 text-sm text-muted">正在写这一段…</p> : null}
      {copyTitle(content) ? (
        <h3 className="mt-6 border-b-2 border-ink/25 pb-2.5 font-serif text-2xl font-bold leading-snug tracking-tight">
          <QuotedText text={copyTitle(content)} quote={pin?.where === "title" ? pin.quote : ""} markId={pin?.where === "title" ? "draft-pin" : undefined} />
        </h3>
      ) : null}
      {editing ? (
        <textarea
          ref={field}
          rows={1}
          value={draft}
          readOnly={locked || proposal !== null}
          onChange={(event) => {
            setDraft(event.target.value);
            setSelection(null);
            setError("");
          }}
          onMouseUp={(event: MouseEvent<HTMLTextAreaElement>) => {
            if (event.button !== 0) return;
            syncSelection();
          }}
          onKeyUp={syncSelection}
          onKeyDown={onKeyDown}
          className="mt-4 w-full resize-none overflow-hidden bg-transparent py-1 text-[15.5px] leading-[1.85] outline-none"
        />
      ) : (
        <ArticleBody text={body} quote={pin?.where === "body" ? pin.quote : ""} markId={pin?.where === "body" ? "draft-pin" : undefined} />
      )}
      {editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={primaryButton} disabled={locked || !dirty} onClick={() => void save()}>
            <Check className="h-3.5 w-3.5" />
            {busy === "save" ? "正在保存…" : "保存正文"}
          </button>
          {!dirty && busy !== "save" ? <span className="text-xs text-muted">正文已保存</span> : null}
        </div>
      ) : null}
      <SpokenCuesDialog
        open={cuesOpen}
        cues={cues}
        busy={busy === "cues"}
        onClose={() => setCuesOpen(false)}
        onGenerate={() => void spokenCues()}
        onCopy={(text) => {
          void navigator.clipboard.writeText(text).then(
            () => setNotice("口播稿已复制"),
            () => setError("复制失败，可以手动选择口播稿。"),
          );
        }}
      />
      {error ? <p className="mt-3 text-sm text-cinnabar-deep">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-moss">{notice}</p> : null}
    </div>
  );
}
