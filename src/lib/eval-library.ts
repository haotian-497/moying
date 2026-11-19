import { database } from "@/lib/db";
import { contentUserMessage, draftBrief } from "@/lib/llm";
import { isFeatureId, type FeatureId } from "@/lib/features";
import {
  isPlatform,
  type Direction,
  type DraftInput,
  type Work,
  type WorkHotspot,
  type WorkSection,
} from "@/lib/types";

export type LibraryKind = "gold" | "anti";
export type LibraryPath = "main" | "spoken";

export type FrozenPipeline = {
  draft: DraftInput;
  voiceDigest: string;
  path: LibraryPath;
};

export type EvalLibraryItem = {
  id: number;
  kind: LibraryKind;
  path: LibraryPath;
  title: string;
  feature: string;
  tags: string[];
  frozen: FrozenPipeline;
  baseline: unknown;
  sourceType: string;
  sourceRef: string;
  createdAt: string;
};

function now() {
  return new Date().toISOString();
}

function parseTags(text: string) {
  try {
    const data = JSON.parse(text) as unknown;
    return Array.isArray(data) ? data.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function parseFrozen(text: string): FrozenPipeline | null {
  try {
    const data = JSON.parse(text) as { draft?: DraftInput; voiceDigest?: string; path?: string };
    if (!data?.draft || !isPlatform(data.draft.platform)) return null;
    return {
      draft: data.draft,
      voiceDigest: typeof data.voiceDigest === "string" ? data.voiceDigest : "",
      path: data.path === "spoken" ? "spoken" : "main",
    };
  } catch {
    return null;
  }
}

function mapRow(row: {
  id: number;
  kind: string;
  path: string;
  title: string;
  feature: string;
  tags_json: string;
  frozen_json: string;
  baseline_json: string | null;
  source_type: string;
  source_ref: string;
  created_at: string;
}): EvalLibraryItem | null {
  const frozen = parseFrozen(row.frozen_json);
  if (!frozen) return null;
  let baseline: unknown = null;
  if (row.baseline_json) {
    try {
      baseline = JSON.parse(row.baseline_json);
    } catch {
      baseline = null;
    }
  }
  return {
    id: Number(row.id),
    kind: row.kind === "anti" ? "anti" : "gold",
    path: row.path === "spoken" ? "spoken" : "main",
    title: row.title,
    feature: row.feature,
    tags: parseTags(row.tags_json),
    frozen,
    baseline,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    createdAt: row.created_at,
  };
}

export function listLibrary(kind?: LibraryKind) {
  const rows = (
    kind
      ? database()
          .prepare(
            `SELECT id, kind, path, title, feature, tags_json, frozen_json, baseline_json, source_type, source_ref, created_at
             FROM eval_library WHERE kind = ? ORDER BY id DESC LIMIT 300`,
          )
          .all(kind)
      : database()
          .prepare(
            `SELECT id, kind, path, title, feature, tags_json, frozen_json, baseline_json, source_type, source_ref, created_at
             FROM eval_library ORDER BY id DESC LIMIT 300`,
          )
          .all()
  ) as {
    id: number;
    kind: string;
    path: string;
    title: string;
    feature: string;
    tags_json: string;
    frozen_json: string;
    baseline_json: string | null;
    source_type: string;
    source_ref: string;
    created_at: string;
  }[];
  return rows.map(mapRow).filter((item): item is EvalLibraryItem => item != null);
}

export function getLibraryItem(id: number) {
  const row = database()
    .prepare(
      `SELECT id, kind, path, title, feature, tags_json, frozen_json, baseline_json, source_type, source_ref, created_at
       FROM eval_library WHERE id = ?`,
    )
    .get(id) as
    | {
        id: number;
        kind: string;
        path: string;
        title: string;
        feature: string;
        tags_json: string;
        frozen_json: string;
        baseline_json: string | null;
        source_type: string;
        source_ref: string;
        created_at: string;
      }
    | undefined;
  return row ? mapRow(row) : null;
}

export function deleteLibraryItem(id: number) {
  database().prepare("DELETE FROM eval_library WHERE id = ?").run(id);
}

function insertLibrary(input: {
  kind: LibraryKind;
  path: LibraryPath;
  title: string;
  feature: string;
  tags: string[];
  frozen: FrozenPipeline;
  baseline?: unknown;
  sourceType: string;
  sourceRef: string;
}) {
  const title = input.title.trim().slice(0, 80);
  if (title.length < 2) return { ok: false as const, error: "请填写标题" };
  const result = database()
    .prepare(
      `INSERT INTO eval_library (kind, path, title, feature, tags_json, frozen_json, baseline_json, source_type, source_ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.kind,
      input.path,
      title,
      input.feature,
      JSON.stringify(input.tags.slice(0, 12)),
      JSON.stringify(input.frozen),
      input.baseline == null ? null : JSON.stringify(input.baseline),
      input.sourceType,
      input.sourceRef,
      now(),
    );
  return { ok: true as const, id: Number(result.lastInsertRowid) };
}

export function draftFromWork(work: {
  theme: string;
  platform: string;
  audience: string;
  length: string;
  style: string;
  notes: string;
  accountId: number | null;
  accountName: string;
  age: string;
  occupation: string;
  industry: string;
  personality: string;
  persona: string;
  problem: string;
  profileNotes: string;
  hotspot: WorkHotspot | null;
  section: WorkSection | null;
  inputs: Record<string, string>;
}): DraftInput | null {
  if (!isPlatform(work.platform)) return null;
  return {
    theme: work.theme,
    platform: work.platform,
    style: work.style,
    notes: work.notes,
    accountId: work.accountId,
    accountName: work.accountName,
    audience: work.audience,
    length: work.length,
    reader: work.audience,
    age: work.age,
    occupation: work.occupation,
    industry: work.industry,
    personality: work.personality,
    persona: work.persona,
    problem: work.problem,
    profileNotes: work.profileNotes,
    hotspot: work.hotspot,
    section: work.section,
    inputs: work.inputs ?? {},
  };
}

function tagsFromDraft(draft: DraftInput, path: LibraryPath) {
  const tags = [draft.platform, draft.style || "无风格", draft.hotspot?.title ? "有热点" : "无热点"];
  if (draft.section?.name) tags.push(`栏目:${draft.section.name}`);
  if (path === "spoken") tags.push("口播路径");
  return tags.filter(Boolean);
}

export function addManualGold(input: {
  title: string;
  draft: DraftInput;
  path?: LibraryPath;
  tags?: string[];
  kind?: LibraryKind;
  voiceDigest?: string;
}) {
  const path = input.path === "spoken" ? "spoken" : "main";
  const frozen: FrozenPipeline = {
    draft: input.draft,
    voiceDigest: input.voiceDigest?.trim() ?? "",
    path,
  };
  return insertLibrary({
    kind: input.kind === "anti" ? "anti" : "gold",
    path,
    title: input.title,
    feature: "pipeline",
    tags: input.tags?.length ? input.tags : tagsFromDraft(input.draft, path),
    frozen,
    sourceType: "manual",
    sourceRef: "",
  });
}

export function promoteSampleToLibrary(sampleId: number, kind: LibraryKind) {
  const row = database()
    .prepare(
      `SELECT id, feature, input_json, output_text, platform, work_id FROM generation_samples WHERE id = ? AND excluded = 0`,
    )
    .get(sampleId) as
    | { id: number; feature: string; input_json: string; output_text: string; platform: string; work_id: number | null }
    | undefined;
  if (!row || !isFeatureId(row.feature)) return { ok: false as const, error: "找不到这条真实使用" };

  if (row.work_id) {
    const work = database().prepare("SELECT * FROM works WHERE id = ?").get(row.work_id) as Record<string, unknown> | undefined;
    if (work) {
      const mapped = mapWorkRow(work);
      const draft = mapped ? draftFromWork(mapped) : null;
      if (draft) {
        const path: LibraryPath = draft.platform === "douyin" || draft.platform === "shipinhao" ? "spoken" : "main";
        return insertLibrary({
          kind,
          path,
          title: draft.theme || `真实使用 #${sampleId}`,
          feature: row.feature,
          tags: [...tagsFromDraft(draft, path), "真实使用"],
          frozen: { draft, voiceDigest: "", path },
          baseline: { feature: row.feature, output: row.output_text },
          sourceType: "sample",
          sourceRef: String(sampleId),
        });
      }
    }
  }

  let user = "";
  let platformRaw = row.platform;
  try {
    const data = JSON.parse(row.input_json) as { user?: string; platform?: string };
    user = typeof data.user === "string" ? data.user : row.input_json;
    if (typeof data.platform === "string" && data.platform) platformRaw = data.platform;
  } catch {
    user = row.input_json;
  }
  const platform = isPlatform(platformRaw) ? platformRaw : "xiaohongshu";
  const draft: DraftInput = {
    theme: user.slice(0, 40) || `真实使用 #${sampleId}`,
    platform,
    style: "真诚分享",
    notes: "",
    accountId: null,
    accountName: "",
    audience: "",
    length: "",
    reader: "",
    age: "",
    occupation: "",
    industry: "",
    personality: "",
    persona: "",
    problem: "",
    profileNotes: user.slice(0, 2000),
    hotspot: null,
    section: null,
    inputs: {},
  };
  return insertLibrary({
    kind,
    path: "main",
    title: draft.theme,
    feature: row.feature,
    tags: [...tagsFromDraft(draft, "main"), "真实使用", "弱冻结"],
    frozen: { draft, voiceDigest: "", path: "main" },
    baseline: { feature: row.feature, output: row.output_text, user },
    sourceType: "sample",
    sourceRef: String(sampleId),
  });
}

