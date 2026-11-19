"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  fieldClass,
  metaBadgeClass,
  panelClass,
  panelPadClass,
  primaryButton,
  secondaryButton,
  sectionTitleClass,
} from "@/components/ui";
import { FEATURES, featureLabel } from "@/lib/features";
import { TEST_LOGIC } from "@/lib/eval-score";
import { formatTime } from "@/lib/format";
import { platformLabel } from "@/lib/types";

type Quality = {
  targets: {
    pipelinePassRate: number;
    directionHardFailRate: number;
    contentHardFailRate: number;
    reviewAlignRate: number;
    cueCoverage: number;
  };
  goldCount: number;
  antiCount: number;
  tagCoverage: { tag: string; count: number }[];
  latestRun: {
    batch: string;
    passCount: number;
    failCount: number;
    passRate: number | null;
    baselineRate: number | null;
    createdAt: string;
  } | null;
  runHistory: {
    batch: string;
    passCount: number;
    failCount: number;
    passRate: number | null;
    baselineRate: number | null;
    createdAt: string;
  }[];
  pendingCandidates: number;
  l1Needed: boolean;
  l1Reason: string;
  promoteStats: { feature: string; label: string; officialWins: number; variantWins: number; ties: number }[];
  hardRates: { directions: number | null; content: number | null };
};

type LibraryItem = {
  id: number;
  kind: "gold" | "anti";
  path: "main" | "spoken";
  title: string;
  feature: string;
  tags: string[];
  platform: string;
  theme: string;
  createdAt: string;
  sourceType: string;
};

type Manual = { id: number; feature: string; title: string; user: string; createdAt: string };
type Sample = { id: number; feature: string; username: string; user: string; output: string; excluded: boolean; createdAt: string; workId: number | null };
type WorkCase = { key: string; feature: string; title: string; username: string; user: string; output: string; createdAt: string };
type Batch = { batch: string; feature: string; count: number; createdAt: string };
type PipelineRun = {
  batch: string;
  note: string;
  passCount: number;
  failCount: number;
  passRate: number | null;
  baselineRate: number | null;
  createdAt: string;
};
type PipelineDetail = {
  batch: string;
  note: string;
  passCount: number;
  failCount: number;
  passRate: number | null;
  baselineRate: number | null;
  createdAt: string;
  results: {
    id: number;
    libraryId: number;
    title: string;
    passed: boolean;
    failures: { step: string; code: string; message: string }[];
    metrics: { label: string; value: string }[];
    error: string;
    ms: number | null;
    human: { likeSelf: string; fitAccount: string; darePublish: string; note: string } | null;
  }[];
} | null;
type Candidate = { id: number; title: string; reason: string; createdAt: string };

