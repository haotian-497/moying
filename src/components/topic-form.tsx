"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, CheckCircle2, Flame, PenTool, Settings2, Sparkles, TrendingUp, Zap } from "lucide-react";
import { fieldClass, ghostButton, primaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import { defaultTargetLength } from "@/lib/eval-score";
import { hotspotLimitNote } from "@/lib/hotspot-limit";
import { recommendTopics } from "@/lib/recommend";
import { TopicPool } from "@/components/topic-pool";
import { HOT_SOURCE_LABEL, HOT_TOPIC_LABEL, PLATFORMS, PUBLISH_PLATFORMS, STYLES, isMediaReady, isPersonalReady, isPublishPlatform, sameTopic, type AccountIdea, type ContentSection, type HotMatch, type HotTopic, type LlmStatus, type MediaAccount, type PersonalProfile, type Platform, type Work, type WorkHotspot } from "@/lib/types";

const ideaLoads = new Map<number, Promise<AccountIdea[]>>();

function loadIdeas(accountId: number) {
  const pending = ideaLoads.get(accountId);
  if (pending) return pending;
  const job = api<{ ideas: AccountIdea[] }>(`/api/accounts/${accountId}/ideas`).then((data) => {
    if (data.ideas.length > 0) return data.ideas;
    return api<{ ideas: AccountIdea[] }>(`/api/accounts/${accountId}/ideas`, { method: "POST" }).then((next) => next.ideas);
  });
  ideaLoads.set(accountId, job);
  job.finally(() => ideaLoads.delete(accountId));
  return job;
}

function formatHeat(heat: number) {
  if (heat < 10000) return String(heat);
  const wan = heat / 10000;
  const text = wan >= 100 ? String(Math.round(wan)) : wan.toFixed(1).replace(/\.0$/, "");
  return `${text} 万`;
}

function MenuField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.id === value);
  return (
    <div className="relative">
      <span className="mb-1.5 block text-sm">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((item) => !item)}
        className="flex w-full items-center justify-between rounded-md border border-line bg-card px-3 py-2.5 text-left text-sm shadow-sm disabled:opacity-50"
      >
        <span>{current?.label || "请选择"}</span>
        <span className="text-xs text-muted">{open ? "收起" : "展开"}</span>
      </button>
      {open ? (
        <div role="menu" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-line bg-card py-1 shadow-lg">
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(item.id);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-sm ${item.id === value ? "bg-blue-soft text-blue" : "hover:bg-paper"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TopicForm({
  llm,
  personal,
  accounts,
  accountId,
  onCreated,
  themeFromHot,
  themePick,
  hotspotFromHot,
  onPlatformChange,
  onAccountSaved,
  topics,
  matches,
  poolSignal = 0,
}: {
  llm: LlmStatus;
  personal: PersonalProfile;
  accounts: MediaAccount[];
  accountId: number | null;
  onCreated: (work: Work) => void;
  themeFromHot: string;
  themePick: number;
  hotspotFromHot: WorkHotspot | null;
  onPlatformChange: (platform: Platform) => void;
  onAccountSaved: (account: MediaAccount) => void;
  topics: HotTopic[];
  matches: HotMatch[];
  poolSignal?: number;
}) {
  const personalReady = isPersonalReady(personal);
  const selected = accounts.find((item) => item.id === accountId) ?? accounts[0] ?? null;
  const startingPlatform = selected && isPublishPlatform(selected.platform) ? selected.platform : "wechat";
  const [formError, setFormError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState("");
  const [platform, setPlatform] = useState<Platform>(startingPlatform);
  const [style, setStyle] = useState<string>((STYLES as readonly string[]).includes(selected?.style ?? "") ? (selected?.style ?? STYLES[0]) : STYLES[0]);
  const [length, setLength] = useState(selected?.length.trim() || defaultTargetLength(startingPlatform));
  const [reader, setReader] = useState(selected?.reader || "");
  const [notes, setNotes] = useState("");
  const [hotspot, setHotspot] = useState<WorkHotspot | null>(null);
  const [ideas, setIdeas] = useState<AccountIdea[]>([]);
  const [ideaError, setIdeaError] = useState("");
  const [refreshingIdeas, setRefreshingIdeas] = useState(false);
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [poolTick, setPoolTick] = useState(0);
  const [poolNote, setPoolNote] = useState("");
  const ready = personalReady && Boolean(selected && isMediaReady(selected));
  const recommended = recommendTopics(topics, ideas);
  const chosenSection = sections.find((section) => section.id === sectionId) ?? null;
  const publishOptions = PUBLISH_PLATFORMS.map((id) => PLATFORMS.find((item) => item.id === id)).filter((item) => item != null);

  useEffect(() => {
    if (!selected) return;
    const nextPlatform = isPublishPlatform(selected.platform) ? selected.platform : "wechat";
    setPlatform(nextPlatform);
    setStyle((STYLES as readonly string[]).includes(selected.style) ? selected.style : STYLES[0]);
    setLength(selected.length.trim() || defaultTargetLength(nextPlatform));
    setReader(selected.reader || "");
    setSavedNote("");
  }, [selected?.id]);

  useEffect(() => {
    if (themePick > 0) {
      setTheme(themeFromHot);
      setHotspot(hotspotFromHot);
    }
  }, [themeFromHot, themePick, hotspotFromHot]);

  useEffect(() => {
    onPlatformChange(platform);
  }, [platform, onPlatformChange]);

  useEffect(() => {
    if (!selected) {
      setIdeas([]);
      setSections([]);
      setSectionId(null);
      setInputs({});
      return;
    }
    let cancelled = false;
    setSectionId(null);
    setInputs({});
    loadIdeas(selected.id)
      .then((next) => {
        if (!cancelled) setIdeas(next);
      })
      .catch((error: unknown) => {
        if (!cancelled) setIdeaError(error instanceof Error ? error.message : "常规题没有准备好");
      });
    api<{ sections: ContentSection[] }>(`/api/accounts/${selected.id}/sections`)
      .then((data) => {
        if (!cancelled) setSections(data.sections);
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  async function keepTopic(topic: HotTopic, match?: HotMatch) {
    if (!selected) return;
    setPoolNote("");
    setIdeaError("");
    try {
      await api(`/api/accounts/${selected.id}/pool`, {
        method: "POST",
        body: JSON.stringify({
          subject: topic.title,
          note: topic.why,
          source: topic.kind === "regular" ? "推荐" : "热点",
          hotspot: topic.basedOn ? { title: match?.title || topic.basedOn, summary: match?.summary || "" } : null,
        }),
      });
      setPoolTick((current) => current + 1);
      setPoolNote("已存进选题池");
    } catch (error) {
      setIdeaError(error instanceof Error ? error.message : "没有存进选题池");
    }
  }

  async function refreshIdeas() {
    if (!selected || refreshingIdeas) return;
    setRefreshingIdeas(true);
    setIdeaError("");
    try {
      const data = await api<{ ideas: AccountIdea[] }>(`/api/accounts/${selected.id}/ideas`, { method: "POST" });
      setIdeas(data.ideas);
    } catch (error) {
      setIdeaError(error instanceof Error ? error.message : "没有换出新的常规题");
    } finally {
      setRefreshingIdeas(false);
    }
  }

  async function saveWriting() {
    if (!selected) return;
    setFormError("");
    setSavedNote("");
    setSaving(true);
    try {
      const data = await api<{ account: MediaAccount }>(`/api/accounts/${selected.id}/writing`, {
        method: "PUT",
        body: JSON.stringify({ platform, style, length, reader }),
      });
      onAccountSaved(data.account);
      setSavedNote("已保存。之后用这个账号写，会沿用这些设定。");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setPending(true);
    try {
      const targetLength = length.trim() || defaultTargetLength(platform);
      const data = await api<{ work: Work }>("/api/works", {
        method: "POST",
        body: JSON.stringify({ theme, platform, style, notes, length: targetLength, reader, accountId: selected?.id, hotspot, sectionId, inputs }),
      });
      onCreated(data.work);
      setPending(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "生成失败");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="animate-fade-in rounded-lg border border-line bg-card p-5 shadow-sm sm:p-6">
          {!personalReady ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              先填写左边的个人资料。{" "}
              <Link href="/persona" className="font-medium underline">
                去填写
              </Link>
            </div>
          ) : null}
          {!selected ? (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              先在左边选一个账号。还没有的话，{" "}
              <Link href="/settings" className="font-medium underline">
                去添加
              </Link>
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1.5 flex items-center justify-between">
              <span>题材</span>
              <span className="text-xs text-muted">{theme.trim().length}/300</span>
            </span>
            <textarea
              className={`${fieldClass} min-h-28 resize-y`}
              value={theme}
              onChange={(event) => {
                setTheme(event.target.value);
                setHotspot(null);
              }}
              placeholder="例如：秋天通勤穿搭，预算 500 以内。也可以从热点里点一个话题。"
              maxLength={300}
              required
              disabled={pending || !ready}
            />
          </label>
          <TopicPool
            accountId={selected?.id ?? null}
            refreshKey={poolTick + poolSignal}
            onChange={() => setPoolTick((current) => current + 1)}
            onUse={(subject, saved) => {
              setTheme(subject);
              setHotspot(saved);
            }}
          />
          {poolNote ? <p className="mt-2 text-xs text-muted">{poolNote}</p> : null}
          {hotspot?.title ? (
            <div className="mt-3 flex gap-2 rounded-lg border border-cinnabar/25 bg-cinnabar-soft/70 px-3 py-2.5">
              <Flame className="mt-0.5 h-4 w-4 shrink-0 text-cinnabar" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-cinnabar-deep">借势热点</p>
                <p className="mt-0.5 text-sm font-medium text-cinnabar-deep">{hotspot.title}</p>
                <p className="mt-1 text-xs leading-5 text-cinnabar-deep/80">
                  {hotspot.summary.trim() ? `${hotspot.summary}。` : ""}
                  {hotspotLimitNote(hotspot)}
                </p>
              </div>
            </div>
          ) : null}

          {recommended.length > 0 ? (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">三个推荐题材</h3>
                <button type="button" className={ghostButton} disabled={refreshingIdeas || !ready} onClick={() => void refreshIdeas()}>
                  <Sparkles className={`h-3 w-3 ${refreshingIdeas ? "animate-pulse" : ""}`} />
                  {refreshingIdeas ? "正在换…" : "刷新推荐"}
                </button>
              </div>
              <p className="text-xs text-muted">
                {recommended.some((item) => item.kind !== "regular")
                  ? "两条来自今天的热榜，一条是这个号本来就能写的"
                  : "这个号本来就能写的，不借今天的热点"}
              </p>
              <div className="space-y-2" role="listbox" aria-label="三个推荐题材">
                {recommended.map((topic) => {
                  const match = matches.find((item) => sameTopic(item.title, topic.basedOn));
                  const picked = theme.trim() === topic.title;
                  const isHot = topic.kind !== "regular";
                  return (
                    <div
                      key={`${topic.kind}-${topic.title}`}
                      role="option"
                      aria-selected={picked}
                      tabIndex={0}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition ${
                        picked ? "border-cinnabar/40 bg-cinnabar-soft shadow-sm" : "border-line bg-card hover:border-ink/15 hover:shadow-sm"
                      }`}
                      onClick={() => {
                        setTheme(topic.title);
                        setHotspot(topic.basedOn ? { title: match?.title || topic.basedOn, summary: match?.summary || "" } : null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setTheme(topic.title);
                        setHotspot(topic.basedOn ? { title: match?.title || topic.basedOn, summary: match?.summary || "" } : null);
                      }}
                    >
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${isHot ? "bg-cinnabar-soft text-cinnabar" : "bg-blue-soft text-blue"}`}>
                        {isHot ? <Flame className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium leading-6">{topic.title}</span>
                          <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${isHot ? "border-cinnabar/25 bg-cinnabar-soft text-cinnabar-deep" : "border-blue/20 bg-blue-soft text-blue"}`}>
                            {HOT_TOPIC_LABEL[topic.kind]}
                          </span>
                          {picked ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-cinnabar/25 bg-card px-1.5 py-0.5 text-[9px] font-medium text-cinnabar-deep">
                              <CheckCircle2 className="h-3 w-3" />
                              已选
                            </span>
                          ) : null}
                        </div>
                        {topic.basedOn ? <p className="truncate text-xs leading-5 text-cinnabar-deep">热点 · {topic.basedOn}</p> : null}
                        <p className="text-xs leading-5 text-muted">{topic.why}</p>
                        {match ? (
                          <p className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] text-muted">
                            <span>{HOT_SOURCE_LABEL[match.source]} · 第 {match.rank} 名</span>
                            {typeof match.heat === "number" ? (
                              <span className="inline-flex items-center gap-1 text-cinnabar-deep">
                                <Zap className="h-2.5 w-2.5" />
                                热度 {formatHeat(match.heat)}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`${ghostButton} h-6 shrink-0 px-2 ${picked ? "text-cinnabar-deep" : ""}`}
                        title="存进选题池，以后再写"
                        onClick={(event) => {
                          event.stopPropagation();
                          void keepTopic(topic, match);
                        }}
                      >
                        {poolNote && picked ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                        存入池
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {ideaError ? <p className="mt-2 text-sm text-cinnabar-deep">{ideaError}</p> : null}
          {sections.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm">内容栏目，可选</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-md border px-3 py-1.5 text-xs transition ${sectionId === null ? "border-ink bg-ink text-white" : "border-line hover:bg-paper"}`}
                  onClick={() => {
                    setSectionId(null);
                    setInputs({});
                  }}
                >
                  不选栏目
                </button>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={`rounded-md border px-3 py-1.5 text-xs transition ${sectionId === section.id ? "border-ink bg-ink text-white" : "border-line hover:bg-paper"}`}
                    onClick={() => {
                      setSectionId(section.id);
                      setInputs({});
                    }}
                  >
                    {section.name}
                  </button>
                ))}
              </div>
              {chosenSection?.fields.map((field) => (
                <label key={field.label} className="mt-3 block text-sm">
                  <span className="mb-1.5 block">
                    {field.label}
                    {field.required ? "（必填）" : ""}
                  </span>
                  <textarea
                    className={`${fieldClass} min-h-16 resize-y`}
                    value={inputs[field.label] ?? ""}
                    maxLength={800}
                    placeholder={field.hint}
                    disabled={pending || !ready}
                    onChange={(event) => setInputs((current) => ({ ...current, [field.label]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
          ) : null}

          <fieldset className="mt-5" disabled={pending || saving || !ready}>
            <legend className="flex items-center gap-1.5 text-sm font-medium">
              <Settings2 className="h-3.5 w-3.5 text-muted" />
              发布设定
            </legend>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <MenuField
                label="发布平台"
                value={platform}
                disabled={pending || saving || !ready}
                options={publishOptions.map((item) => ({ id: item.id, label: item.label }))}
                onChange={(id) => {
                  if (!isPublishPlatform(id)) return;
                  setLength((current) => {
                    const kept = current.trim();
                    if (kept && kept !== defaultTargetLength(platform)) return current;
                    return defaultTargetLength(id);
                  });
                  setPlatform(id);
                }}
              />
              <MenuField
                label="风格调性"
                value={style}
                disabled={pending || saving || !ready}
                options={STYLES.map((item) => ({ id: item, label: item }))}
                onChange={setStyle}
              />
              <label className="block text-sm">
                <span className="mb-1.5 block">目标字数</span>
                <input
                  className={fieldClass}
                  value={length}
                  onChange={(event) => setLength(event.target.value)}
                  onBlur={() => {
                    if (!length.trim()) setLength(defaultTargetLength(platform));
                  }}
                  placeholder={defaultTargetLength(platform)}
                  maxLength={20}
                  disabled={pending || saving || !ready}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block">目标读者</span>
                <input
                  className={fieldClass}
                  value={reader}
                  onChange={(event) => setReader(event.target.value)}
                  placeholder="例如：刚入行的产品经理"
                  maxLength={80}
                  disabled={pending || saving || !ready}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className={ghostButton} disabled={saving || !selected} onClick={() => void saveWriting()}>
                <CheckCircle2 className="h-3 w-3" />
                {saving ? "正在保存…" : "保存到账号"}
              </button>
              {savedNote ? <span className="text-sm text-muted">{savedNote}</span> : null}
            </div>
          </fieldset>

          <label className="mt-5 block text-sm">
            <span className="mb-1.5 block">这篇补充，可选</span>
            <textarea
              className={`${fieldClass} min-h-20 resize-y`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="例如：这篇只讲一个今天就能做的动作"
              maxLength={400}
              disabled={pending || !ready}
            />
          </label>

          {formError ? <p className="mt-4 text-sm text-cinnabar-deep">{formError}</p> : null}
          {pending ? (
            <p className="mt-4 text-sm leading-6 text-muted">
              {llm.mode === "live" ? "正在调用模型拆三个方向，通常要十几秒。" : "正在整理三个方向。"}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="inline-flex items-center gap-2 text-xs text-muted">
              <PenTool className="h-3.5 w-3.5" />
              {ready && theme.trim().length >= 2 ? "准备就绪" : "请先补全题材，并选好左侧账号"}
            </p>
            <button type="submit" className={`${primaryButton} px-5 py-2.5`} disabled={pending || saving || !ready || theme.trim().length < 2}>
              <Sparkles className={`h-4 w-4 ${pending ? "animate-pulse" : ""}`} />
              {pending ? "正在生成三个方向…" : "生成三个方向"}
            </button>
          </div>
    </form>
  );
}
