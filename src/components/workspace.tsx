"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Clock, FileText, FolderOpen, Plus, Search, Settings2, User, XCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { TopicForm } from "@/components/topic-form";
import { Workbench } from "@/components/workbench";
import { Stepper, type WorkStep } from "@/components/stepper";
import { fieldClass, secondaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import { formatTime } from "@/lib/format";
import { HotspotPanel } from "@/components/hotspot-panel";
import { formatAge, isMediaReady, isPersonalReady, isPublishPlatform, platformLabel, type HotTake, type HotTopic, type LlmStatus, type MediaAccount, type PersonalProfile, type Platform, type Work, type WorkHotspot, type WorkSummary } from "@/lib/types";

type Step = WorkStep;
type SidebarSection = "persona" | "account" | "works";

type WorkFilter = "all" | "draft" | "ready" | "failed";

const workStatusMeta = {
  draft: { label: "草稿", Icon: Clock, className: "text-muted" },
  ready: { label: "已完成", Icon: CheckCircle2, className: "text-moss" },
  failed: { label: "失败", Icon: XCircle, className: "text-cinnabar-deep" },
} as const;

function asSummary(work: Work): WorkSummary {
  return {
    id: work.id,
    theme: work.theme,
    platform: work.platform,
    style: work.style,
    status: work.content ? "ready" : work.error && !work.directions ? "failed" : "draft",
    updatedAt: work.updatedAt,
  };
}

export function Workspace({
  username,
  guest,
  llm,
  personal,
  accounts,
  initialWorkId,
  initialStep,
  initialMode = "create",
}: {
  username: string;
  guest: boolean;
  llm: LlmStatus;
  personal: PersonalProfile;
  accounts: MediaAccount[];
  initialWorkId: string | null;
  initialStep: Step;
  initialMode?: "create" | "hot";
}) {
  const personalReady = isPersonalReady(personal);
  const [accountList, setAccountList] = useState(accounts);
  const [accountId, setAccountId] = useState<number | null>(accounts[0]?.id ?? null);
  const savedPlatform = accounts[0] && isPublishPlatform(accounts[0].platform) ? accounts[0].platform : "wechat";
  const [publishPlatform, setPublishPlatform] = useState<Platform>(savedPlatform);
  const [themeFromHot, setThemeFromHot] = useState("");
  const [themePick, setThemePick] = useState(0);
  const [topics, setTopics] = useState<HotTopic[]>([]);
  const [hotMatches, setHotMatches] = useState<HotTake["matches"]>([]);
  const [poolSignal, setPoolSignal] = useState(0);
  const [hotspotFromHot, setHotspotFromHot] = useState<WorkHotspot | null>(null);
  const [mode, setMode] = useState<"create" | "hot">(initialMode);
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("persona");
  const selectedAccount = accountList.find((item) => item.id === accountId) ?? null;
  const hotPlatform = isPublishPlatform(publishPlatform) ? publishPlatform : "wechat";
  const hotReady = personalReady && Boolean(selectedAccount && isMediaReady(selectedAccount));
  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [workId, setWorkId] = useState<string | null>(initialWorkId);
  const [step, setStep] = useState<Step>(initialStep);
  const [workQuery, setWorkQuery] = useState("");
  const [workFilter, setWorkFilter] = useState<WorkFilter>("all");

  useEffect(() => {
    let cancelled = false;
    api<{ works: WorkSummary[] }>("/api/works")
      .then((data) => {
        if (!cancelled) setWorks(data.works);
      })
      .catch((error: unknown) => {
        if (!cancelled) setListError(error instanceof Error ? error.message : "稿库加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (workId) params.set("work", workId);
    params.set("step", step);
    const next = `/?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [step, workId]);

  async function onDelete(id: number) {
    if (!window.confirm("删除这篇稿？方向和成稿都会一起去掉。")) return;
    try {
      await api(`/api/works/${id}`, { method: "DELETE" });
      setWorks((current) => current.filter((item) => item.id !== id));
      if (workId === String(id)) {
        setWorkId(null);
        setStep("topic");
      }
    } catch (error) {
      setListError(error instanceof Error ? error.message : "删除失败");
    }
  }

  function openWork(work: WorkSummary) {
    setMode("create");
    setWorkId(String(work.id));
    setStep(work.status === "ready" ? "draft" : "direction");
  }

  function useHotTheme(theme: string, hotspot: WorkHotspot) {
    setThemeFromHot(theme);
    setHotspotFromHot(hotspot);
    setThemePick((current) => current + 1);
    setMode("create");
    setWorkId(null);
    setStep("topic");
  }

  function startTopic() {
    setMode("create");
    setWorkId(null);
    setStep("topic");
  }

  const draftCount = works.filter((item) => item.status === "draft").length;
  const finishedCount = works.filter((item) => item.status === "ready").length;
  const failedCount = works.filter((item) => item.status === "failed").length;
  const workFilters: { id: WorkFilter; label: string; count: number }[] = [
    { id: "all", label: "全部", count: works.length },
    { id: "draft", label: "草稿", count: draftCount },
    { id: "ready", label: "已完成", count: finishedCount },
    { id: "failed", label: "失败", count: failedCount },
  ];
  const filteredWorks = works.filter((item) => {
    const q = workQuery.trim().toLowerCase();
    const matchesQuery = !q || item.theme.toLowerCase().includes(q) || platformLabel(item.platform).toLowerCase().includes(q);
    const matchesFilter = workFilter === "all" || item.status === workFilter;
    return matchesQuery && matchesFilter;
  });

  const navItems: { id: SidebarSection; label: string; Icon: typeof User; badge?: string }[] = [
    { id: "persona", label: "个人人设", Icon: User },
    { id: "account", label: "账号设定", Icon: Settings2 },
    { id: "works", label: "稿库", Icon: FolderOpen, badge: String(works.length) },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <AppHeader username={username} guest={guest} mode={mode} onMode={setMode} />
      <div className="mx-auto flex w-full max-w-[100rem] flex-1 overflow-hidden">
        <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-card">
          <nav className="flex flex-col gap-0.5 p-3">
            {navItems.map((item) => {
              const on = sidebarSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSidebarSection(item.id)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                    on ? "bg-paper-deep text-ink" : "text-muted hover:bg-paper hover:text-ink"
                  }`}
                >
                  <item.Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge ? <span className="rounded bg-paper-deep px-1.5 py-0.5 text-[10px] font-medium text-muted">{item.badge}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-line" />
          <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
            {sidebarSection === "persona" ? (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">基础信息</h4>
                {personalReady ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted">年龄</p>
                      <p className="font-medium">{formatAge(personal.age)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">职业</p>
                      <p className="font-medium">{personal.occupation}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">行业</p>
                      <p className="font-medium">{personal.industry}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">性格特点</p>
                      <p className="font-medium leading-relaxed">{personal.personality}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted">年龄、职业、行业和性格还没写。写题材之前要先补上。</p>
                )}
                <Link href="/persona" className="inline-flex w-full items-center justify-center gap-1 rounded-md px-3 py-2 text-xs text-muted transition hover:bg-paper-deep hover:text-ink">
                  {personalReady ? "编辑人设信息" : "去填写人设"}
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : null}

            {sidebarSection === "account" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">账号列表</h4>
                  <Link href="/settings" className="text-xs text-muted hover:text-ink">
                    管理
                  </Link>
                </div>
                {accountList.length === 0 ? (
                  <p className="text-sm leading-6 text-muted">还没有自媒体账号。</p>
                ) : (
                  <div className="space-y-2">
                    {accountList.map((account) => {
                      const on = account.id === accountId;
                      return (
                        <button
                          key={account.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setAccountId(account.id)}
                          className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                            on ? "border-blue/40 bg-blue-soft" : "border-line bg-card hover:border-ink/15"
                          }`}
                        >
                          <span className="block text-sm font-medium">{account.name}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted">{account.platforms.map((id) => platformLabel(id)).join("、")}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <Link href="/settings" className="inline-flex w-full items-center justify-center gap-1 rounded-md px-3 py-2 text-xs text-muted transition hover:bg-paper-deep hover:text-ink">
                  添加或管理账号
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ) : null}

            {sidebarSection === "works" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">稿库</h4>
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink" onClick={startTopic}>
                    <Plus className="h-3 w-3" />
                    新题材
                  </button>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input
                    className={`${fieldClass} h-8 py-0 pl-8 text-xs`}
                    value={workQuery}
                    onChange={(event) => setWorkQuery(event.target.value)}
                    placeholder="搜索稿件..."
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {workFilters.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setWorkFilter(item.id)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                        workFilter === item.id ? "bg-paper-deep text-ink" : "text-muted hover:text-ink"
                      }`}
                    >
                      {item.label}
                      <span className="text-muted/70">{item.count}</span>
                    </button>
                  ))}
                </div>
                {listError ? <p className="text-sm text-cinnabar-deep">{listError}</p> : null}
                {loading ? <p className="text-sm text-muted">正在打开稿库…</p> : null}
                {!loading && filteredWorks.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-muted/30" />
                    <p className="text-xs text-muted">{works.length === 0 ? "还没有稿。点新题材写一篇。" : "暂无匹配稿件"}</p>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  {filteredWorks.map((work) => {
                    const on = workId === String(work.id);
                    const meta = workStatusMeta[work.status];
                    return (
                      <div
                        key={work.id}
                        className={`group rounded-md border bg-card p-3 transition ${
                          on ? "border-ink/20 bg-paper-deep" : "border-line hover:border-ink/10 hover:shadow-sm"
                        }`}
                      >
                        <button type="button" onClick={() => openWork(work)} className="w-full text-left">
                          <span className="mb-1.5 flex items-center gap-1.5">
                            <meta.Icon className={`h-3 w-3 shrink-0 ${meta.className}`} />
                            <span className={`text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                            <span className="ml-auto text-[10px] text-muted" suppressHydrationWarning>
                              {formatTime(work.updatedAt)}
                            </span>
                          </span>
                          <span className="block text-xs font-medium leading-snug">{work.theme}</span>
                          <span className="mt-1 block text-[10px] text-muted">{platformLabel(work.platform)}</span>
                        </button>
                        <button type="button" onClick={() => onDelete(work.id)} className="mt-1.5 text-[10px] text-muted hover:text-ink">
                          删除
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-auto">
          <div className={mode === "create" ? "flex h-full flex-col" : "hidden"}>
            <div className="flex items-center justify-center border-b border-line bg-card px-4 py-3 sm:px-6">
              <Stepper current={step} onStep={setStep} />
            </div>
            <div className={`flex-1 overflow-auto p-4 sm:p-6 ${step === "draft" ? "mx-auto w-full max-w-4xl" : ""}`}>
              <div className={step === "topic" ? "animate-fade-in" : "hidden"}>
                <TopicForm
                  llm={llm}
                  personal={personal}
                  accounts={accountList}
                  onAccountSaved={(account) => setAccountList((current) => current.map((item) => (item.id === account.id ? account : item)))}
                  accountId={accountId}
                  themeFromHot={themeFromHot}
                  themePick={themePick}
                  onPlatformChange={setPublishPlatform}
                  topics={topics}
                  matches={hotMatches}
                  hotspotFromHot={hotspotFromHot}
                  poolSignal={poolSignal}
                  onCreated={(work) => {
                    const summary = asSummary(work);
                    setWorks((current) => [summary, ...current.filter((item) => item.id !== work.id)]);
                    setWorkId(String(work.id));
                    setStep("direction");
                  }}
                />
              </div>

              {workId ? (
                <div className={step === "topic" ? "hidden" : "animate-fade-in"}>
                  <Workbench
                    key={workId}
                    id={workId}
                    username={username}
                    guest={guest}
                    llm={llm}
                    embedded
                    step={step}
                    onDrafted={() => {
                      setWorks((current) => current.map((item) => (String(item.id) === workId ? { ...item, status: "ready" } : item)));
                      setStep("draft");
                    }}
                  />
                </div>
              ) : step === "topic" ? null : (
                <div className="mt-2 rounded-lg border border-dashed border-line bg-card px-5 py-8">
                  <p className="text-sm leading-6 text-muted">
                    {step === "direction" ? "还没有方向。先在选题材里生成，或从左边稿库打开一篇。" : "还没有成稿。先生成方向并写成全文，或从左边稿库打开一篇。"}
                  </p>
                  <button type="button" className={`${secondaryButton} mt-4`} onClick={startTopic}>
                    去选题材
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={mode === "hot" ? "p-4 sm:p-6" : "hidden"}>
            <div className="rounded-lg border border-line bg-card p-5">
              {hotReady ? (
                <HotspotPanel
                  accountId={selectedAccount?.id ?? null}
                  platform={hotPlatform}
                  enabled={hotReady}
                  onTake={(take) => {
                    setTopics(take?.topics ?? []);
                    setHotMatches(take?.matches ?? []);
                  }}
                  onCreate={useHotTheme}
                  onPooled={() => setPoolSignal((current) => current + 1)}
                />
              ) : (
                <p className="text-sm leading-6 text-muted">先在左边写好个人资料，并选一个账号。抓取后会按这个账号的定位，从全网热榜里挑能蹭的。</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
