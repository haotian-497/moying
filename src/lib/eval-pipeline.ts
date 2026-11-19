import { randomBytes } from "node:crypto";
import { articleText, attachReview } from "@/lib/copy-review";
import { database } from "@/lib/db";
import { addCandidate, clearL1Needed, getLibraryItem, listLibrary, type EvalLibraryItem } from "@/lib/eval-library";
import { contentHardFailures, directionHardFailures, scoreOutput } from "@/lib/eval-score";
import { generateContent, generateDirections, generateSpokenCues, getLlmStatus } from "@/lib/llm";
import type { CopyContent, Direction, SpokenCues } from "@/lib/types";

export type GateFailure = { step: string; code: string; message: string };

export type PipelineCaseResult = {
  libraryId: number;
  title: string;
  passed: boolean;
  failures: GateFailure[];
  metrics: { label: string; value: string }[];
  directions: Direction[] | null;
  content: CopyContent | null;
  review: CopyContent["review"] | null;
  cues: SpokenCues | null;
  error: string;
  ms: number | null;
};

function now() {
  return new Date().toISOString();
}

function reviewAlignment(content: CopyContent) {
  const text = articleText(content);
  const issues = content.review?.issues ?? [];
  const flags = content.review?.flags ?? [];
  const quotes = [
    ...issues.map((item) => item.quote),
    ...flags.map((item) => item.quote).filter(Boolean),
  ].filter((quote) => quote.trim());
  if (quotes.length === 0) return { total: 0, missing: 0, rate: 1 };
  const missing = quotes.filter((quote) => !text.includes(quote)).length;
  return { total: quotes.length, missing, rate: (quotes.length - missing) / quotes.length };
}

export function gatePipeline(result: {
  directions: Direction[] | null;
  content: CopyContent | null;
  error: string;
  platform: string;
  length: string;
}): { passed: boolean; failures: GateFailure[]; metrics: { label: string; value: string }[] } {
  const failures: GateFailure[] = [];
  const metrics: { label: string; value: string }[] = [];
  if (result.error) {
    failures.push({ step: "pipeline", code: "error", message: result.error });
    return { passed: false, failures, metrics };
  }
  if (!result.directions) {
    failures.push({ step: "directions", code: "missing", message: "没有方向" });
  } else {
    for (const item of directionHardFailures(result.directions)) {
      failures.push({ step: "directions", code: item.code, message: item.message });
    }
    const scored = scoreOutput("directions", "", JSON.stringify({ directions: result.directions }), result.platform);
    metrics.push(...scored.metrics.map((item) => ({ label: `方向·${item.label}`, value: item.value })));
  }
  if (!result.content) {
    failures.push({ step: "content", code: "missing", message: "没有成稿" });
  } else {
    for (const item of contentHardFailures(result.content.body, result.platform, result.length)) {
      failures.push({ step: "content", code: item.code, message: item.message });
    }
    const scored = scoreOutput("content", "", JSON.stringify(result.content), result.platform);
    metrics.push(...scored.metrics.map((item) => ({ label: `成稿·${item.label}`, value: item.value })));
    if (result.content.review?.failed) {
      failures.push({ step: "review", code: "failed", message: result.content.review.summary || "校对失败" });
    } else if (result.content.review) {
      const align = reviewAlignment(result.content);
      metrics.push({ label: "校对·引用对齐", value: align.total === 0 ? "无引用" : `${Math.round(align.rate * 100)}%（${align.total - align.missing}/${align.total}）` });
      if (align.total > 0 && align.rate < 0.85) {
        failures.push({ step: "review", code: "quote", message: `校对引用对齐率 ${Math.round(align.rate * 100)}%，低于 85%` });
      }
    } else {
      failures.push({ step: "review", code: "missing", message: "没有校对结果" });
    }
  }
  return { passed: failures.length === 0, failures, metrics };
}

