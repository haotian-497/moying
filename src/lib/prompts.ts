import { database } from "@/lib/db";
import { isFeatureId, type FeatureId } from "@/lib/features";

export type PromptVersion = {
  id: number;
  feature: string;
  body: string;
  note: string;
  source: string;
  createdBy: number | null;
  createdAt: string;
  author: string;
  active: boolean;
};

export type PromptVariant = {
  id: number;
  feature: string;
  name: string;
  createdAt: string;
  activeVersionId: number | null;
  versions: PromptVariantVersion[];
};

export type PromptVariantVersion = {
  id: number;
  variantId: number;
  body: string;
  note: string;
  source: string;
  createdAt: string;
  author: string;
  active: boolean;
};

function now() {
  return new Date().toISOString();
}

export function activePrompt(feature: string, seed: string) {
  try {
    ensurePromptSeed(feature, seed);
    const row = database()
      .prepare(
        `SELECT v.body FROM prompt_active a JOIN prompt_versions v ON v.id = a.version_id WHERE a.feature = ?`,
      )
      .get(feature) as { body: string } | undefined;
    return row?.body?.trim() ? row.body : seed;
  } catch (error) {
    console.error(error);
    return seed;
  }
}

export function activePromptId(feature: string) {
  const row = database().prepare("SELECT version_id FROM prompt_active WHERE feature = ?").get(feature) as { version_id: number } | undefined;
  return row ? Number(row.version_id) : null;
}

export function ensurePromptSeed(feature: string, seed: string) {
  if (!isFeatureId(feature)) return;
  const existing = database().prepare("SELECT id FROM prompt_versions WHERE feature = ? LIMIT 1").get(feature) as { id: number } | undefined;
  if (existing) {
    const active = database().prepare("SELECT version_id FROM prompt_active WHERE feature = ?").get(feature);
    if (!active) pointPrompt(feature, existing.id, null, "seed");
    return;
  }
  const created = now();
  const result = database()
    .prepare("INSERT INTO prompt_versions (feature, body, note, source, created_by, created_at) VALUES (?, ?, ?, '初始导入', NULL, ?)")
    .run(feature, seed, "代码中的初始提示词", created);
  pointPrompt(feature, Number(result.lastInsertRowid), null, "seed");
}

