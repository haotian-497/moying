"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LlmNote } from "@/components/llm-note";
import { DraftEditor } from "@/components/draft-editor";
import { CopyReviewPanel } from "@/components/copy-review-panel";
import { ArticleBody } from "@/components/article-body";
import { QuotedText } from "@/components/quoted-text";
import { Banner, primaryButton, secondaryButton } from "@/components/ui";
import { Stepper } from "@/components/stepper";
import { api, readSse } from "@/lib/client";
import { countChars, formatCopy } from "@/lib/format";
import { hotspotLimitNote } from "@/lib/hotspot-limit";
import { quoteAnchor } from "@/lib/quote-anchor";
import { ArrowLeft, ArrowRight, Check, Copy, FileText, Flame, Lightbulb, ListTree, Quote, RefreshCw } from "lucide-react";
import { copyTitle, formatAge, PLATFORMS, PUBLISH_PLATFORMS, platformLabel, type AssistRequest, type CopyContent, type CopyIssueWhere, type Direction, type LlmStatus, type Platform, type Work } from "@/lib/types";

const TRAIT_RULES: [RegExp, string][] = [
  [/亲身|踩坑|个人经历|经历/, "亲身经历"],
  [/步骤|做法|方法|清单|可执行/, "步骤清单"],
  [/观点|反差|误区|犀利/, "观点反差"],
];

