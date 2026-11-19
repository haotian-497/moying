import { randomBytes } from "node:crypto";
import { database } from "@/lib/db";
import { scoreOutput, type HardFailure, type ScoreCard, type ScoreMetric } from "@/lib/eval-score";
import { isFeatureId, type FeatureId } from "@/lib/features";
import { addCandidate, resolveLibraryCase } from "@/lib/eval-library";
import { contentUserMessage, draftBrief, runEvalCompletion } from "@/lib/llm";
import { getPromptVersion, getVariantVersion } from "@/lib/prompts";
import { isPlatform, type Direction, type DraftInput } from "@/lib/types";

export type EvalCaseRef = { key: string; feature: FeatureId; title: string; user: string; platform: string; original: string | null };

function now() {
  return new Date().toISOString();
}

function readInput(text: string) {
  try {
    const data = JSON.parse(text) as { user?: string; platform?: string };
    return { user: typeof data.user === "string" ? data.user : text, platform: typeof data.platform === "string" ? data.platform : "" };
  } catch {
    return { user: text, platform: "" };
  }
}

export function addManualCase(feature: FeatureId, title: string, user: string, platform: string) {
  const name = title.trim();
  const input = user.trim();
  if (!name) return { ok: false as const, error: "请填写用例标题" };
  if (input.length < 2) return { ok: false as const, error: "请填写要交给模型的输入" };
  database()
    .prepare("INSERT INTO eval_cases (feature, title, input_json, created_at) VALUES (?, ?, ?, ?)")
    .run(feature, name.slice(0, 80), JSON.stringify({ user: input.slice(0, 20000), platform }), now());
  return { ok: true as const };
}

export function deleteManualCase(id: number) {
  database().prepare("DELETE FROM eval_cases WHERE id = ?").run(id);
}

export function listManualCases() {
  const rows = database().prepare("SELECT id, feature, title, input_json, created_at FROM eval_cases ORDER BY id DESC").all() as {
    id: number;
    feature: string;
    title: string;
    input_json: string;
    created_at: string;
  }[];
  return rows.map((row) => {
    const input = readInput(row.input_json);
    return { id: Number(row.id), feature: row.feature, title: row.title, user: input.user, platform: input.platform, createdAt: row.created_at };
  });
}

export function excludeSample(id: number, excluded: boolean) {
  database().prepare("UPDATE generation_samples SET excluded = ? WHERE id = ?").run(excluded ? 1 : 0, id);
}

export function listSamples() {
  const rows = database()
    .prepare(
      `SELECT s.id, s.feature, s.input_json, s.output_text, s.platform, s.excluded, s.created_at, s.work_id, COALESCE(u.username, '未知') AS username
      FROM generation_samples s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.id DESC LIMIT 200`,
    )
    .all() as {
    id: number;
    feature: string;
    input_json: string;
    output_text: string;
    platform: string;
    excluded: number;
    created_at: string;
    work_id: number | null;
    username: string;
  }[];
  return rows.map((row) => ({
    id: Number(row.id),
    feature: row.feature,
    user: readInput(row.input_json).user,
    output: row.output_text,
    platform: row.platform,
    excluded: row.excluded === 1,
    createdAt: row.created_at,
    workId: row.work_id,
    username: row.username,
  }));
}

type WorkRow = {
  id: number;
  username: string;
  theme: string;
  platform: string;
  audience: string;
  style: string;
  notes: string;
  account_name: string;
  age: string;
  occupation: string;
  industry: string;
  personality: string;
  persona: string;
  problem: string;
  profile_notes: string;
  directions_json: string | null;
  selected_index: number | null;
  content_json: string | null;
  updated_at: string;
};

function draftOf(row: WorkRow): DraftInput | null {
  if (!isPlatform(row.platform)) return null;
  return {
    theme: row.theme,
    platform: row.platform,
    style: row.style,
    notes: row.notes,
    accountId: null,
    accountName: row.account_name,
    audience: row.audience,
    age: row.age,
    occupation: row.occupation,
    industry: row.industry,
    personality: row.personality,
    persona: row.persona,
    problem: row.problem,
    profileNotes: row.profile_notes,
    length: "",
    reader: row.audience,
    hotspot: null,
    section: null,
    inputs: {},
  };
}