function pointPrompt(feature: string, versionId: number, userId: number | null, action: string) {
  database()
    .prepare(
      `INSERT INTO prompt_active (feature, version_id, action, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(feature) DO UPDATE SET version_id = excluded.version_id, action = excluded.action, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    )
    .run(feature, versionId, action, userId, now());
}

export function listPromptVersions(feature: FeatureId) {
  const rows = database()
    .prepare(
      `SELECT v.id, v.feature, v.body, v.note, v.source, v.created_by, v.created_at, COALESCE(u.username, '系统') AS author,
        CASE WHEN a.version_id = v.id THEN 1 ELSE 0 END AS active
      FROM prompt_versions v
      LEFT JOIN users u ON u.id = v.created_by
      LEFT JOIN prompt_active a ON a.feature = v.feature
      WHERE v.feature = ?
      ORDER BY v.id DESC`,
    )
    .all(feature) as {
    id: number;
    feature: string;
    body: string;
    note: string;
    source: string;
    created_by: number | null;
    created_at: string;
    author: string;
    active: number;
  }[];
  return rows.map((row) => ({
    id: Number(row.id),
    feature: row.feature,
    body: row.body,
    note: row.note,
    source: row.source,
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdAt: row.created_at,
    author: row.author,
    active: row.active === 1,
  }));
}

export function advancePromptSeed(feature: FeatureId, marker: string, body: string, note: string) {
  const current = database()
    .prepare(`SELECT v.body FROM prompt_active a JOIN prompt_versions v ON v.id = a.version_id WHERE a.feature = ?`)
    .get(feature) as { body: string } | undefined;
  const text = body.trim();
  if (!current?.body.includes(marker) || current.body.trim() === text) return;
  const result = database()
    .prepare("INSERT INTO prompt_versions (feature, body, note, source, created_by, created_at) VALUES (?, ?, ?, '初始导入', NULL, ?)")
    .run(feature, text, note.slice(0, 200), now());
  pointPrompt(feature, Number(result.lastInsertRowid), null, "seed");
}

export function savePromptVersion(feature: FeatureId, body: string, note: string, userId: number, source = "修改") {
  const text = body.trim();
  const why = note.trim();
  if (!text) return { ok: false as const, error: "提示词不能为空" };
  if (!why) return { ok: false as const, error: "请填写修改说明" };
  const current = database()
    .prepare(`SELECT v.body FROM prompt_active a JOIN prompt_versions v ON v.id = a.version_id WHERE a.feature = ?`)
    .get(feature) as { body: string } | undefined;
  if (current && current.body.trim() === text) return { ok: false as const, error: "和当前生效版相同" };
  const result = database()
    .prepare("INSERT INTO prompt_versions (feature, body, note, source, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(feature, text, why.slice(0, 200), source, userId, now());
  const id = Number(result.lastInsertRowid);
  pointPrompt(feature, id, userId, source === "从试验稿采用" ? "promote" : "edit");
  return { ok: true as const, id };
}

export function rollbackPrompt(feature: FeatureId, versionId: number, userId: number) {
  const row = database().prepare("SELECT id FROM prompt_versions WHERE id = ? AND feature = ?").get(versionId, feature) as { id: number } | undefined;
  if (!row) return { ok: false as const, error: "没有这一版" };
  const active = activePromptId(feature);
  if (active === versionId) return { ok: false as const, error: "这一版已经在生效" };
  pointPrompt(feature, versionId, userId, "rollback");
  return { ok: true as const };
}

export function listVariants(feature?: string) {
  const rows = database()
    .prepare(`SELECT id, feature, name, created_at FROM prompt_variants ${feature ? "WHERE feature = ?" : ""} ORDER BY id DESC`)
    .all(...(feature ? [feature] : [])) as { id: number; feature: string; name: string; created_at: string }[];
  return rows.map((row) => {
    const versions = listVariantVersions(Number(row.id));
    return {
      id: Number(row.id),
      feature: row.feature,
      name: row.name,
      createdAt: row.created_at,
      activeVersionId: versions.find((item) => item.active)?.id ?? null,
      versions,
    };
  });
}

export function listVariantVersions(variantId: number): PromptVariantVersion[] {
  const rows = database()
    .prepare(
      `SELECT v.id, v.variant_id, v.body, v.note, v.source, v.created_at, COALESCE(u.username, '系统') AS author,
        CASE WHEN a.version_id = v.id THEN 1 ELSE 0 END AS active
      FROM prompt_variant_versions v
      LEFT JOIN users u ON u.id = v.created_by
      LEFT JOIN prompt_variant_active a ON a.variant_id = v.variant_id
      WHERE v.variant_id = ?
      ORDER BY v.id DESC`,
    )
    .all(variantId) as {
    id: number;
    variant_id: number;
    body: string;
    note: string;
    source: string;
    created_at: string;
    author: string;
    active: number;
  }[];
  return rows.map((row) => ({
    id: Number(row.id),
    variantId: Number(row.variant_id),
    body: row.body,
    note: row.note,
    source: row.source,
    createdAt: row.created_at,
    author: row.author,
    active: row.active === 1,
  }));
}

function pointVariant(variantId: number, versionId: number, userId: number | null, action: string) {
  database()
    .prepare(
      `INSERT INTO prompt_variant_active (variant_id, version_id, action, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(variant_id) DO UPDATE SET version_id = excluded.version_id, action = excluded.action, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    )
    .run(variantId, versionId, action, userId, now());
}

export function createVariant(feature: FeatureId, name: string, body: string, note: string, userId: number) {
  const title = name.trim();
  const text = body.trim();
  const why = note.trim();
  if (!title) return { ok: false as const, error: "请填写试验名称" };
  if (!text) return { ok: false as const, error: "试验提示词不能为空" };
  if (!why) return { ok: false as const, error: "请填写修改说明" };
  const created = database()
    .prepare("INSERT INTO prompt_variants (feature, name, created_at) VALUES (?, ?, ?)")
    .run(feature, title.slice(0, 40), now());
  const variantId = Number(created.lastInsertRowid);
  const version = database()
    .prepare("INSERT INTO prompt_variant_versions (variant_id, body, note, source, created_by, created_at) VALUES (?, ?, ?, '新建', ?, ?)")
    .run(variantId, text, why.slice(0, 200), userId, now());
  pointVariant(variantId, Number(version.lastInsertRowid), userId, "create");
  return { ok: true as const, id: variantId };
}

export function saveVariantVersion(variantId: number, body: string, note: string, userId: number) {
  const variant = database().prepare("SELECT id FROM prompt_variants WHERE id = ?").get(variantId);
  if (!variant) return { ok: false as const, error: "没有这条试验" };
  const text = body.trim();
  const why = note.trim();
  if (!text) return { ok: false as const, error: "试验提示词不能为空" };
  if (!why) return { ok: false as const, error: "请填写这次根据什么结果修改" };
  const result = database()
    .prepare("INSERT INTO prompt_variant_versions (variant_id, body, note, source, created_by, created_at) VALUES (?, ?, ?, '按结果修改', ?, ?)")
    .run(variantId, text, why.slice(0, 200), userId, now());
  const id = Number(result.lastInsertRowid);
  pointVariant(variantId, id, userId, "edit");
  return { ok: true as const, id };
}

export function rollbackVariant(variantId: number, versionId: number, userId: number) {
  const row = database()
    .prepare("SELECT id FROM prompt_variant_versions WHERE id = ? AND variant_id = ?")
    .get(versionId, variantId) as { id: number } | undefined;
  if (!row) return { ok: false as const, error: "没有这一版" };
  const active = database().prepare("SELECT version_id FROM prompt_variant_active WHERE variant_id = ?").get(variantId) as { version_id: number } | undefined;
  if (active && Number(active.version_id) === versionId) return { ok: false as const, error: "这一版已经是当前试验稿" };
  pointVariant(variantId, versionId, userId, "rollback");
  return { ok: true as const };
}

export function getVariantVersion(versionId: number) {
  return database()
    .prepare(
      `SELECT v.id, v.body, v.variant_id, p.feature, p.name
      FROM prompt_variant_versions v JOIN prompt_variants p ON p.id = v.variant_id WHERE v.id = ?`,
    )
    .get(versionId) as { id: number; body: string; variant_id: number; feature: string; name: string } | undefined;
}

export function getPromptVersion(versionId: number) {
  return database().prepare("SELECT id, feature, body, note, created_at FROM prompt_versions WHERE id = ?").get(versionId) as
    | { id: number; feature: string; body: string; note: string; created_at: string }
    | undefined;
}