function directionTrait(item: Direction, taken: Set<string>) {
  const stored = (item.label || "").replace(/\s+/g, "");
  if ([...stored].length === 4 && !taken.has(stored)) {
    taken.add(stored);
    return stored;
  }
  const head = item.angle.slice(0, 28);
  for (const [pattern, name] of TRAIT_RULES) {
    if (pattern.test(head) && !taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  const spare = ["亲身经历", "步骤清单", "观点反差"].find((name) => !taken.has(name)) ?? "写法特点";
  taken.add(spare);
  return spare;
}

export function Workbench({
  id,
  username,
  guest,
  llm,
  embedded = false,
  step: stepProp,
  onDrafted,
}: {
  id: string;
  username: string;
  guest: boolean;
  llm: LlmStatus;
  embedded?: boolean;
  step?: "topic" | "direction" | "draft";
  onDrafted?: () => void;
}) {
  const [work, setWork] = useState<Work | null>(null);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<null | "directions" | "content" | "variants" | "review">(null);
  const [streamDraft, setStreamDraft] = useState<{ title: string; coverText: string; body: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [extras, setExtras] = useState<Platform[]>([]);
  const [platformsOpen, setPlatformsOpen] = useState(false);
  const [pin, setPin] = useState<{ where: CopyIssueWhere; quote: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!pin) return;
    document.getElementById("draft-pin")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pin]);

  function locateIn(content: CopyContent, quote: string) {
    const place = quoteAnchor(content, quote);
    if (!place) return;
    setPin({ ...place, nonce: Date.now() });
  }

  const pathname = usePathname();
  const router = useRouter();
  const step = stepProp ?? (pathname.endsWith("/draft") ? "draft" : pathname.endsWith("/topic") ? "topic" : "direction");

  useEffect(() => {
    let cancelled = false;
    api<{ work: Work }>(`/api/works/${id}`)
      .then((data) => {
        if (cancelled) return;
        setWork(data.work);
        setSelected(data.work.selectedIndex ?? 0);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function refreshDirections() {
    if (!work) return;
    if (work.content && !window.confirm("换三个方向会清掉已经生成的成稿，以及其他平台的文案。继续吗？")) return;
    setPending("directions");
    setWork({ ...work, error: null });
    try {
      const data = await api<{ work: Work }>(`/api/works/${id}/directions`, { method: "POST" });
      setWork(data.work);
      setSelected(0);
    } catch (error) {
      setWork((current) => (current ? { ...current, error: error instanceof Error ? error.message : "生成失败" } : current));
    } finally {
      setPending(null);
    }
  }

  async function writeContent(index: number) {
    if (!work?.directions) return;
    setSelected(index);
    setPending("content");
    setStreamDraft({ title: "", coverText: "", body: "" });
    setWork({ ...work, error: null, selectedIndex: index });
    if (onDrafted) onDrafted();
    else router.push(`/works/${id}/draft`);
    window.setTimeout(() => {
      document.getElementById("draft")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    try {
      let response: Response;
      try {
        response = await fetch(`/api/works/${id}/content`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ index }),
        });
      } catch {
        throw new Error("网络异常，请再试一次");
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "生成失败");
      }
      let finished: Work | null = null;
      await readSse(response, (event, raw) => {
        const data = raw as { text?: string; body?: string; title?: string; coverText?: string; work?: Work; message?: string };
        if (event === "delta") {
          setStreamDraft((current) => ({
            title: data.title || current?.title || "",
            coverText: data.coverText || current?.coverText || "",
            body: data.body || current?.body || "",
          }));
        } else if (event === "reviewing" && data.work) {
          setWork(data.work);
          setSelected(data.work.selectedIndex ?? index);
          setStreamDraft(null);
          setPending("review");
        } else if (event === "done" && data.work) {
          finished = data.work;
          setWork(data.work);
          setSelected(data.work.selectedIndex ?? index);
          setStreamDraft(null);
        } else if (event === "error") {
          throw new Error(data.message || "生成失败");
        }
      });
      if (!finished) throw new Error("生成中断，请再试一次");
    } catch (error) {
      setStreamDraft(null);
      setWork((current) => (current ? { ...current, error: error instanceof Error ? error.message : "生成失败" } : current));
    } finally {
      setPending(null);
    }
  }

  async function writeOtherPlatforms() {
    if (!work?.content) return;
    setPending("variants");
    setWork({ ...work, error: null });
    try {
      const data = await api<{ work: Work }>(`/api/works/${id}/variants`, {
        method: "POST",
        body: JSON.stringify({ index: selected, platforms: extras }),
      });
      setWork(data.work);
      window.setTimeout(() => {
        document.getElementById("variants")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (error) {
      setWork((current) => (current ? { ...current, error: error instanceof Error ? error.message : "生成失败" } : current));
    } finally {
      setPending(null);
    }
  }

  async function saveBody(body: string) {
    const data = await api<{ work: Work }>(`/api/works/${id}/body`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    setWork(data.work);
  }

  async function assist(request: AssistRequest) {
    const data = await api<{ text: string }>(`/api/works/${id}/assist`, {
      method: "POST",
      body: JSON.stringify(request),
    });
    return data.text;
  }

  function openPlatforms() {
    if (!work?.content || work.selectedIndex !== selected) {
      throw new Error("先回到已经写成稿的那个方向，再出多平台版本");
    }
    setPlatformsOpen(true);
    window.setTimeout(() => {
      document.getElementById("variants")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function reviewDraft() {
    setPending("review");
    window.setTimeout(() => {
      document.getElementById("copy-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    try {
      const data = await api<{ work: Work }>(`/api/works/${id}/review`, { method: "POST" });
      setWork(data.work);
      window.setTimeout(() => {
        document.getElementById("copy-review")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } finally {
      setPending(null);
    }
  }

  async function applyAllReview() {
    setPending("review");
    try {
      const data = await api<{ work: Work }>(`/api/works/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action: "apply-all" }),
      });
      setWork(data.work);
    } catch (error) {
      setWork((current) => (current ? { ...current, error: error instanceof Error ? error.message : "没有保存这次处理" } : current));
    } finally {
      setPending(null);
    }
  }

  async function settleReview(index: number, action: "apply" | "dismiss") {
    setPending("review");
    try {
      const data = await api<{ work: Work }>(`/api/works/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, index }),
      });
      setWork(data.work);
    } catch (error) {
      setWork((current) => (current ? { ...current, error: error instanceof Error ? error.message : "没有保存这次处理" } : current));
    } finally {
      setPending(null);
    }
  }

  async function spokenCues() {
    const data = await api<{ work: Work }>(`/api/works/${id}/cues`, { method: "POST" });
    setWork(data.work);
  }

  async function keepVoice(text: string) {
    if (!work?.accountId) throw new Error("这篇没有对应的账号设定");
    await api(`/api/accounts/${work.accountId}/samples`, {
      method: "POST",
      body: JSON.stringify({ text, source: "draft" }),
    });
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("fail");
    }
  }

  const frame = embedded ? "block" : "mx-auto max-w-6xl px-5 py-8";

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      {embedded ? null : <AppHeader username={username} guest={guest} />}
      <div className={frame}>
        {embedded ? null : (
          <Link href="/" className="text-sm text-muted hover:text-ink">
            ← 返回稿库
          </Link>
        )}
        {embedded ? null : (
          <div className="mt-5">
            <LlmNote llm={llm} />
          </div>
        )}
        {loading ? <p className="mt-8 text-sm text-muted">正在打开这篇稿…</p> : null}
        {loadError ? (
          <div className="mt-8">
            <Banner tone="bad">{loadError}</Banner>
          </div>
        ) : null}
        {work ? (
          <div className="mt-5">
            {step === "direction" ? null : (
              <>
                <p className="text-xs tracking-wide text-muted">
                  {platformLabel(work.platform)} · {work.style}
                  {work.audience ? ` · 写给 ${work.audience}` : ""}
                </p>
                <h1 className="mt-2 text-3xl leading-snug break-words">{work.theme}</h1>
              </>
            )}

            {embedded ? null : (
              <div className="mt-5 flex justify-center rounded-lg border border-line bg-card px-4 py-3">
                <Stepper
                  current={step}
                  onStep={(page) => {
                    router.push(`/works/${id}/${page}`);
                  }}
                />
              </div>
            )}

            {work.error ? (
              <div className="mt-5">
                <Banner tone="bad">{work.error}</Banner>
              </div>
            ) : null}

            <div className={step === "topic" ? "mt-6 animate-fade-in" : "hidden"} role="tabpanel">
              <div className="rounded-lg border border-line bg-card px-5 py-5 shadow-sm">
                <h2 className="text-xl font-semibold tracking-tight">选题材</h2>
                <p className="mt-3 text-sm leading-6">
                  {platformLabel(work.platform)} · {work.style}
                  {work.audience ? ` · 写给 ${work.audience}` : ""}
                </p>
                <p className="mt-3 text-2xl leading-snug">{work.theme}</p>
                {work.hotspot?.title ? (
                  <p className="mt-2 text-sm leading-6 text-muted">
                    借势热点：{work.hotspot.title}
                    {work.hotspot.summary.trim() ? `。概要：${work.hotspot.summary}` : ""}
                    。{hotspotLimitNote(work.hotspot)}
                  </p>
                ) : null}
                {work.occupation ? (
                  <p className="mt-3 text-sm leading-6">
                    作者：{formatAge(work.age)} · {work.occupation} · {work.industry}
                    {work.personality ? ` · ${work.personality}` : ""}
                  </p>
                ) : null}
                {work.accountName ? <p className="mt-1 text-sm leading-6">账号：{work.accountName}</p> : null}
                {work.persona ? <p className="mt-1 text-sm leading-6">主要内容：{work.persona}</p> : null}
                {work.problem ? <p className="mt-1 text-sm leading-6 text-muted">要解决：{work.problem}</p> : null}
                {work.profileNotes ? <p className="mt-1 text-sm leading-6 text-muted">账号备注：{work.profileNotes}</p> : null}
                {work.section?.name ? <p className="mt-1 text-sm leading-6 text-muted">栏目：{work.section.name}</p> : null}
                {work.notes ? <p className="mt-1 text-sm leading-6 text-muted">这篇补充：{work.notes}</p> : null}
              </div>
            </div>

            <div className={step === "direction" ? "animate-fade-in" : "hidden"} role="tabpanel">
            <div className={`${embedded ? "" : "mt-4"} flex flex-wrap items-end justify-between gap-3`}>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">三个方向</h2>
                <p className="mt-1 text-sm text-muted">由 AI 生成的三个写作角度，选一个开始成稿</p>
              </div>
              <button type="button" className={secondaryButton} onClick={refreshDirections} disabled={pending !== null}>
                <RefreshCw className={`h-3.5 w-3.5 ${pending === "directions" ? "animate-spin" : ""}`} />
                {pending === "directions" ? "正在重出…" : work.directions ? "换三个方向" : "重新生成方向"}
              </button>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-cinnabar/25 bg-cinnabar-soft/80 px-3 py-2">
              <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cinnabar" />
              <p className="min-w-0 text-xs leading-5 text-cinnabar-deep">
                {work.hotspot?.title ? (
                  <>
                    借势热点：「{work.hotspot.title}」
                    {work.hotspot.summary.trim() ? ` ${work.hotspot.summary}` : ""}
                  </>
                ) : (
                  <>话题主旨：「{work.theme}」</>
                )}
              </p>
            </div>

            {work.directions ? (
              <div className="mt-3 flex w-full min-w-0 flex-col gap-4">
                {(() => {
                  const directions = work.directions ?? [];
                  const taken = new Set<string>();
                  return directions.map((item, index) => {
                  const on = selected === index;
                  const writing = pending === "content" && on;
                  const trait = directionTrait(item, taken);
                  return (
                  <div
                    key={item.title}
                    aria-pressed={on}
                    onClick={() => pending === null && setSelected(index)}
                    className={`w-full min-w-0 overflow-hidden rounded-lg border bg-card text-left transition duration-300 ${
                      on ? "border-blue/50 bg-blue-soft/40 shadow-md ring-2 ring-blue/20" : "border-line hover:border-ink/15 hover:shadow-md"
                    } ${pending !== null ? "opacity-60" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper/60 px-5 py-3">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-bold text-white">{index + 1}</span>
                      <span className="rounded-md border border-blue/20 bg-blue-soft px-2 py-0.5 text-[10px] font-semibold text-blue">{trait}</span>
                      <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight break-words">{item.title}</h3>
                      {on ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue px-2 py-0.5 text-[10px] font-medium text-white">
                          <Check className="h-2.5 w-2.5" />
                          已选中
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-4 border-line p-5 lg:border-r">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted uppercase">
                            <Quote className="h-3 w-3" />
                            切入 / 钩子
                          </div>
                          <p className="rounded-md bg-paper-deep/80 px-3 py-2.5 text-xs leading-relaxed text-muted italic break-words">
                            “{item.hook || item.angle}”
                          </p>
                          {item.angle && item.hook ? <p className="text-xs leading-relaxed text-muted break-words">{item.angle}</p> : null}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted uppercase">
                            <Lightbulb className="h-3 w-3" />
                            为什么选这个角度
                          </div>
                          <p className="text-xs leading-relaxed text-muted break-words">{item.why}</p>
                        </div>
                        <button
                          type="button"
                          className={`${on ? primaryButton : secondaryButton} w-fit`}
                          disabled={pending !== null}
                          onClick={(event) => {
                            event.stopPropagation();
                            void writeContent(index);
                          }}
                        >
                          {writing ? (
                            "正在写…"
                          ) : on ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              已选中此方向
                            </>
                          ) : (
                            <>
                              用这个方向写
                              <ArrowRight className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                        {writing ? (
                          <span className="text-sm text-muted">
                            {llm.mode === "live" ? `正在按「${item.title}」调用模型，通常要二十秒左右。` : "正在按这个方向整理成稿。"}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 space-y-1.5 bg-paper/40 p-5">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-muted uppercase">
                          <ListTree className="h-3 w-3" />
                          要点列表
                        </div>
                        <ul className="space-y-2 pt-1">
                          {item.outline.map((point, pointIndex) => (
                            <li key={point} className="flex items-start gap-2.5 text-xs leading-relaxed">
                              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-card text-[10px] font-semibold text-muted shadow-sm">
                                {pointIndex + 1}
                              </span>
                              <span className="text-ink/80 break-words">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  );
                  });
                })()}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">这次没有生成出方向，可以再试一次。</p>
            )}
            </div>

            <div className={step === "draft" ? "" : "hidden"} role="tabpanel">
            {platformsOpen && work.content && work.selectedIndex === selected ? (
              <section id="variants" className="mt-6 scroll-mt-24 rounded-lg border border-line bg-card px-5 py-6 shadow-sm sm:px-8">
                <h2 className="text-xl font-semibold tracking-tight">其他平台</h2>
                <p className="mt-1 text-sm leading-6 text-muted">可选。按现在这个方向，再写成其他平台能发的版本。不选就只保留下面这一篇。</p>
                {work.variantsStale && work.variants && work.variants.length > 0 ? (
                  <p className="mt-3 text-sm leading-6 text-cinnabar-deep">正文改过，其他平台还是改之前的版本。可以按这个方向再写一版。</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {PLATFORMS.filter((item) => (PUBLISH_PLATFORMS as readonly string[]).includes(item.id) && item.id !== work.platform).map((item) => {
                    const on = extras.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={on}
                        disabled={pending !== null}
                        onClick={() => setExtras((current) => (current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]))}
                        className={`rounded-sm border px-3 py-1.5 text-sm tracking-wide ${on ? "border-blue bg-blue text-white" : "border-line bg-card text-muted"}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <button type="button" className={secondaryButton} onClick={writeOtherPlatforms} disabled={pending !== null || extras.length === 0}>
                    {pending === "variants" ? "正在写其他平台…" : "按这个方向写所选平台"}
                  </button>
                </div>
                {pending === "variants" ? (
                  <p className="mt-3 text-sm text-muted">
                    {llm.mode === "live" ? "每个平台单独写一版，选得越多越久。" : "正在按所选平台整理文案。"}
                  </p>
                ) : null}
                {work.variants && work.variants.length > 0 ? (
                  <div className="mt-6 space-y-6">
                    {work.variants.map((item) => (
                      <VariantDraft key={item.platform} platform={item.platform} content={item.content} copied={copied} onCopy={copyText} />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {streamDraft || work.content ? (
              <article id="draft" className="mt-6 scroll-mt-24 rounded-lg border border-line bg-card px-5 py-6 shadow-sm sm:px-8">
                <h2 className="text-xl font-semibold tracking-tight">成稿</h2>
                {work.directions?.[selected] ? (
                  <p className="mt-2 text-sm text-muted">对应方向：{work.directions[selected].title}</p>
                ) : null}
                {streamDraft && pending === "content" ? (
                  <>
                    {streamDraft.title ? (
                      <h3 className="mt-6 border-b-2 border-ink/25 pb-2.5 font-serif text-2xl font-bold leading-snug tracking-tight">{streamDraft.title}</h3>
                    ) : null}
                    {streamDraft.body ? <ArticleBody text={streamDraft.body} /> : <p className="mt-6 text-sm text-muted">正在起笔…</p>}
                    <p className="mt-4 text-sm text-muted">
                      {countChars(streamDraft.body)} 字 · 生成中
                      <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-ink align-middle" />
                    </p>
                  </>
                ) : work.content ? (
                  <>
                    <CopyReviewPanel review={work.content.review} pending={pending === "review"} onSettle={settleReview} onApplyAll={applyAllReview} onLocate={(quote) => locateIn(work.content!, quote)} />
                    <DraftEditor
                      body={work.content.body}
                      content={work.content}
                      theme={work.theme}
                      disabled={pending !== null}
                      accountId={work.accountId}
                      onSave={saveBody}
                      onAssist={assist}
                      onKeepVoice={keepVoice}
                      onOpenPlatforms={openPlatforms}
                      onSpokenCues={spokenCues}
                      onReview={reviewDraft}
                      cues={work.cues}
                      pin={pin}
                    />
                    <PublishExtras content={work.content} pin={pin} />
                  </>
                ) : null}
                {copied === "fail" ? <p className="mt-3 text-sm text-cinnabar-deep">复制失败，可以手动选择正文。</p> : null}
              </article>
            ) : (
              <div className="mt-8 flex flex-col items-center rounded-lg border-2 border-dashed border-line bg-paper/40 px-5 py-16 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-dashed border-line bg-card">
                  <FileText className="h-7 w-7 text-muted/40" />
                </span>
                <p className="mt-4 text-base font-semibold">尚无成稿</p>
                <p className="mt-1 text-sm leading-6 text-muted">还没有成稿。先回到选方向，生成完整内容。已经有的方向会留着。</p>
                <Link href={`/works/${id}/direction`} className={`${secondaryButton} mt-4`}>
                  <ArrowLeft className="h-4 w-4" />
                  去选方向
                </Link>
              </div>
            )}
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}

function PublishExtras({
  content,
  pin,
  markId = "draft-pin",
}: {
  content: CopyContent;
  pin?: { where: CopyIssueWhere; quote: string } | null;
  markId?: string;
}) {
  const tags = content.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  const cover = content.coverText.trim();
  const cta = content.cta.trim();
  const notes = content.publishNotes?.trim() ?? "";
  if (!cover && !cta && !tags && !notes) return null;
  return (
    <div className="mt-8 space-y-3 rounded-lg border border-line bg-paper px-4 py-4">
      <p className="text-xs font-medium text-muted">发布素材</p>
      {cover ? (
        <p className="text-sm leading-6">
          <span className="text-muted">封面大字 · </span>
          <QuotedText text={content.coverText} quote={pin?.where === "cover" ? pin.quote : ""} markId={pin?.where === "cover" ? markId : undefined} />
        </p>
      ) : null}
      {cta ? (
        <p className="text-sm leading-6">
          <span className="text-muted">结尾互动 · </span>
          <QuotedText text={content.cta} quote={pin?.where === "cta" ? pin.quote : ""} markId={pin?.where === "cta" ? markId : undefined} />
        </p>
      ) : null}
      {tags ? (
        <p className="text-sm leading-6 text-moss">
          <span className="text-muted">标签 · </span>
          <QuotedText
            text={tags}
            quote={pin?.where === "hashtag" ? hashtagQuote(content.hashtags, pin.quote) : ""}
            markId={pin?.where === "hashtag" ? markId : undefined}
          />
        </p>
      ) : null}
      {notes ? <p className="text-sm leading-6 text-muted">发布备注 · {notes}</p> : null}
    </div>
  );
}

function hashtagQuote(tags: string[], quote: string) {
  const shown = tags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  if (shown.includes(quote)) return quote;
  const marked = quote
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part.startsWith("#") ? part : `#${part}`))
    .join(" ");
  return shown.includes(marked) ? marked : quote;
}

function VariantDraft({
  platform,
  content,
  copied,
  onCopy,
}: {
  platform: Platform;
  content: CopyContent;
  copied: string;
  onCopy: (text: string, key: string) => void;
}) {
  const copyKey = `variant-${platform}`;
  const [pin, setPin] = useState<{ where: CopyIssueWhere; quote: string; nonce: number } | null>(null);
  const markId = `draft-pin-${platform}`;
  useEffect(() => {
    if (!pin) return;
    document.getElementById(markId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pin, markId]);
  return (
    <article className="rounded-lg border border-line bg-card px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight">{platformLabel(platform)}</h3>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">{countChars(content.body)} 字</span>
          <button type="button" className={secondaryButton} onClick={() => onCopy(formatCopy(content), copyKey)}>
            <Copy className="h-3.5 w-3.5" />
            {copied === copyKey ? "已复制" : "复制全文"}
          </button>
        </div>
      </div>
      <h4 className="mt-6 border-b-2 border-ink/25 pb-2.5 font-serif text-2xl font-bold leading-snug tracking-tight">
        <QuotedText text={copyTitle(content)} quote={pin?.where === "title" ? pin.quote : ""} markId={pin?.where === "title" ? markId : undefined} />
      </h4>
      <ArticleBody text={content.body} quote={pin?.where === "body" ? pin.quote : ""} markId={pin?.where === "body" ? markId : undefined} />
      <PublishExtras content={content} pin={pin} markId={markId} />
      <CopyReviewPanel
        review={content.review}
        pending={false}
        anchor=""
        onLocate={(quote) => {
          const place = quoteAnchor(content, quote);
          if (place) setPin({ ...place, nonce: Date.now() });
        }}
      />
    </article>
  );
}