async function runOne(item: EvalLibraryItem): Promise<PipelineCaseResult> {
  const started = Date.now();
  const voice = { digest: item.frozen.voiceDigest, excerpts: [] as string[] };
  const draft = item.frozen.draft;
  try {
    if (getLlmStatus().mode === "missing") {
      return {
        libraryId: item.id,
        title: item.title,
        passed: false,
        failures: [{ step: "pipeline", code: "missing", message: "还没有配置模型" }],
        metrics: [],
        directions: null,
        content: null,
        review: null,
        cues: null,
        error: "还没有配置模型",
        ms: Date.now() - started,
      };
    }
    const directions = await generateDirections(draft, voice);
    const direction = directions[0];
    if (!direction) throw new Error("没有可用方向");
    const content = await generateContent(draft, direction, voice);
    const reviewed = await attachReview(content, draft, voice, draft.hotspot);
    let cues: SpokenCues | null = null;
    if (item.frozen.path === "spoken") {
      try {
        cues = await generateSpokenCues(draft, voice, reviewed.body);
      } catch (error) {
        const message = error instanceof Error ? error.message : "口播失败";
        const gated = gatePipeline({
          directions,
          content: reviewed,
          error: "",
          platform: draft.platform,
          length: draft.length,
        });
        gated.failures.push({ step: "cues", code: "error", message });
        return {
          libraryId: item.id,
          title: item.title,
          passed: false,
          failures: gated.failures,
          metrics: gated.metrics,
          directions,
          content: reviewed,
          review: reviewed.review ?? null,
          cues: null,
          error: message,
          ms: Date.now() - started,
        };
      }
      if (cues && cues.coverage < 80) {
        const gated = gatePipeline({
          directions,
          content: reviewed,
          error: "",
          platform: draft.platform,
          length: draft.length,
        });
        gated.failures.push({ step: "cues", code: "coverage", message: `口播 coverage ${cues.coverage}% ，低于 80%` });
        gated.metrics.push({ label: "口播·coverage", value: `${cues.coverage}%` });
        return {
          libraryId: item.id,
          title: item.title,
          passed: false,
          failures: gated.failures,
          metrics: gated.metrics,
          directions,
          content: reviewed,
          review: reviewed.review ?? null,
          cues,
          error: "",
          ms: Date.now() - started,
        };
      }
    }
    const gated = gatePipeline({
      directions,
      content: reviewed,
      error: "",
      platform: draft.platform,
      length: draft.length,
    });
    if (cues) gated.metrics.push({ label: "口播·coverage", value: `${cues.coverage}%` });
    return {
      libraryId: item.id,
      title: item.title,
      passed: gated.passed,
      failures: gated.failures,
      metrics: gated.metrics,
      directions,
      content: reviewed,
      review: reviewed.review ?? null,
      cues,
      error: "",
      ms: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "链路跑失败";
    return {
      libraryId: item.id,
      title: item.title,
      passed: false,
      failures: [{ step: "pipeline", code: "error", message }],
      metrics: [],
      directions: null,
      content: null,
      review: null,
      cues: null,
      error: message,
      ms: Date.now() - started,
    };
  }
}

export async function runPipelineRegression(input: { ids?: number[]; note?: string }) {
  const gold = listLibrary("gold");
  const selected = input.ids?.length ? gold.filter((item) => input.ids!.includes(item.id)) : gold.filter((item) => item.path === "main" || item.path === "spoken");
  if (selected.length === 0) return { ok: false as const, error: "请先收入至少一条金标用例" };

  const batch = randomBytes(4).toString("hex");
  const created = now();
  const results: PipelineCaseResult[] = [];
  for (const item of selected) {
    const result = await runOne(item);
    results.push(result);
    database()
      .prepare(
        `INSERT INTO eval_pipeline_results
        (batch, library_id, title, passed, failures_json, metrics_json, directions_json, content_json, review_json, error, ms, human_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
      .run(
        batch,
        result.libraryId,
        result.title,
        result.passed ? 1 : 0,
        JSON.stringify(result.failures),
        JSON.stringify(result.metrics),
        result.directions ? JSON.stringify(result.directions) : null,
        result.content ? JSON.stringify(result.content) : null,
        result.review ? JSON.stringify(result.review) : null,
        result.error,
        result.ms,
        created,
      );
    if (!result.passed) {
      addCandidate(result.title, result.failures[0]?.message || "链路回归失败", {
        libraryId: item.id,
        batch,
        failures: result.failures,
      });
    }
  }

  const passCount = results.filter((item) => item.passed).length;
  const failCount = results.length - passCount;
  const passRate = results.length === 0 ? null : passCount / results.length;
  const previous = database()
    .prepare(`SELECT pass_rate FROM eval_pipeline_runs ORDER BY id DESC LIMIT 1`)
    .get() as { pass_rate: number | null } | undefined;
  database()
    .prepare(
      `INSERT INTO eval_pipeline_runs (batch, note, pass_count, fail_count, pass_rate, baseline_rate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(batch, (input.note || "").slice(0, 200), passCount, failCount, passRate, previous?.pass_rate ?? null, created);
  clearL1Needed();
  return { ok: true as const, batch, passCount, failCount, passRate, baselineRate: previous?.pass_rate ?? null };
}

export function listPipelineRuns() {
  return (
    database()
      .prepare(
        `SELECT batch, note, pass_count, fail_count, pass_rate, baseline_rate, created_at
         FROM eval_pipeline_runs ORDER BY id DESC LIMIT 30`,
      )
      .all() as {
      batch: string;
      note: string;
      pass_count: number;
      fail_count: number;
      pass_rate: number | null;
      baseline_rate: number | null;
      created_at: string;
    }[]
  ).map((row) => ({
    batch: row.batch,
    note: row.note,
    passCount: Number(row.pass_count),
    failCount: Number(row.fail_count),
    passRate: row.pass_rate,
    baselineRate: row.baseline_rate,
    createdAt: row.created_at,
  }));
}

export function getPipelineRun(batch: string) {
  const run = database()
    .prepare(`SELECT batch, note, pass_count, fail_count, pass_rate, baseline_rate, created_at FROM eval_pipeline_runs WHERE batch = ?`)
    .get(batch) as
    | {
        batch: string;
        note: string;
        pass_count: number;
        fail_count: number;
        pass_rate: number | null;
        baseline_rate: number | null;
        created_at: string;
      }
    | undefined;
  if (!run) return null;
  const rows = database()
    .prepare(
      `SELECT id, library_id, title, passed, failures_json, metrics_json, error, ms, human_json, created_at
       FROM eval_pipeline_results WHERE batch = ? ORDER BY id`,
    )
    .all(batch) as {
    id: number;
    library_id: number;
    title: string;
    passed: number;
    failures_json: string;
    metrics_json: string;
    error: string;
    ms: number | null;
    human_json: string | null;
    created_at: string;
  }[];
  return {
    batch: run.batch,
    note: run.note,
    passCount: Number(run.pass_count),
    failCount: Number(run.fail_count),
    passRate: run.pass_rate,
    baselineRate: run.baseline_rate,
    createdAt: run.created_at,
    results: rows.map((row) => ({
      id: Number(row.id),
      libraryId: Number(row.library_id),
      title: row.title,
      passed: row.passed === 1,
      failures: (() => {
        try {
          return JSON.parse(row.failures_json) as GateFailure[];
        } catch {
          return [];
        }
      })(),
      metrics: (() => {
        try {
          return JSON.parse(row.metrics_json) as { label: string; value: string }[];
        } catch {
          return [];
        }
      })(),
      error: row.error,
      ms: row.ms,
      human: (() => {
        if (!row.human_json) return null;
        try {
          return JSON.parse(row.human_json) as { likeSelf: string; fitAccount: string; darePublish: string; note: string };
        } catch {
          return null;
        }
      })(),
      createdAt: row.created_at,
      library: getLibraryItem(Number(row.library_id)),
    })),
  };
}

export function saveHumanReview(
  resultId: number,
  human: { likeSelf: "过" | "勉强" | "不过"; fitAccount: "过" | "勉强" | "不过"; darePublish: "过" | "勉强" | "不过"; note: string },
) {
  const exists = database().prepare("SELECT id FROM eval_pipeline_results WHERE id = ?").get(resultId);
  if (!exists) return { ok: false as const, error: "没有这条结果" };
  database().prepare("UPDATE eval_pipeline_results SET human_json = ? WHERE id = ?").run(JSON.stringify(human), resultId);
  return { ok: true as const };
}