function pct(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export function EvalBoard({
  quality,
  library,
  manual,
  samples,
  works,
  batches,
  pipelineRuns,
  pipelineDetail,
  candidates,
}: {
  quality: Quality;
  library: LibraryItem[];
  manual: Manual[];
  samples: Sample[];
  works: WorkCase[];
  batches: Batch[];
  pipelineRuns: PipelineRun[];
  pipelineDetail: PipelineDetail;
  candidates: Candidate[];
}) {
  const [feature, setFeature] = useState(FEATURES[0].id);
  const [title, setTitle] = useState("");
  const [user, setUser] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedGold, setSelectedGold] = useState<number[]>([]);
  const [humanDraft, setHumanDraft] = useState<Record<number, { likeSelf: string; fitAccount: string; darePublish: string; note: string }>>({});

  const goldIds = useMemo(() => library.filter((item) => item.kind === "gold").map((item) => item.id), [library]);

  async function post(body: unknown, next?: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string; batch?: string };
      if (!response.ok) throw new Error(data.error || "没有完成");
      if (data.batch) window.location.href = `/admin/eval?batch=${data.batch}`;
      else if (next) window.location.href = next;
      else window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有完成");
      setPending(false);
    }
  }

  const latestTone =
    quality.latestRun?.passRate == null
      ? "border-line bg-card text-muted"
      : quality.latestRun.passRate >= quality.targets.pipelinePassRate
        ? "border-moss/30 bg-moss-soft text-moss"
        : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className="space-y-10">
      {error ? <p className="text-sm text-cinnabar-deep">{error}</p> : null}

      {quality.l1Needed ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">需要跑一次产品回归</p>
          <p className="mt-1 text-amber-800/90">{quality.l1Reason || "正式提示词已变更。"}</p>
          <button
            type="button"
            className={`${primaryButton} mt-3`}
            disabled={pending || goldIds.length === 0}
            onClick={() => post({ action: "pipeline-run", ids: selectedGold.length ? selectedGold : goldIds, note: "promote 后回归" })}
          >
            {pending ? "正在回归…" : "立即跑主路径金标"}
          </button>
        </div>
      ) : null}

      <div>
        <h2 className={sectionTitleClass}>质量总览</h2>
        <p className="mt-1.5 text-sm text-muted">设计目标 / 自评口径，不宣称线上大盘。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className={panelPadClass}>
            <p className="text-xs text-muted">金标主路径通过率</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{pct(quality.latestRun?.passRate ?? null)}</p>
            <p className="mt-1 text-xs text-muted">目标 ≥ {Math.round(quality.targets.pipelinePassRate * 100)}%</p>
            {quality.latestRun ? (
              <p className="mt-2">
                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${latestTone}`}>
                  较上轮 {quality.latestRun.baselineRate == null ? "无基线" : quality.latestRun.passRate != null && quality.latestRun.passRate >= quality.latestRun.baselineRate ? "持平或更好" : "变差"}
                </span>
              </p>
            ) : null}
          </article>
          <article className={panelPadClass}>
            <p className="text-xs text-muted">金标 / 反例</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {quality.goldCount} <span className="text-base font-normal text-muted">/ {quality.antiCount}</span>
            </p>
            <p className="mt-1 text-xs text-muted">候选待处理 {quality.pendingCandidates}</p>
          </article>
          <article className={panelPadClass}>
            <p className="text-xs text-muted">近 7 天方向失败率</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{pct(quality.hardRates.directions)}</p>
            <p className="mt-1 text-xs text-muted">目标 ≤ {Math.round(quality.targets.directionHardFailRate * 100)}%</p>
          </article>
          <article className={panelPadClass}>
            <p className="text-xs text-muted">近 7 天成稿失败率</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{pct(quality.hardRates.content)}</p>
            <p className="mt-1 text-xs text-muted">目标 ≤ {Math.round(quality.targets.contentHardFailRate * 100)}%</p>
          </article>
        </div>
        {quality.tagCoverage.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {quality.tagCoverage.map((item) => (
              <span key={item.tag} className={metaBadgeClass}>
                {item.tag} · {item.count}
              </span>
            ))}
          </div>
        ) : null}
        {quality.promoteStats.length > 0 ? (
          <div className={`mt-4 ${panelPadClass}`}>
            <h3 className="text-sm font-medium">盲选汇总（正式 vs 试验）</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {quality.promoteStats.map((item) => (
                <li key={item.feature}>
                  {item.label}：正式 {item.officialWins} · 试验 {item.variantWins} · 平手 {item.ties}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={sectionTitleClass}>产品回归（L1）</h2>
            <p className="mt-1.5 text-sm text-muted">用当前正式 Prompt 跑金标：方向 → 成稿 → 校对（口播路径另含口播）。</p>
          </div>
          <button
            type="button"
            className={primaryButton}
            disabled={pending || goldIds.length === 0}
            onClick={() => post({ action: "pipeline-run", ids: selectedGold.length ? selectedGold : goldIds, note: "手动回归" })}
          >
            {pending ? "正在回归…" : selectedGold.length ? `跑选中 ${selectedGold.length} 条` : `跑全部金标 ${goldIds.length}`}
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {pipelineRuns.length === 0 ? <li className="text-sm text-muted">还没有链路回归记录。</li> : null}
          {pipelineRuns.map((run) => (
            <li key={run.batch} className={`${panelPadClass} flex flex-wrap items-center gap-2 text-sm`}>
              <Link className="font-medium underline decoration-line underline-offset-2 hover:decoration-ink" href={`/admin/eval?batch=${run.batch}`}>
                {run.batch}
              </Link>
              <span className={metaBadgeClass}>通过 {pct(run.passRate)}</span>
              <span className="text-muted">
                {run.passCount}/{run.passCount + run.failCount} · {formatTime(run.createdAt)}
              </span>
              {run.baselineRate != null ? <span className="text-xs text-muted">上轮 {pct(run.baselineRate)}</span> : null}
            </li>
          ))}
        </ul>

        {pipelineDetail ? (
          <div className={`mt-4 space-y-3 ${panelPadClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">回归详情 {pipelineDetail.batch}</h3>
              <Link href="/admin/eval" className="text-xs text-muted hover:text-ink">
                关闭详情
              </Link>
            </div>
            <p className="text-sm text-muted">
              通过 {pipelineDetail.passCount} · 失败 {pipelineDetail.failCount} · {pct(pipelineDetail.passRate)}
            </p>
            {pipelineDetail.results.map((result) => {
              const draft = humanDraft[result.id] ?? {
                likeSelf: result.human?.likeSelf || "过",
                fitAccount: result.human?.fitAccount || "过",
                darePublish: result.human?.darePublish || "过",
                note: result.human?.note || "",
              };
              return (
                <article key={result.id} className="rounded-md border border-line bg-paper px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{result.title}</span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                        result.passed ? "border-moss/30 bg-moss-soft text-moss" : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {result.passed ? "过关" : "未过关"}
                    </span>
                    {result.ms != null ? <span className="text-xs text-muted">{result.ms} ms</span> : null}
                  </div>
                  {result.failures.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-cinnabar-deep">
                      {result.failures.map((item) => (
                        <li key={`${item.step}-${item.code}-${item.message}`}>
                          [{item.step}] {item.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {result.metrics.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted">
                      {result.metrics.map((item) => (
                        <li key={item.label}>
                          {item.label}：{item.value}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        ["likeSelf", "像本人"],
                        ["fitAccount", "落账号"],
                        ["darePublish", "敢发"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="text-xs text-muted">
                        {label}
                        <select
                          className={`${fieldClass} mt-1`}
                          value={draft[key]}
                          onChange={(event) =>
                            setHumanDraft((current) => ({
                              ...current,
                              [result.id]: { ...draft, [key]: event.target.value },
                            }))
                          }
                        >
                          <option value="过">过</option>
                          <option value="勉强">勉强</option>
                          <option value="不过">不过</option>
                        </select>
                      </label>
                    ))}
                  </div>
                  <input
                    className={`${fieldClass} mt-2`}
                    placeholder="人审备注"
                    value={draft.note}
                    onChange={(event) =>
                      setHumanDraft((current) => ({
                        ...current,
                        [result.id]: { ...draft, note: event.target.value },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className={`${secondaryButton} mt-2`}
                    disabled={pending}
                    onClick={() =>
                      post({
                        action: "human-review",
                        id: result.id,
                        likeSelf: draft.likeSelf,
                        fitAccount: draft.fitAccount,
                        darePublish: draft.darePublish,
                        note: draft.note,
                      })
                    }
                  >
                    保存人审
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      <div>
        <h2 className={sectionTitleClass}>金标库</h2>
        <p className="mt-1.5 text-sm text-muted">冻结输入，供链路回归与 A/B 优先勾选。反例用于能力级对照。</p>
        <ul className="mt-3 space-y-2">
          {library.length === 0 ? <li className="text-sm text-muted">还没有金标。从下方真实使用一键收入。</li> : null}
          {library.map((item) => {
            const checked = selectedGold.includes(item.id);
            return (
              <li key={item.id} className={`${panelPadClass} text-sm`}>
                <div className="flex flex-wrap items-start gap-3">
                  {item.kind === "gold" ? (
                    <label className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setSelectedGold((current) => (event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)))
                        }
                      />
                      回归
                    </label>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                          item.kind === "gold" ? "border-moss/30 bg-moss-soft text-moss" : "border-cinnabar/25 bg-cinnabar-soft text-cinnabar-deep"
                        }`}
                      >
                        {item.kind === "gold" ? "金标" : "反例"}
                      </span>
                      <span className={metaBadgeClass}>{item.path === "spoken" ? "口播路径" : "主路径"}</span>
                      <span className={metaBadgeClass}>{platformLabel(item.platform)}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {item.sourceType} · {formatTime(item.createdAt)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className={metaBadgeClass}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button type="button" className={secondaryButton} disabled={pending} onClick={() => post({ action: "delete-library", id: item.id })}>
                    删除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {candidates.length > 0 ? (
        <div>
          <h2 className={sectionTitleClass}>失败候选</h2>
          <p className="mt-1.5 text-sm text-muted">回归失败或盲选试验胜出的线索，可晋升金标或忽略。</p>
          <ul className="mt-3 space-y-2">
            {candidates.map((item) => (
              <li key={item.id} className={`${panelPadClass} flex flex-wrap items-center justify-between gap-2 text-sm`}>
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.reason} · {formatTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className={secondaryButton} disabled={pending} onClick={() => post({ action: "candidate-accept", id: item.id })}>
                    标记已处理
                  </button>
                  <button type="button" className={ghostish()} disabled={pending} onClick={() => post({ action: "candidate-dismiss", id: item.id })}>
                    忽略
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h2 className={sectionTitleClass}>真实使用（三键标注）</h2>
        <p className="mt-1.5 text-sm text-muted">收入金标 / 标为反例 / 排除。排除后不再进入以后测试。</p>
        <ul className="mt-3 space-y-2">
          {samples.map((item) => (
            <li key={item.id} className={`${panelPadClass} text-sm`}>
              <p className="flex flex-wrap items-center gap-2">
                <span className={metaBadgeClass}>{featureLabel(item.feature)}</span>
                <span className="font-medium">{item.username}</span>
                <span className="text-muted">{formatTime(item.createdAt)}</span>
                {item.excluded ? (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">已排除</span>
                ) : null}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-muted hover:text-ink">输入和当时的结果</summary>
                <pre className="scrollbar-thin mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-paper px-3 py-2 text-muted">{item.user}</pre>
                <pre className="scrollbar-thin mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-paper px-3 py-2">{item.output}</pre>
              </details>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={secondaryButton} disabled={pending || item.excluded} onClick={() => post({ action: "promote-sample", id: item.id, kind: "gold" })}>
                  收入金标
                </button>
                <button type="button" className={secondaryButton} disabled={pending || item.excluded} onClick={() => post({ action: "promote-sample", id: item.id, kind: "anti" })}>
                  标为反例
                </button>
                <button type="button" className={secondaryButton} disabled={pending} onClick={() => post({ action: "exclude", id: item.id, excluded: !item.excluded })}>
                  {item.excluded ? "重新纳入" : "排除"}
                </button>
              </div>
            </li>
          ))}
          {works.map((item) => {
            const workId = Number(item.key.split(":").pop());
            return (
              <li key={item.key} className={`${panelPadClass} text-sm`}>
                <p className="flex flex-wrap items-center gap-2">
                  <span className={metaBadgeClass}>历史稿子</span>
                  <span className={metaBadgeClass}>{featureLabel(item.feature)}</span>
                  <span className="font-medium">{item.username}</span>
                  <span className="text-muted">{item.title}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={secondaryButton} disabled={pending || !workId} onClick={() => post({ action: "promote-work", id: workId, kind: "gold" })}>
                    收入金标
                  </button>
                  <button type="button" className={secondaryButton} disabled={pending || !workId} onClick={() => post({ action: "promote-work", id: workId, kind: "anti" })}>
                    标为反例
                  </button>
                </div>
              </li>
            );
          })}
          {samples.length + works.length === 0 ? <p className="text-sm text-muted">还没有真实使用记录。</p> : null}
        </ul>
      </div>

      <div>
        <h2 className={sectionTitleClass}>手工用例（L2）</h2>
        <p className="mt-1.5 text-sm text-muted">给单能力 A/B 补边角场景。</p>
        <div className={`mt-3 space-y-3 ${panelPadClass}`}>
          <select className={fieldClass} value={feature} onChange={(event) => setFeature(event.target.value as typeof feature)}>
            {FEATURES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="用例标题" />
          <textarea className={`${fieldClass} min-h-32`} value={user} onChange={(event) => setUser(event.target.value)} placeholder="交给模型的输入" />
          <button type="button" className={primaryButton} disabled={pending} onClick={() => post({ action: "case", feature, title, user })}>
            添加用例
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {manual.map((item) => (
            <li key={item.id} className={`${panelPadClass} text-sm`}>
              <p className="flex flex-wrap items-center gap-2">
                <span className={metaBadgeClass}>{featureLabel(item.feature)}</span>
                <span className="font-medium">{item.title}</span>
              </p>
              <pre className="scrollbar-thin mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-paper px-3 py-2 text-muted">{item.user}</pre>
              <button type="button" className={`${secondaryButton} mt-2`} disabled={pending} onClick={() => post({ action: "delete-case", id: item.id })}>
                删除
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className={sectionTitleClass}>能力级历史批次</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {batches.length === 0 ? <li className="text-muted">还没有 A/B 对比。</li> : null}
          {batches.map((item) => (
            <li key={item.batch} className={`${panelPadClass} flex flex-wrap items-center gap-2`}>
              <Link className="font-medium underline decoration-line underline-offset-2" href={`/admin/ab?batch=${item.batch}`}>
                {item.batch}
              </Link>
              <span className={metaBadgeClass}>{featureLabel(item.feature)}</span>
              <span className="text-muted">
                {item.count} 条 · {formatTime(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className={sectionTitleClass}>测试逻辑说明</h2>
        <div className="mt-3 space-y-2">
          {TEST_LOGIC.map((item) => (
            <article key={item.id} className={`${panelPadClass} text-sm`}>
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                {item.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className={`mt-3 text-xs text-muted ${panelClass} px-3 py-2`}>
          校对引用对齐目标 ≥ {Math.round(quality.targets.reviewAlignRate * 100)}%；口播 coverage 目标 ≥ {Math.round(quality.targets.cueCoverage * 100)}%。
        </p>
      </div>
    </div>
  );
}

function ghostish() {
  return "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm text-muted transition hover:bg-paper-deep hover:text-ink disabled:opacity-50";
}
