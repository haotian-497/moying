import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword } from "@/lib/password";
import { EMPTY_PERSONAL, isPlatform, isPublishPlatform, sameTopic, STYLES, type AccountIdea, type AccountWriting, type ContentSection, type CopyContent, type Direction, type DraftInput, type MediaAccount, type MediaAccountInput, type PersonalFields, type PersonalProfile, type Platform, type PlatformCopy, type SectionField, type SpokenCues, type TopicPoolItem, type VoiceSample, type Work, type WorkHotspot, type WorkSection, type WorkSummary } from "@/lib/types";

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  is_guest: number;
  is_admin: number;
  created_at: string;
};

type WorkRow = {
  id: number;
  user_id: number;
  theme: string;
  platform: string;
  audience: string;
  style: string;
  notes: string;
  target_length: string;
  account_id: number | null;
  account_name: string;
  age: string;
  occupation: string;
  industry: string;
  personality: string;
  persona: string;
  problem: string;
  profile_notes: string;
  hotspot_json: string | null;
  section_json: string | null;
  inputs_json: string | null;
  directions_json: string | null;
  selected_index: number | null;
  content_json: string | null;
  cues_json: string | null;
  variants_json: string | null;
  variants_stale: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type SummaryRow = {
  id: number;
  theme: string;
  platform: string;
  style: string;
  has_directions: number;
  has_content: number;
  updated_at: string;
};

const globalForDb = globalThis as unknown as { moyinDb?: DatabaseSync };

function columnNames(db: DatabaseSync, table: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((column) => column.name);
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_profiles (
      user_id INTEGER PRIMARY KEY,
      platforms TEXT NOT NULL DEFAULT '[]',
      persona TEXT NOT NULL DEFAULT '',
      problem TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  const userColumns = columnNames(db, "users");
  if (!userColumns.includes("is_guest")) {
    db.exec("ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
  }
  if (!userColumns.includes("is_admin")) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      feature TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      ok INTEGER NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_usage_feature ON usage_events(feature, created_at);
    CREATE TABLE IF NOT EXISTS generation_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_text TEXT NOT NULL,
      prompt_version_id INTEGER,
      user_id INTEGER,
      work_id INTEGER,
      platform TEXT NOT NULL DEFAULT '',
      excluded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_samples_feature ON generation_samples(feature, created_at);
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature TEXT NOT NULL,
      body TEXT NOT NULL,
      note TEXT NOT NULL,
      source TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompt_active (
      feature TEXT PRIMARY KEY,
      version_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompt_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompt_variant_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      note TEXT NOT NULL,
      source TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS prompt_variant_active (
      variant_id INTEGER PRIMARY KEY,
      version_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      updated_by INTEGER,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS eval_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature TEXT NOT NULL,
      title TEXT NOT NULL,
      input_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS eval_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch TEXT NOT NULL,
      case_key TEXT NOT NULL,
      case_title TEXT NOT NULL,
      feature TEXT NOT NULL,
      official_version_id INTEGER,
      variant_version_id INTEGER,
      input_json TEXT NOT NULL,
      original_output TEXT,
      output_a TEXT,
      output_b TEXT,
      scores_a TEXT NOT NULL,
      scores_b TEXT NOT NULL,
      ms_a INTEGER,
      ms_b INTEGER,
      error_a TEXT NOT NULL DEFAULT '',
      error_b TEXT NOT NULL DEFAULT '',
      flip INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_eval_batch ON eval_runs(batch, id);
    CREATE TABLE IF NOT EXISTS eval_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch TEXT NOT NULL,
      case_key TEXT NOT NULL,
      winner TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(batch, case_key)
    );
    CREATE TABLE IF NOT EXISTS eval_library (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT 'main',
      title TEXT NOT NULL,
      feature TEXT NOT NULL DEFAULT 'pipeline',
      tags_json TEXT NOT NULL DEFAULT '[]',
      frozen_json TEXT NOT NULL,
      baseline_json TEXT,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_ref TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_eval_library_kind ON eval_library(kind, created_at);
    CREATE TABLE IF NOT EXISTS eval_pipeline_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch TEXT NOT NULL UNIQUE,
      note TEXT NOT NULL DEFAULT '',
      pass_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      pass_rate REAL,
      baseline_rate REAL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS eval_pipeline_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch TEXT NOT NULL,
      library_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      passed INTEGER NOT NULL,
      failures_json TEXT NOT NULL DEFAULT '[]',
      metrics_json TEXT NOT NULL DEFAULT '[]',
      directions_json TEXT,
      content_json TEXT,
      review_json TEXT,
      error TEXT NOT NULL DEFAULT '',
      ms INTEGER,
      human_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_eval_pipeline_batch ON eval_pipeline_results(batch, id);
    CREATE TABLE IF NOT EXISTS eval_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS eval_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const usageColumns = columnNames(db, "usage_events");
  if (!usageColumns.includes("latency_ms")) db.exec("ALTER TABLE usage_events ADD COLUMN latency_ms INTEGER");
  if (!usageColumns.includes("error")) db.exec("ALTER TABLE usage_events ADD COLUMN error TEXT NOT NULL DEFAULT ''");
  const workColumns = columnNames(db, "works");
  if (!workColumns.includes("persona")) db.exec("ALTER TABLE works ADD COLUMN persona TEXT NOT NULL DEFAULT ''");
  if (!workColumns.includes("problem")) db.exec("ALTER TABLE works ADD COLUMN problem TEXT NOT NULL DEFAULT ''");
  if (!workColumns.includes("profile_notes")) db.exec("ALTER TABLE works ADD COLUMN profile_notes TEXT NOT NULL DEFAULT ''");
  if (!workColumns.includes("hotspot_json")) db.exec("ALTER TABLE works ADD COLUMN hotspot_json TEXT");
  if (!workColumns.includes("section_json")) db.exec("ALTER TABLE works ADD COLUMN section_json TEXT");
  if (!workColumns.includes("inputs_json")) db.exec("ALTER TABLE works ADD COLUMN inputs_json TEXT");
  if (!workColumns.includes("target_length")) db.exec("ALTER TABLE works ADD COLUMN target_length TEXT NOT NULL DEFAULT ''");
  if (!workColumns.includes("cues_json")) db.exec("ALTER TABLE works ADD COLUMN cues_json TEXT");
  for (const table of ["account_profiles", "works"]) {
    const columns = columnNames(db, table);
    if (!columns.includes("age")) db.exec(`ALTER TABLE ${table} ADD COLUMN age TEXT NOT NULL DEFAULT ''`);
    if (!columns.includes("occupation")) db.exec(`ALTER TABLE ${table} ADD COLUMN occupation TEXT NOT NULL DEFAULT ''`);
    if (!columns.includes("industry")) db.exec(`ALTER TABLE ${table} ADD COLUMN industry TEXT NOT NULL DEFAULT ''`);
    if (!columns.includes("personality")) db.exec(`ALTER TABLE ${table} ADD COLUMN personality TEXT NOT NULL DEFAULT ''`);
  }
  splitProfiles(db);
  const mediaColumns = columnNames(db, "media_accounts");
  if (mediaColumns.length > 0) {
    if (!mediaColumns.includes("publish_platform")) db.exec("ALTER TABLE media_accounts ADD COLUMN publish_platform TEXT NOT NULL DEFAULT ''");
    if (!mediaColumns.includes("publish_style")) db.exec("ALTER TABLE media_accounts ADD COLUMN publish_style TEXT NOT NULL DEFAULT ''");
    if (!mediaColumns.includes("target_length")) db.exec("ALTER TABLE media_accounts ADD COLUMN target_length TEXT NOT NULL DEFAULT ''");
    if (!mediaColumns.includes("target_reader")) db.exec("ALTER TABLE media_accounts ADD COLUMN target_reader TEXT NOT NULL DEFAULT ''");
    if (!mediaColumns.includes("style_digest")) db.exec("ALTER TABLE media_accounts ADD COLUMN style_digest TEXT NOT NULL DEFAULT ''");
    if (!mediaColumns.includes("ideas_json")) db.exec("ALTER TABLE media_accounts ADD COLUMN ideas_json TEXT NOT NULL DEFAULT '[]'");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      guide TEXT NOT NULL DEFAULT '',
      fields_json TEXT NOT NULL DEFAULT '[]',
      sort INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES media_accounts(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sections_account ON sections(account_id, sort, id);
    CREATE TABLE IF NOT EXISTS topic_pool (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '手动',
      plan_date TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'idea',
      hotspot_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES media_accounts(id)
    );
    CREATE INDEX IF NOT EXISTS idx_topic_pool_account ON topic_pool(user_id, account_id, id);
  `);
}

function splitProfiles(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS personal_profiles (
      user_id INTEGER PRIMARY KEY,
      age TEXT NOT NULL DEFAULT '',
      occupation TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      personality TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS media_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      platforms TEXT NOT NULL DEFAULT '[]',
      persona TEXT NOT NULL DEFAULT '',
      problem TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_media_accounts_user ON media_accounts(user_id, updated_at);
  `);
  const workColumns = columnNames(db, "works");
  if (!workColumns.includes("account_id")) db.exec("ALTER TABLE works ADD COLUMN account_id INTEGER");
  if (!workColumns.includes("account_name")) db.exec("ALTER TABLE works ADD COLUMN account_name TEXT NOT NULL DEFAULT ''");
  if (!workColumns.includes("variants_json")) db.exec("ALTER TABLE works ADD COLUMN variants_json TEXT");
  if (!workColumns.includes("variants_stale")) db.exec("ALTER TABLE works ADD COLUMN variants_stale INTEGER NOT NULL DEFAULT 0");
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (account_id) REFERENCES media_accounts(id)
    );
    CREATE INDEX IF NOT EXISTS idx_voice_samples_account ON voice_samples(account_id, created_at);
  `);

  const legacy = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'account_profiles'").get();
  if (!legacy) return;
  const rows = db.prepare("SELECT * FROM account_profiles").all() as Record<string, unknown>[];
  const hasPersonal = db.prepare("SELECT user_id FROM personal_profiles WHERE user_id = ?");
  const hasMedia = db.prepare("SELECT id FROM media_accounts WHERE user_id = ? LIMIT 1");
  const insertPersonal = db.prepare(
    "INSERT INTO personal_profiles (user_id, age, occupation, industry, personality, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertMedia = db.prepare(
    `INSERT INTO media_accounts (user_id, name, platforms, persona, problem, audience, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const linkWorks = db.prepare("UPDATE works SET account_id = ?, account_name = ? WHERE user_id = ? AND account_id IS NULL");
  for (const row of rows) {
    const userId = Number(row.user_id);
    const updated = typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString();
    const age = typeof row.age === "string" ? row.age : "";
    const occupation = typeof row.occupation === "string" ? row.occupation : "";
    const industry = typeof row.industry === "string" ? row.industry : "";
    const personality = typeof row.personality === "string" ? row.personality : "";
    if (!hasPersonal.get(userId) && (age || occupation || industry || personality)) {
      insertPersonal.run(userId, age, occupation, industry, personality, updated);
    }
    if (!hasMedia.get(userId)) {
      const persona = typeof row.persona === "string" ? row.persona : "";
      const problem = typeof row.problem === "string" ? row.problem : "";
      const audience = typeof row.audience === "string" ? row.audience : "";
      const platforms = typeof row.platforms === "string" ? row.platforms : "[]";
      const notes = typeof row.notes === "string" ? row.notes : "";
      if (persona || problem || audience || (platforms && platforms !== "[]")) {
        const result = insertMedia.run(userId, "默认账号", platforms, persona, problem, audience, notes, updated, updated);
        linkWorks.run(Number(result.lastInsertRowid), "默认账号", userId);
      }
    }
  }
}

export function database() {
  if (!globalForDb.moyinDb) {
    const dir = path.join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, "zimeiti.db"));
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS works (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        theme TEXT NOT NULL,
        platform TEXT NOT NULL,
        audience TEXT NOT NULL DEFAULT '',
        style TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        directions_json TEXT,
        selected_index INTEGER,
        content_json TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_works_user ON works(user_id, updated_at);
    `);
    globalForDb.moyinDb = db;
  }
  migrate(globalForDb.moyinDb);
  return globalForDb.moyinDb;
}

function changed(result: { changes: number | bigint }) {
  return Number(result.changes) > 0;
}

export function isUniqueError(error: unknown) {
  return error instanceof Error && /UNIQUE/i.test(error.message);
}

export function createUser(username: string, passwordHash: string) {
  const now = new Date().toISOString();
  const result = database()
    .prepare("INSERT INTO users (username, password_hash, is_guest, created_at) VALUES (?, ?, 0, ?)")
    .run(username, passwordHash, now);
  return { id: Number(result.lastInsertRowid), username };
}

export function createGuestUser() {
  const now = new Date().toISOString();
  const username = `guest_${randomBytes(6).toString("hex")}`;
  const result = database()
    .prepare("INSERT INTO users (username, password_hash, is_guest, created_at) VALUES (?, ?, 1, ?)")
    .run(username, hashPassword(randomBytes(18).toString("hex")), now);
  return { id: Number(result.lastInsertRowid), username };
}

export function promoteGuest(id: number, username: string, passwordHash: string) {
  return changed(
    database()
      .prepare("UPDATE users SET username = ?, password_hash = ?, is_guest = 0 WHERE id = ? AND is_guest = 1")
      .run(username, passwordHash, id),
  );
}

export function claimGuestWorks(guestId: number, userId: number) {
  if (guestId === userId) return;
  const db = database();
  db.prepare("UPDATE works SET user_id = ? WHERE user_id = ?").run(userId, guestId);
  db.prepare("UPDATE media_accounts SET user_id = ? WHERE user_id = ?").run(userId, guestId);
  db.prepare("UPDATE voice_samples SET user_id = ? WHERE user_id = ?").run(userId, guestId);
  const guestPersonal = db.prepare("SELECT user_id FROM personal_profiles WHERE user_id = ?").get(guestId);
  const userPersonal = db.prepare("SELECT user_id FROM personal_profiles WHERE user_id = ?").get(userId);
  if (guestPersonal && !userPersonal) {
    db.prepare("UPDATE personal_profiles SET user_id = ? WHERE user_id = ?").run(userId, guestId);
  } else if (guestPersonal) {
    db.prepare("DELETE FROM personal_profiles WHERE user_id = ?").run(guestId);
  }
  db.prepare("DELETE FROM account_profiles WHERE user_id = ?").run(guestId);
  db.prepare("DELETE FROM users WHERE id = ? AND is_guest = 1").run(guestId);
}

type PersonalRow = PersonalFields & { updated_at: string };

type MediaRow = {
  id: number;
  name: string;
  platforms: string;
  persona: string;
  problem: string;
  audience: string;
  notes: string;
  publish_platform: string;
  publish_style: string;
  target_length: string;
  target_reader: string;
  style_digest: string;
  updated_at: string;
};

function readPlatforms(text: string): Platform[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is Platform => typeof item === "string" && isPlatform(item)))];
  } catch {
    return [];
  }
}

export function getPersonalProfile(userId: number): PersonalProfile {
  const row = database()
    .prepare("SELECT age, occupation, industry, personality, updated_at FROM personal_profiles WHERE user_id = ?")
    .get(userId) as PersonalRow | undefined;
  if (!row) return EMPTY_PERSONAL;
  return {
    age: row.age,
    occupation: row.occupation,
    industry: row.industry,
    personality: row.personality,
    updatedAt: row.updated_at,
  };
}

export function savePersonalProfile(userId: number, input: PersonalFields) {
  const now = new Date().toISOString();
  database()
    .prepare(
      `INSERT INTO personal_profiles (user_id, age, occupation, industry, personality, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         age = excluded.age,
         occupation = excluded.occupation,
         industry = excluded.industry,
         personality = excluded.personality,
         updated_at = excluded.updated_at`,
    )
    .run(userId, input.age, input.occupation, input.industry, input.personality, now);
  return getPersonalProfile(userId);
}

function mapMedia(row: MediaRow): MediaAccount {
  return {
    id: Number(row.id),
    name: row.name,
    platforms: readPlatforms(row.platforms),
    persona: row.persona,
    problem: row.problem,
    audience: row.audience,
    notes: row.notes,
    platform: isPublishPlatform(row.publish_platform) ? row.publish_platform : "wechat",
    style: (STYLES as readonly string[]).includes(row.publish_style) ? row.publish_style : STYLES[0],
    length: row.target_length ?? "",
    reader: row.target_reader ?? "",
    styleDigest: row.style_digest ?? "",
    updatedAt: row.updated_at,
  };
}

export function listMediaAccounts(userId: number) {
  const rows = database()
    .prepare(
      `SELECT id, name, platforms, persona, problem, audience, notes, publish_platform, publish_style, target_length, target_reader, style_digest, updated_at
       FROM media_accounts WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .all(userId) as MediaRow[];
  return rows.map(mapMedia);
}

export function getMediaAccount(userId: number, id: number) {
  const row = database()
    .prepare(
      `SELECT id, name, platforms, persona, problem, audience, notes, publish_platform, publish_style, target_length, target_reader, style_digest, updated_at
       FROM media_accounts WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as MediaRow | undefined;
  return row ? mapMedia(row) : null;
}

export function countMediaAccounts(userId: number) {
  const row = database().prepare("SELECT COUNT(*) AS n FROM media_accounts WHERE user_id = ?").get(userId) as { n: number | bigint };
  return Number(row.n);
}

export function insertMediaAccount(userId: number, input: MediaAccountInput) {
  const now = new Date().toISOString();
  const result = database()
    .prepare(
      `INSERT INTO media_accounts (user_id, name, platforms, persona, problem, audience, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, input.name, JSON.stringify(input.platforms), input.persona, input.problem, input.audience, input.notes, now, now);
  return getMediaAccount(userId, Number(result.lastInsertRowid));
}

export function updateMediaAccount(userId: number, id: number, input: MediaAccountInput) {
  const now = new Date().toISOString();
  const ok = changed(
    database()
      .prepare(
        `UPDATE media_accounts
         SET name = ?, platforms = ?, persona = ?, problem = ?, audience = ?, notes = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(input.name, JSON.stringify(input.platforms), input.persona, input.problem, input.audience, input.notes, now, id, userId),
  );
  return ok ? getMediaAccount(userId, id) : null;
}

export function saveAccountWriting(userId: number, id: number, input: AccountWriting) {
  const now = new Date().toISOString();
  const ok = changed(
    database()
      .prepare(
        `UPDATE media_accounts
         SET publish_platform = ?, publish_style = ?, target_length = ?, target_reader = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(input.platform, input.style, input.length, input.reader, now, id, userId),
  );
  return ok ? getMediaAccount(userId, id) : null;
}

export function deleteMediaAccount(userId: number, id: number) {
  const db = database();
  const owns = db.prepare("SELECT id FROM media_accounts WHERE id = ? AND user_id = ?").get(id, userId);
  if (!owns) return false;
  db.prepare("DELETE FROM voice_samples WHERE account_id = ? AND user_id = ?").run(id, userId);
  db.prepare("DELETE FROM sections WHERE account_id = ? AND user_id = ?").run(id, userId);
  db.prepare("DELETE FROM topic_pool WHERE account_id = ? AND user_id = ?").run(id, userId);
  const ok = changed(db.prepare("DELETE FROM media_accounts WHERE id = ? AND user_id = ?").run(id, userId));
  if (ok) db.prepare("UPDATE works SET account_id = NULL WHERE account_id = ? AND user_id = ?").run(id, userId);
  return ok;
}

export function listVoiceSamples(userId: number, accountId?: number): VoiceSample[] {
  const rows = (
    accountId
      ? database().prepare("SELECT id, account_id, text, source, created_at FROM voice_samples WHERE user_id = ? AND account_id = ? ORDER BY created_at DESC").all(userId, accountId)
      : database().prepare("SELECT id, account_id, text, source, created_at FROM voice_samples WHERE user_id = ? ORDER BY created_at DESC").all(userId)
  ) as { id: number; account_id: number; text: string; source: string; created_at: string }[];
  return rows.map((row) => ({
    id: Number(row.id),
    accountId: Number(row.account_id),
    text: row.text,
    source: row.source === "draft" ? "draft" : "paste",
    createdAt: row.created_at,
  }));
}

export function insertVoiceSample(userId: number, accountId: number, text: string, source: "paste" | "draft") {
  const db = database();
  if (!getMediaAccount(userId, accountId)) return { ok: false as const, error: "找不到这个账号设定" };
  const trimmed = text.trim();
  const existing = db.prepare("SELECT text FROM voice_samples WHERE user_id = ? AND account_id = ?").all(userId, accountId) as { text: string }[];
  if (existing.length >= 8) return { ok: false as const, error: "这个账号已经有 8 段语气样本，先删掉一条再加" };
  if (existing.some((item) => item.text.trim() === trimmed)) return { ok: false as const, error: "这段已经在语气样本里" };
  const now = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO voice_samples (user_id, account_id, text, source, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, accountId, trimmed, source, now);
  const sample = listVoiceSamples(userId, accountId).find((item) => item.id === Number(result.lastInsertRowid));
  if (!sample) return { ok: false as const, error: "语气样本没有保存" };
  return { ok: true as const, sample };
}

export function deleteVoiceSample(userId: number, id: number) {
  const row = database().prepare("SELECT account_id FROM voice_samples WHERE id = ? AND user_id = ?").get(id, userId) as { account_id: number } | undefined;
  if (!row) return null;
  database().prepare("DELETE FROM voice_samples WHERE id = ? AND user_id = ?").run(id, userId);
  return Number(row.account_id);
}

export function saveStyleDigest(userId: number, accountId: number, digest: string) {
  return changed(
    database().prepare("UPDATE media_accounts SET style_digest = ? WHERE id = ? AND user_id = ?").run(digest.slice(0, 4000), accountId, userId),
  );
}

function readFields(text: string): SectionField[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as { label?: unknown; hint?: unknown; required?: unknown };
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!label) return [];
      return [{ label, hint: typeof row.hint === "string" ? row.hint : "", required: row.required === true }];
    });
  } catch {
    return [];
  }
}

function mapSection(row: { id: number; account_id: number; name: string; purpose: string; guide: string; fields_json: string }): ContentSection {
  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    name: row.name,
    purpose: row.purpose,
    guide: row.guide,
    fields: readFields(row.fields_json),
  };
}

export function listSections(userId: number, accountId: number): ContentSection[] {
  const rows = database()
    .prepare("SELECT id, account_id, name, purpose, guide, fields_json FROM sections WHERE user_id = ? AND account_id = ? ORDER BY sort, id")
    .all(userId, accountId) as { id: number; account_id: number; name: string; purpose: string; guide: string; fields_json: string }[];
  return rows.map(mapSection);
}

export function getSection(userId: number, accountId: number, id: number) {
  const row = database()
    .prepare("SELECT id, account_id, name, purpose, guide, fields_json FROM sections WHERE id = ? AND user_id = ? AND account_id = ?")
    .get(id, userId, accountId) as { id: number; account_id: number; name: string; purpose: string; guide: string; fields_json: string } | undefined;
  return row ? mapSection(row) : null;
}

export function insertSection(userId: number, accountId: number, input: { name: string; purpose: string; guide: string; fields: SectionField[] }) {
  if (!getMediaAccount(userId, accountId)) return null;
  const count = database().prepare("SELECT COUNT(*) AS n FROM sections WHERE user_id = ? AND account_id = ?").get(userId, accountId) as { n: number };
  if (Number(count.n) >= 12) return null;
  const now = new Date().toISOString();
  const sort = database().prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM sections WHERE account_id = ?").get(accountId) as { n: number };
  const result = database()
    .prepare("INSERT INTO sections (user_id, account_id, name, purpose, guide, fields_json, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(userId, accountId, input.name, input.purpose, input.guide, JSON.stringify(input.fields), Number(sort.n), now, now);
  return getSection(userId, accountId, Number(result.lastInsertRowid));
}

export function updateSection(userId: number, accountId: number, id: number, input: { name: string; purpose: string; guide: string; fields: SectionField[] }) {
  const now = new Date().toISOString();
  const ok = changed(
    database()
      .prepare("UPDATE sections SET name = ?, purpose = ?, guide = ?, fields_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND account_id = ?")
      .run(input.name, input.purpose, input.guide, JSON.stringify(input.fields), now, id, userId, accountId),
  );
  return ok ? getSection(userId, accountId, id) : null;
}

export function deleteSection(userId: number, accountId: number, id: number) {
  return changed(database().prepare("DELETE FROM sections WHERE id = ? AND user_id = ? AND account_id = ?").run(id, userId, accountId));
}

export function listIdeas(userId: number, accountId: number): AccountIdea[] {
  const row = database().prepare("SELECT ideas_json FROM media_accounts WHERE id = ? AND user_id = ?").get(accountId, userId) as { ideas_json: string } | undefined;
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.ideas_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const idea = item as { title?: unknown; why?: unknown };
      const title = typeof idea.title === "string" ? idea.title.trim() : "";
      if (!title) return [];
      return [{ title, why: typeof idea.why === "string" ? idea.why.trim() : "" }];
    });
  } catch {
    return [];
  }
}

export function saveIdeas(userId: number, accountId: number, ideas: AccountIdea[]) {
  return changed(
    database()
      .prepare("UPDATE media_accounts SET ideas_json = ? WHERE id = ? AND user_id = ?")
      .run(JSON.stringify(ideas.slice(0, 3)), accountId, userId),
  );
}

export function dropIdea(userId: number, accountId: number, theme: string) {
  const left = listIdeas(userId, accountId).filter((idea) => !sameTopic(idea.title, theme));
  if (left.length === listIdeas(userId, accountId).length) return;
  saveIdeas(userId, accountId, left);
}

type PoolRow = {
  id: number;
  account_id: number;
  subject: string;
  note: string;
  source: string;
  plan_date: string;
  status: string;
  hotspot_json: string | null;
  created_at: string;
};

function mapPool(row: PoolRow): TopicPoolItem {
  return {
    id: Number(row.id),
    accountId: Number(row.account_id),
    subject: row.subject,
    note: row.note,
    source: row.source,
    planDate: row.plan_date,
    status: row.status === "done" ? "done" : "idea",
    hotspot: readJson<WorkHotspot>(row.hotspot_json),
    createdAt: row.created_at,
  };
}

export function listTopicPool(userId: number, accountId: number) {
  const rows = database()
    .prepare(
      `SELECT id, account_id, subject, note, source, plan_date, status, hotspot_json, created_at
       FROM topic_pool WHERE user_id = ? AND account_id = ?
       ORDER BY (plan_date = '') ASC, plan_date ASC, id DESC`,
    )
    .all(userId, accountId) as PoolRow[];
  return rows.map(mapPool);
}

export function insertTopicPool(
  userId: number,
  accountId: number,
  input: { subject: string; note: string; source: string; planDate: string; hotspot: WorkHotspot | null },
) {
  if (!getMediaAccount(userId, accountId)) return null;
  const now = new Date().toISOString();
  const result = database()
    .prepare(
      `INSERT INTO topic_pool (user_id, account_id, subject, note, source, plan_date, status, hotspot_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'idea', ?, ?)`,
    )
    .run(userId, accountId, input.subject, input.note, input.source, input.planDate, input.hotspot ? JSON.stringify(input.hotspot) : null, now);
  const row = database()
    .prepare("SELECT id, account_id, subject, note, source, plan_date, status, hotspot_json, created_at FROM topic_pool WHERE id = ? AND user_id = ?")
    .get(Number(result.lastInsertRowid), userId) as PoolRow | undefined;
  return row ? mapPool(row) : null;
}

export function updateTopicPool(
  userId: number,
  accountId: number,
  id: number,
  patch: { planDate?: string; status?: "idea" | "done" },
) {
  const current = database()
    .prepare("SELECT id, account_id, subject, note, source, plan_date, status, hotspot_json, created_at FROM topic_pool WHERE id = ? AND user_id = ? AND account_id = ?")
    .get(id, userId, accountId) as PoolRow | undefined;
  if (!current) return null;
  const planDate = patch.planDate === undefined ? current.plan_date : patch.planDate;
  const status = patch.status === undefined ? (current.status === "done" ? "done" : "idea") : patch.status;
  database()
    .prepare("UPDATE topic_pool SET plan_date = ?, status = ? WHERE id = ? AND user_id = ? AND account_id = ?")
    .run(planDate, status, id, userId, accountId);
  return mapPool({ ...current, plan_date: planDate, status });
}

export function deleteTopicPool(userId: number, accountId: number, id: number) {
  return changed(database().prepare("DELETE FROM topic_pool WHERE id = ? AND user_id = ? AND account_id = ?").run(id, userId, accountId));
}

export function saveReviewedContent(userId: number, id: number, content: CopyContent) {
  const existing = getWork(userId, id);
  if (!existing?.content) return null;
  const bodyChanged = content.body !== existing.content.body;
  const stale = bodyChanged ? (existing.variants && existing.variants.length > 0 ? 1 : 0) : existing.variantsStale ? 1 : 0;
  const now = new Date().toISOString();
  const ok = changed(
    database()
      .prepare(
        bodyChanged
          ? "UPDATE works SET content_json = ?, cues_json = NULL, variants_stale = ?, error = NULL, updated_at = ? WHERE id = ? AND user_id = ?"
          : "UPDATE works SET content_json = ?, variants_stale = ?, error = NULL, updated_at = ? WHERE id = ? AND user_id = ?",
      )
      .run(JSON.stringify(content), stale, now, id, userId),
  );
  return ok ? getWork(userId, id) : null;
}

export function saveWorkBody(userId: number, id: number, body: string) {
  const existing = getWork(userId, id);
  if (!existing?.content) return null;
  const changedBody = body !== existing.content.body;
  const content = { ...existing.content, body };
  if (changedBody) delete content.review;
  const stale = changedBody ? (existing.variants && existing.variants.length > 0 ? 1 : 0) : existing.variantsStale ? 1 : 0;
  const now = new Date().toISOString();
  const ok = changed(
    database()
      .prepare(
        changedBody
          ? "UPDATE works SET content_json = ?, cues_json = NULL, variants_stale = ?, error = NULL, updated_at = ? WHERE id = ? AND user_id = ?"
          : "UPDATE works SET content_json = ?, variants_stale = ?, error = NULL, updated_at = ? WHERE id = ? AND user_id = ?",
      )
      .run(JSON.stringify(content), stale, now, id, userId),
  );
  return ok ? getWork(userId, id) : null;
}

export function saveSpokenCues(userId: number, id: number, cues: SpokenCues) {
  const now = new Date().toISOString();
  const ok = changed(
    database()
      .prepare("UPDATE works SET cues_json = ?, error = NULL, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(JSON.stringify(cues), now, id, userId),
  );
  return ok ? getWork(userId, id) : null;
}

export function findUserByUsername(username: string) {
  return database()
    .prepare("SELECT id, username, password_hash, is_guest, is_admin, created_at FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;
}

export function findUserById(id: number) {
  return database()
    .prepare("SELECT id, username, password_hash, is_guest, is_admin, created_at FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
}

export function markAdmin(id: number) {
  database().prepare("UPDATE users SET is_admin = 1 WHERE id = ? AND is_guest = 0").run(id);
}

export function updateUserPassword(id: number, passwordHash: string) {
  return changed(
    database()
      .prepare("UPDATE users SET password_hash = ? WHERE id = ? AND is_guest = 0")
      .run(passwordHash, id),
  );
}

export function countAdmins() {
  const row = database().prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1 AND is_guest = 0").get() as { n: number };
  return Number(row.n);
}

export function setUserAdmin(id: number, admin: boolean, protectedUsername: string) {
  const user = findUserById(id);
  if (!user || user.is_guest === 1) return { ok: false as const, error: "只能标记注册用户" };
  if (!admin) {
    if (protectedUsername && user.username === protectedUsername) return { ok: false as const, error: "这个账号由配置指定，不能取消" };
    if (user.is_admin === 1 && countAdmins() <= 1) return { ok: false as const, error: "至少要留下一个管理员" };
  }
  database().prepare("UPDATE users SET is_admin = ? WHERE id = ? AND is_guest = 0").run(admin ? 1 : 0, id);
  return { ok: true as const };
}

export function recordUsage(event: {
  userId: number | null;
  feature: string;
  model: string;
  ok: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  error: string;
}) {
  try {
    database()
      .prepare(
        "INSERT INTO usage_events (user_id, feature, model, ok, input_tokens, output_tokens, latency_ms, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        event.userId,
        event.feature,
        event.model,
        event.ok ? 1 : 0,
        event.inputTokens,
        event.outputTokens,
        event.latencyMs,
        event.error.slice(0, 300),
        new Date().toISOString(),
      );
  } catch (error) {
    console.error(error);
  }
}

export function recordGenerationSample(sample: {
  feature: string;
  input: string;
  output: string;
  promptVersionId: number | null;
  userId: number | null;
  workId: number | null;
  platform: string;
}) {
  try {
    database()
      .prepare(
        `INSERT INTO generation_samples (feature, input_json, output_text, prompt_version_id, user_id, work_id, platform, excluded, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .run(
        sample.feature,
        JSON.stringify({ user: sample.input.slice(0, 20000), platform: sample.platform }),
        sample.output.slice(0, 20000),
        sample.promptVersionId,
        sample.userId,
        sample.workId,
        sample.platform,
        new Date().toISOString(),
      );
  } catch (error) {
    console.error(error);
  }
}

export type AdminUser = {
  id: number;
  username: string;
  guest: boolean;
  admin: boolean;
  createdAt: string;
  workCount: number;
  lastAt: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
};

export function listAdminUsers() {
  const rows = database()
    .prepare(
      `SELECT u.id, u.username, u.is_guest, u.is_admin, u.created_at,
        (SELECT COUNT(*) FROM works w WHERE w.user_id = u.id) AS work_count,
        (SELECT COUNT(*) FROM usage_events e WHERE e.user_id = u.id) AS calls,
        (SELECT COALESCE(SUM(input_tokens), 0) FROM usage_events e WHERE e.user_id = u.id) AS input_tokens,
        (SELECT COALESCE(SUM(output_tokens), 0) FROM usage_events e WHERE e.user_id = u.id) AS output_tokens,
        (
          SELECT MAX(ts) FROM (
            SELECT created_at AS ts FROM usage_events WHERE user_id = u.id
            UNION ALL
            SELECT updated_at FROM works WHERE user_id = u.id
          )
        ) AS last_at
      FROM users u
      ORDER BY u.created_at DESC`,
    )
    .all() as {
    id: number;
    username: string;
    is_guest: number;
    is_admin: number;
    created_at: string;
    work_count: number;
    calls: number;
    input_tokens: number;
    output_tokens: number;
    last_at: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    guest: row.is_guest === 1,
    admin: row.is_admin === 1,
    createdAt: row.created_at,
    workCount: Number(row.work_count),
    lastAt: row.last_at,
    calls: Number(row.calls),
    inputTokens: Number(row.input_tokens),
    outputTokens: Number(row.output_tokens),
  }));
}

export type UsageFeatureStat = {
  feature: string;
  calls: number;
  okCount: number;
  failCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  avgLatencyMs: number | null;
};

export function listUsageByFeature(since?: string | null) {
  const rows = database()
    .prepare(
      `SELECT feature, COUNT(*) AS calls, SUM(ok) AS ok_count,
        SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS fail_count,
        SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens,
        AVG(latency_ms) AS avg_latency
      FROM usage_events
      WHERE (? IS NULL OR created_at >= ?)
      GROUP BY feature
      ORDER BY calls DESC`,
    )
    .all(since ?? null, since ?? null) as {
    feature: string;
    calls: number;
    ok_count: number;
    fail_count: number;
    input_tokens: number | null;
    output_tokens: number | null;
    avg_latency: number | null;
  }[];
  return rows.map((row) => ({
    feature: row.feature,
    calls: Number(row.calls),
    okCount: Number(row.ok_count),
    failCount: Number(row.fail_count),
    inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens == null ? null : Number(row.output_tokens),
    avgLatencyMs: row.avg_latency == null ? null : Math.round(Number(row.avg_latency)),
  }));
}

export type UsageUserStat = {
  username: string;
  guest: boolean;
  calls: number;
  failCount: number;
};

export function listUsageByUser(since?: string | null) {
  const rows = database()
    .prepare(
      `SELECT COALESCE(u.username, '未知') AS username, COALESCE(u.is_guest, 0) AS is_guest,
        COUNT(e.id) AS calls, SUM(CASE WHEN e.ok = 0 THEN 1 ELSE 0 END) AS fail_count
      FROM usage_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE (? IS NULL OR e.created_at >= ?)
      GROUP BY e.user_id
      ORDER BY calls DESC`,
    )
    .all(since ?? null, since ?? null) as { username: string; is_guest: number; calls: number; fail_count: number }[];
  return rows.map((row) => ({
    username: row.username,
    guest: row.is_guest === 1,
    calls: Number(row.calls),
    failCount: Number(row.fail_count),
  }));
}

export type UsageEvent = {
  createdAt: string;
  feature: string;
  ok: boolean;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  error: string;
  username: string;
};

export function listRecentUsage(limit = 40, since?: string | null) {
  const rows = database()
    .prepare(
      `SELECT e.created_at, e.feature, e.ok, e.model, e.input_tokens, e.output_tokens, e.latency_ms, e.error,
        COALESCE(u.username, '未知') AS username
      FROM usage_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE (? IS NULL OR e.created_at >= ?)
      ORDER BY e.id DESC
      LIMIT ?`,
    )
    .all(since ?? null, since ?? null, limit) as {
    created_at: string;
    feature: string;
    ok: number;
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    latency_ms: number | null;
    error: string | null;
    username: string;
  }[];
  return rows.map((row) => ({
    createdAt: row.created_at,
    feature: row.feature,
    ok: row.ok === 1,
    model: row.model,
    inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens == null ? null : Number(row.output_tokens),
    latencyMs: row.latency_ms == null ? null : Number(row.latency_ms),
    error: row.error ?? "",
    username: row.username,
  }));
}

export function listRecentFailures(limit = 8, since?: string | null) {
  const rows = database()
    .prepare(
      `SELECT e.created_at, e.feature, e.ok, e.model, e.input_tokens, e.output_tokens, e.latency_ms, e.error,
        COALESCE(u.username, '未知') AS username
      FROM usage_events e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE e.ok = 0 AND (? IS NULL OR e.created_at >= ?)
      ORDER BY e.id DESC
      LIMIT ?`,
    )
    .all(since ?? null, since ?? null, limit) as {
    created_at: string;
    feature: string;
    ok: number;
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    latency_ms: number | null;
    error: string | null;
    username: string;
  }[];
  return rows.map((row) => ({
    createdAt: row.created_at,
    feature: row.feature,
    ok: false,
    model: row.model,
    inputTokens: row.input_tokens == null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens == null ? null : Number(row.output_tokens),
    latencyMs: row.latency_ms == null ? null : Number(row.latency_ms),
    error: row.error ?? "",
    username: row.username,
  }));
}

function readInputs(text: string | null): Record<string, string> {
  const parsed = readJson<unknown>(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const inputs: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.trim()) inputs[key] = value.trim();
  }
  return inputs;
}

function readJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function readVariants(text: string | null): PlatformCopy[] | null {
  const parsed = readJson<unknown>(text);
  if (!Array.isArray(parsed)) return null;
  const variants = parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { platform?: unknown; content?: CopyContent };
    if (typeof row.platform !== "string" || !isPlatform(row.platform) || !row.content || typeof row.content.body !== "string") return [];
    return [{ platform: row.platform, content: row.content }];
  });
  return variants.length > 0 ? variants : null;
}

function mapWork(row: WorkRow): Work {
  return {
    id: Number(row.id),
    theme: row.theme,
    platform: row.platform as Platform,
    audience: row.audience,
    length: row.target_length ?? "",
    style: row.style,
    notes: row.notes,
    accountId: row.account_id === null || row.account_id === undefined ? null : Number(row.account_id),
    accountName: row.account_name ?? "",
    age: row.age ?? "",
    occupation: row.occupation ?? "",
    industry: row.industry ?? "",
    personality: row.personality ?? "",
    persona: row.persona ?? "",
    problem: row.problem ?? "",
    profileNotes: row.profile_notes ?? "",
    hotspot: readJson<WorkHotspot>(row.hotspot_json),
    section: readJson<WorkSection>(row.section_json),
    inputs: readInputs(row.inputs_json),
    directions: readJson<Direction[]>(row.directions_json),
    selectedIndex: row.selected_index === null || row.selected_index === undefined ? null : Number(row.selected_index),
    content: readJson<CopyContent>(row.content_json),
    cues: readJson<SpokenCues>(row.cues_json),
    variants: readVariants(row.variants_json),
    variantsStale: Number(row.variants_stale) === 1,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertWork(userId: number, input: DraftInput, hotspot: WorkHotspot | null = null) {
  const now = new Date().toISOString();
  const result = database()
    .prepare(
      `INSERT INTO works (
         user_id, theme, platform, audience, style, notes, target_length, account_id, account_name,
         age, occupation, industry, personality, persona, problem, profile_notes, hotspot_json,
         section_json, inputs_json,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      input.theme,
      input.platform,
      input.reader.trim() || input.audience,
      input.style,
      input.notes,
      input.length,
      input.accountId,
      input.accountName,
      input.age,
      input.occupation,
      input.industry,
      input.personality,
      input.persona,
      input.problem,
      input.profileNotes,
      hotspot ? JSON.stringify(hotspot) : null,
      input.section ? JSON.stringify(input.section) : null,
      JSON.stringify(input.inputs ?? {}),
      now,
      now,
    );
  return Number(result.lastInsertRowid);
}

export function saveWorkContext(
  userId: number,
  id: number,
  input: Pick<
    DraftInput,
    "accountId" | "accountName" | "audience" | "age" | "occupation" | "industry" | "personality" | "persona" | "problem" | "profileNotes"
  >,
) {
  const now = new Date().toISOString();
  return changed(
    database()
      .prepare(
        `UPDATE works
         SET account_id = ?, account_name = ?, audience = ?, age = ?, occupation = ?, industry = ?, personality = ?, persona = ?, problem = ?, profile_notes = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(
        input.accountId,
        input.accountName,
        input.audience,
        input.age,
        input.occupation,
        input.industry,
        input.personality,
        input.persona,
        input.problem,
        input.profileNotes,
        now,
        id,
        userId,
      ),
  );
}

export function listWrittenThemes(userId: number) {
  const rows = database().prepare("SELECT theme FROM works WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as { theme: string }[];
  const themes: string[] = [];
  for (const row of rows) {
    const theme = row.theme.trim();
    if (!theme || themes.some((item) => sameTopic(item, theme))) continue;
    themes.push(theme);
  }
  return themes;
}

export function listWorks(userId: number): WorkSummary[] {
  const rows = database()
    .prepare(
      `SELECT id, theme, platform, style,
              directions_json IS NOT NULL AS has_directions,
              content_json IS NOT NULL AS has_content,
              updated_at
       FROM works WHERE user_id = ? ORDER BY updated_at DESC`,
    )
    .all(userId) as SummaryRow[];
  return rows.map((row) => ({
    id: Number(row.id),
    theme: row.theme,
    platform: row.platform as Platform,
    style: row.style,
    status: Number(row.has_content) ? "ready" : Number(row.has_directions) ? "draft" : "failed",
    updatedAt: row.updated_at,
  }));
}

export function getWork(userId: number, id: number) {
  const row = database().prepare("SELECT * FROM works WHERE id = ? AND user_id = ?").get(id, userId) as WorkRow | undefined;
  return row ? mapWork(row) : null;
}

export function saveDirections(userId: number, id: number, directions: Direction[]) {
  const now = new Date().toISOString();
  return changed(
    database()
      .prepare(
        `UPDATE works
         SET directions_json = ?, selected_index = NULL, content_json = NULL, cues_json = NULL, variants_json = NULL, variants_stale = 0, error = NULL, updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .run(JSON.stringify(directions), now, id, userId),
  );
}

export function saveContent(userId: number, id: number, index: number, content: CopyContent) {
  const now = new Date().toISOString();
  return changed(
    database()
      .prepare(
        `UPDATE works SET selected_index = ?, content_json = ?, cues_json = NULL, variants_json = NULL, variants_stale = 0, error = NULL, updated_at = ? WHERE id = ? AND user_id = ?`,
      )
      .run(index, JSON.stringify(content), now, id, userId),
  );
}

export function saveVariants(userId: number, id: number, variants: PlatformCopy[]) {
  const now = new Date().toISOString();
  return changed(
    database()
      .prepare("UPDATE works SET variants_json = ?, variants_stale = 0, error = NULL, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(variants.length > 0 ? JSON.stringify(variants) : null, now, id, userId),
  );
}

export function saveError(userId: number, id: number, error: string) {
  const now = new Date().toISOString();
  return changed(database().prepare("UPDATE works SET error = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(error, now, id, userId));
}

export function deleteWork(userId: number, id: number) {
  return changed(database().prepare("DELETE FROM works WHERE id = ? AND user_id = ?").run(id, userId));
}