function mapWorkRow(row: Record<string, unknown>): Work | null {
  if (!isPlatform(String(row.platform || ""))) return null;
  let hotspot: WorkHotspot | null = null;
  let section: WorkSection | null = null;
  let inputs: Record<string, string> = {};
  try {
    if (typeof row.hotspot_json === "string" && row.hotspot_json) hotspot = JSON.parse(row.hotspot_json) as WorkHotspot;
  } catch {
    hotspot = null;
  }
  try {
    if (typeof row.section_json === "string" && row.section_json) section = JSON.parse(row.section_json) as WorkSection;
  } catch {
    section = null;
  }
  try {
    if (typeof row.inputs_json === "string" && row.inputs_json) inputs = JSON.parse(row.inputs_json) as Record<string, string>;
  } catch {
    inputs = {};
  }
  return {
    id: Number(row.id),
    theme: String(row.theme || ""),
    platform: row.platform as Work["platform"],
    audience: String(row.audience || ""),
    length: String(row.target_length || ""),
    style: String(row.style || ""),
    notes: String(row.notes || ""),
    accountId: row.account_id == null ? null : Number(row.account_id),
    accountName: String(row.account_name || ""),
    age: String(row.age || ""),
    occupation: String(row.occupation || ""),
    industry: String(row.industry || ""),
    personality: String(row.personality || ""),
    persona: String(row.persona || ""),
    problem: String(row.problem || ""),
    profileNotes: String(row.profile_notes || ""),
    hotspot,
    section,
    inputs,
    directions: null,
    selectedIndex: null,
    content: null,
    cues: null,
    variants: null,
    variantsStale: false,
    error: null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export function promoteWorkToLibrary(workId: number, kind: LibraryKind, path?: LibraryPath) {
  const row = database().prepare("SELECT * FROM works WHERE id = ?").get(workId) as Record<string, unknown> | undefined;
  if (!row) return { ok: false as const, error: "找不到这篇稿" };
  const work = mapWorkRow(row);
  const draft = work ? draftFromWork(work) : null;
  if (!draft) return { ok: false as const, error: "这篇稿不能冻结成评测用例" };
  const resolvedPath: LibraryPath =
    path === "spoken" || path === "main"
      ? path
      : draft.platform === "douyin" || draft.platform === "shipinhao"
        ? "spoken"
        : "main";
  let directions: Direction[] | null = null;
  let content: unknown = null;
  try {
    if (typeof row.directions_json === "string" && row.directions_json) directions = JSON.parse(row.directions_json) as Direction[];
  } catch {
    directions = null;
  }
  try {
    if (typeof row.content_json === "string" && row.content_json) content = JSON.parse(row.content_json);
  } catch {
    content = null;
  }
  return insertLibrary({
    kind,
    path: resolvedPath,
    title: draft.theme,
    feature: "pipeline",
    tags: [...tagsFromDraft(draft, resolvedPath), "历史稿子"],
    frozen: { draft, voiceDigest: "", path: resolvedPath },
    baseline: { directions, content },
    sourceType: "work",
    sourceRef: String(workId),
  });
}

export function libraryAsEvalCases(feature: FeatureId) {
  return listLibrary().flatMap((item) => {
    if (item.feature !== feature && item.feature !== "pipeline") return [];
    if (feature === "directions" || feature === "content" || feature === "review") {
      const user =
        feature === "directions"
          ? draftBrief(item.frozen.draft, { digest: item.frozen.voiceDigest, excerpts: [] })
          : feature === "content"
            ? (() => {
                const direction = (item.baseline as { directions?: Direction[] } | null)?.directions?.[0];
                if (!direction) return draftBrief(item.frozen.draft, { digest: item.frozen.voiceDigest, excerpts: [] });
                return contentUserMessage(item.frozen.draft, direction, { digest: item.frozen.voiceDigest, excerpts: [] });
              })()
            : JSON.stringify(item.baseline ?? item.frozen.draft);
      return [
        {
          key: `gold:${item.id}`,
          feature,
          title: `${item.kind === "anti" ? "反例" : "金标"} · ${item.title}`,
          user,
          platform: item.frozen.draft.platform,
          kind: item.kind === "anti" ? "反例" : "金标",
        },
      ];
    }
    return [];
  });
}

export function resolveLibraryCase(key: string, feature: FeatureId) {
  if (!key.startsWith("gold:")) return null;
  const id = Number(key.slice(5));
  const item = getLibraryItem(id);
  if (!item) return null;
  const cases = libraryAsEvalCases(feature).filter((entry) => entry.key === key);
  const hit = cases[0];
  if (!hit) return null;
  return {
    key,
    feature,
    title: hit.title,
    user: hit.user,
    platform: hit.platform,
    original: item.baseline ? JSON.stringify(item.baseline) : null,
  };
}

export function setEvalMeta(key: string, value: string) {
  database()
    .prepare(
      `INSERT INTO eval_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, now());
}

export function getEvalMeta(key: string) {
  const row = database().prepare("SELECT value FROM eval_meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function markL1Needed(reason: string) {
  setEvalMeta("l1_needed", "1");
  setEvalMeta("l1_needed_reason", reason);
  setEvalMeta("l1_needed_at", now());
}

export function clearL1Needed() {
  setEvalMeta("l1_needed", "0");
}

export function addCandidate(title: string, reason: string, payload: unknown) {
  database()
    .prepare(`INSERT INTO eval_candidates (title, reason, payload_json, status, created_at) VALUES (?, ?, ?, 'pending', ?)`)
    .run(title.slice(0, 80), reason.slice(0, 200), JSON.stringify(payload), now());
}

export function listCandidates(status = "pending") {
  return (
    database()
      .prepare(`SELECT id, title, reason, payload_json, status, created_at FROM eval_candidates WHERE status = ? ORDER BY id DESC LIMIT 50`)
      .all(status) as { id: number; title: string; reason: string; payload_json: string; status: string; created_at: string }[]
  ).map((row) => ({
    id: Number(row.id),
    title: row.title,
    reason: row.reason,
    payload: (() => {
      try {
        return JSON.parse(row.payload_json);
      } catch {
        return null;
      }
    })(),
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function resolveCandidate(id: number, status: "accepted" | "dismissed") {
  database().prepare("UPDATE eval_candidates SET status = ? WHERE id = ?").run(status, id);
}

export function acceptCandidateAsGold(id: number) {
  const row = database().prepare("SELECT payload_json FROM eval_candidates WHERE id = ?").get(id) as { payload_json: string } | undefined;
  if (!row) return { ok: false as const, error: "找不到候选" };
  let payload: { workId?: number; sampleId?: number; libraryId?: number; kind?: LibraryKind } = {};
  try {
    payload = JSON.parse(row.payload_json) as typeof payload;
  } catch {
    return { ok: false as const, error: "候选数据损坏" };
  }
  if (payload.libraryId) {
    resolveCandidate(id, "accepted");
    return { ok: true as const, id: payload.libraryId };
  }
  const kind = payload.kind === "anti" ? "anti" : "gold";
  let result: { ok: true; id: number } | { ok: false; error: string };
  if (payload.workId) result = promoteWorkToLibrary(payload.workId, kind);
  else if (payload.sampleId) result = promoteSampleToLibrary(payload.sampleId, kind);
  else {
    resolveCandidate(id, "accepted");
    return { ok: true as const, id: 0 };
  }
  if (!result.ok) return result;
  resolveCandidate(id, "accepted");
  return result;
}