export function listWorkCases() {
  const covered = new Set(
    (database().prepare("SELECT feature, work_id FROM generation_samples WHERE work_id IS NOT NULL").all() as { feature: string; work_id: number }[]).map(
      (row) => `${row.feature}:${row.work_id}`,
    ),
  );
  const rows = database()
    .prepare(
      `SELECT w.id, COALESCE(u.username, '未知') AS username, w.theme, w.platform, w.audience, w.style, w.notes,
        w.account_name, w.age, w.occupation, w.industry, w.personality, w.persona, w.problem, w.profile_notes,
        w.directions_json, w.selected_index, w.content_json, w.updated_at
      FROM works w LEFT JOIN users u ON u.id = w.user_id
      ORDER BY w.updated_at DESC LIMIT 200`,
    )
    .all() as WorkRow[];
  const cases: { key: string; feature: string; title: string; user: string; output: string; platform: string; username: string; createdAt: string }[] = [];
  for (const row of rows) {
    const input = draftOf(row);
    if (!input) continue;
    if (row.directions_json && !covered.has(`directions:${row.id}`)) {
      cases.push({
        key: `work:directions:${row.id}`,
        feature: "directions",
        title: row.theme,
        user: draftBrief(input),
        output: row.directions_json,
        platform: row.platform,
        username: row.username,
        createdAt: row.updated_at,
      });
    }
    if (row.content_json && row.directions_json && row.selected_index != null && !covered.has(`content:${row.id}`)) {
      let directions: Direction[] = [];
      try {
        directions = JSON.parse(row.directions_json) as Direction[];
      } catch {
        directions = [];
      }
      const direction = directions[row.selected_index];
      if (direction) {
        cases.push({
          key: `work:content:${row.id}`,
          feature: "content",
          title: row.theme,
          user: contentUserMessage(input, direction),
          output: row.content_json,
          platform: row.platform,
          username: row.username,
          createdAt: row.updated_at,
        });
      }
    }
  }
  return cases;
}

export function resolveCase(key: string, featureHint?: FeatureId): EvalCaseRef | null {
  if (key.startsWith("gold:") && featureHint) {
    return resolveLibraryCase(key, featureHint);
  }
  if (key.startsWith("manual:")) {
    const id = Number(key.slice(7));
    const row = database().prepare("SELECT feature, title, input_json FROM eval_cases WHERE id = ?").get(id) as
      | { feature: string; title: string; input_json: string }
      | undefined;
    if (!row || !isFeatureId(row.feature)) return null;
    const input = readInput(row.input_json);
    return { key, feature: row.feature, title: row.title, user: input.user, platform: input.platform, original: null };
  }
  if (key.startsWith("sample:")) {
    const id = Number(key.slice(7));
    const row = database()
      .prepare("SELECT feature, input_json, output_text, platform FROM generation_samples WHERE id = ? AND excluded = 0")
      .get(id) as { feature: string; input_json: string; output_text: string; platform: string } | undefined;
    if (!row || !isFeatureId(row.feature)) return null;
    const input = readInput(row.input_json);
    return { key, feature: row.feature, title: `真实使用 #${id}`, user: input.user, platform: row.platform || input.platform, original: row.output_text };
  }
  const work = listWorkCases().find((item) => item.key === key);
  if (!work || !isFeatureId(work.feature)) return null;
  return { key, feature: work.feature, title: work.title, user: work.user, platform: work.platform, original: work.output };
}

function cardJson(card: ScoreCard) {
  return JSON.stringify(card);
}

export async function runBatch(input: { feature: FeatureId; officialVersionId: number; variantVersionId: number; keys: string[] }) {
  const official = getPromptVersion(input.officialVersionId);
  const variant = getVariantVersion(input.variantVersionId);
  if (!official || official.feature !== input.feature) return { ok: false as const, error: "请选择这个功能的正式版本" };
  if (!variant || variant.feature !== input.feature) return { ok: false as const, error: "请选择这个功能的试验版本" };
  const cases = input.keys.map((key) => resolveCase(key, input.feature)).filter((item): item is EvalCaseRef => item != null && item.feature === input.feature);
  if (cases.length === 0) return { ok: false as const, error: "至少选择一条这个功能的用例" };
  const batch = randomBytes(4).toString("hex");
  const created = now();
  for (const item of cases) {
    const left = await oneSide(official.body, item);
    const right = await oneSide(variant.body, item);
    const failed = (message: string): ScoreCard => ({ pass: false, summary: message, chars: 0, failures: [{ code: "error", message }], metrics: [] });
    const scoredA = left.error ? failed(left.error) : scoreOutput(item.feature, item.user, left.text, item.platform);
    const scoredB = right.error ? failed(right.error) : scoreOutput(item.feature, item.user, right.text, item.platform);
    database()
      .prepare(
        `INSERT INTO eval_runs (batch, case_key, case_title, feature, official_version_id, variant_version_id, input_json, original_output, output_a, output_b, scores_a, scores_b, ms_a, ms_b, error_a, error_b, flip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        batch,
        item.key,
        item.title,
        item.feature,
        official.id,
        variant.id,
        JSON.stringify({ user: item.user, platform: item.platform }),
        item.original,
        left.text,
        right.text,
        cardJson(scoredA),
        cardJson(scoredB),
        left.ms,
        right.ms,
        left.error,
        right.error,
        Math.random() < 0.5 ? 1 : 0,
        created,
      );
  }
  return { ok: true as const, batch };
}

async function oneSide(system: string, item: EvalCaseRef) {
  try {
    const result = await runEvalCompletion(system, item.user);
    return { text: result.text, ms: result.ms, error: "" };
  } catch (error) {
    return { text: "", ms: null as number | null, error: error instanceof Error ? error.message : "生成失败" };
  }
}

export async function testPrompt(input: { feature: FeatureId; body: string; keys: string[] }) {
  const system = input.body.trim();
  if (!system) return { ok: false as const, error: "提示词不能为空" };
  const cases = input.keys.map((key) => resolveCase(key, input.feature)).filter((item): item is EvalCaseRef => item != null && item.feature === input.feature);
  if (cases.length === 0) return { ok: false as const, error: "至少选择一条这个功能的用例" };
  const failed = (message: string): ScoreCard => ({ pass: false, summary: message, chars: 0, failures: [{ code: "error", message }], metrics: [] });
  const results = [];
  for (const item of cases) {
    const side = await oneSide(system, item);
    const scored = side.error ? failed(side.error) : scoreOutput(item.feature, item.user, side.text, item.platform);
    results.push({ title: item.title, text: side.text, error: side.error, summary: scored.summary });
  }
  return { ok: true as const, results };
}

export type BatchRun = {
  id: number;
  caseKey: string;
  title: string;
  feature: string;
  officialVersionId: number | null;
  variantVersionId: number | null;
  input: string;
  platform: string;
  original: string | null;
  outputA: string;
  outputB: string;
  scoreA: ScoreCard;
  scoreB: ScoreCard;
  msA: number | null;
  msB: number | null;
  errorA: string;
  errorB: string;
  flip: boolean;
  winner: string | null;
};

function parseFailures(value: unknown): HardFailure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { code?: unknown; message?: unknown };
    const code = typeof row.code === "string" ? row.code : "";
    const message = typeof row.message === "string" ? row.message : "";
    if (!code && !message) return [];
    return [{ code: code || "unknown", message: message || code }];
  });
}

function parseMetrics(value: unknown): ScoreMetric[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { label?: unknown; value?: unknown };
    const label = typeof row.label === "string" ? row.label : "";
    const metric = typeof row.value === "string" ? row.value : "";
    if (!label && !metric) return [];
    return [{ label: label || "指标", value: metric }];
  });
}

function parseCard(text: string): ScoreCard {
  try {
    const data = JSON.parse(text) as ScoreCard;
    return {
      pass: Boolean(data.pass),
      summary: String(data.summary || ""),
      chars: Number(data.chars) || 0,
      failures: parseFailures(data.failures),
      metrics: parseMetrics(data.metrics),
    };
  } catch {
    return { pass: false, summary: "没有分数", chars: 0, failures: [{ code: "error", message: "没有分数" }], metrics: [] };
  }
}

export function listBatches() {
  return (
    database()
      .prepare(
        `SELECT batch, feature, COUNT(*) AS n, MIN(created_at) AS created_at, MIN(official_version_id) AS official_version_id, MIN(variant_version_id) AS variant_version_id
        FROM eval_runs GROUP BY batch ORDER BY created_at DESC LIMIT 30`,
      )
      .all() as { batch: string; feature: string; n: number; created_at: string; official_version_id: number | null; variant_version_id: number | null }[]
  ).map((row) => ({
    batch: row.batch,
    feature: row.feature,
    count: Number(row.n),
    createdAt: row.created_at,
    officialVersionId: row.official_version_id,
    variantVersionId: row.variant_version_id,
  }));
}

export function getBatch(batch: string): BatchRun[] {
  const votes = new Map(
    (database().prepare("SELECT case_key, winner FROM eval_votes WHERE batch = ?").all(batch) as { case_key: string; winner: string }[]).map((row) => [row.case_key, row.winner]),
  );
  const rows = database().prepare("SELECT * FROM eval_runs WHERE batch = ? ORDER BY id").all(batch) as {
    id: number;
    case_key: string;
    case_title: string;
    feature: string;
    official_version_id: number | null;
    variant_version_id: number | null;
    input_json: string;
    original_output: string | null;
    output_a: string | null;
    output_b: string | null;
    scores_a: string;
    scores_b: string;
    ms_a: number | null;
    ms_b: number | null;
    error_a: string;
    error_b: string;
    flip: number;
  }[];
  return rows.map((row) => {
    const input = readInput(row.input_json);
    return {
      id: Number(row.id),
      caseKey: row.case_key,
      title: row.case_title,
      feature: row.feature,
      officialVersionId: row.official_version_id,
      variantVersionId: row.variant_version_id,
      input: input.user,
      platform: input.platform,
      original: row.original_output,
      outputA: row.output_a ?? "",
      outputB: row.output_b ?? "",
      scoreA: parseCard(row.scores_a),
      scoreB: parseCard(row.scores_b),
      msA: row.ms_a,
      msB: row.ms_b,
      errorA: row.error_a,
      errorB: row.error_b,
      flip: row.flip === 1,
      winner: votes.get(row.case_key) ?? null,
    };
  });
}

export function saveVote(batch: string, caseKey: string, winner: "left" | "right" | "tie") {
  const exists = database().prepare("SELECT id, flip, case_title, feature FROM eval_runs WHERE batch = ? AND case_key = ?").get(batch, caseKey) as
    | { id: number; flip: number; case_title: string; feature: string }
    | undefined;
  if (!exists) return { ok: false as const, error: "没有这条对比" };
  database()
    .prepare(
      `INSERT INTO eval_votes (batch, case_key, winner, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(batch, case_key) DO UPDATE SET winner = excluded.winner, created_at = excluded.created_at`,
    )
    .run(batch, caseKey, winner, now());
  if (winner !== "tie") {
    const leftIsOfficial = exists.flip !== 1;
    const officialWon = (winner === "left" && leftIsOfficial) || (winner === "right" && !leftIsOfficial);
    if (!officialWon) {
      addCandidate(exists.case_title, `盲选试验版胜出（${exists.feature}）`, { batch, caseKey, feature: exists.feature });
    }
  }
  return { ok: true as const };
}
