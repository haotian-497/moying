import { INSERT_ACTIONS, isPlatform, isPublishPlatform, REWRITE_ACTIONS, STYLES, type AccountWriting, type AssistRequest, type MediaAccountInput, type PersonalFields, type PieceInput, type Platform, type SectionField, type WorkHotspot } from "@/lib/types";

export function parseId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function validateCredentials(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "请填写用户名和密码" };
  const username = "username" in body && typeof body.username === "string" ? body.username.trim() : "";
  const password = "password" in body && typeof body.password === "string" ? body.password : "";
  if (!/^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/.test(username)) {
    return { ok: false as const, error: "用户名需要 2 到 20 位，可用中文、字母、数字和下划线" };
  }
  if (password.length < 6 || password.length > 72) {
    return { ok: false as const, error: "密码需要 6 到 72 位" };
  }
  return { ok: true as const, username, password };
}

function readPasswordField(body: object, key: string) {
  return key in body && typeof (body as Record<string, unknown>)[key] === "string" ? ((body as Record<string, unknown>)[key] as string) : "";
}

export function validateNewPassword(password: string, confirm: string) {
  if (password.length < 6 || password.length > 72) {
    return { ok: false as const, error: "新密码需要 6 到 72 位" };
  }
  if (password !== confirm) return { ok: false as const, error: "两次新密码不一致" };
  return { ok: true as const, password };
}

export function validateChangePassword(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "请填写密码" };
  const currentPassword = readPasswordField(body, "currentPassword");
  const password = readPasswordField(body, "password");
  const confirm = readPasswordField(body, "confirm");
  if (!currentPassword) return { ok: false as const, error: "请填写当前密码" };
  const next = validateNewPassword(password, confirm);
  if (!next.ok) return next;
  return { ok: true as const, currentPassword, password: next.password };
}

export function validateResetPassword(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "请填写重置信息" };
  const username = "username" in body && typeof body.username === "string" ? body.username.trim() : "";
  const password = readPasswordField(body, "password");
  const confirm = readPasswordField(body, "confirm");
  const resetKey = readPasswordField(body, "resetKey").trim();
  if (!/^[\u4e00-\u9fa5A-Za-z0-9_]{2,20}$/.test(username)) {
    return { ok: false as const, error: "用户名需要 2 到 20 位，可用中文、字母、数字和下划线" };
  }
  if (!resetKey) return { ok: false as const, error: "请填写本机重置口令" };
  const next = validateNewPassword(password, confirm);
  if (!next.ok) return next;
  return { ok: true as const, username, password: next.password, resetKey };
}

export function validateAdminResetPassword(body: unknown) {
  if (!body || typeof body !== "object") return { ok: false as const, error: "请填写新密码" };
  const userId = "userId" in body ? Number((body as { userId?: unknown }).userId) : NaN;
  if (!Number.isSafeInteger(userId) || userId <= 0) return { ok: false as const, error: "请选择用户" };
  const password = readPasswordField(body, "password");
  const confirm = readPasswordField(body, "confirm");
  const next = validateNewPassword(password, confirm);
  if (!next.ok) return next;
  return { ok: true as const, userId, password: next.password };
}

export function validateDraft(body: unknown): { ok: true; value: PieceInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "请先写一个题材" };
  const source = body as Record<string, unknown>;
  const theme = typeof source.theme === "string" ? source.theme.trim() : "";
  const platform = typeof source.platform === "string" ? source.platform : "";
  const style = typeof source.style === "string" ? source.style.trim() : "";
  const notes = typeof source.notes === "string" ? source.notes.trim() : "";
  const length = typeof source.length === "string" ? source.length.trim() : "";
  const reader = typeof source.reader === "string" ? source.reader.trim() : "";
  const accountId = typeof source.accountId === "number" ? source.accountId : Number.NaN;

  if (!Number.isSafeInteger(accountId) || accountId <= 0) return { ok: false, error: "请选择一个账号设定" };
  if (theme.length < 2 || theme.length > 300) return { ok: false, error: "题材需要 2 到 300 字" };
  if (!isPublishPlatform(platform)) return { ok: false, error: "请选择一个发布平台" };
  if (!(STYLES as readonly string[]).includes(style)) return { ok: false, error: "请选择一种风格" };
  if (notes.length > 400) return { ok: false, error: "这篇补充请控制在 400 字以内" };
  if (length.length > 20) return { ok: false, error: "目标字数请控制在 20 字以内" };
  if (reader.length > 80) return { ok: false, error: "目标读者请控制在 80 字以内" };
  const hotspot = readHotspot(source.hotspot);
  const sectionId = readSectionId(source.sectionId);
  const inputs = readInputs(source.inputs);
  if (!inputs.ok) return inputs;

  return {
    ok: true,
    value: {
      theme,
      platform,
      style,
      notes,
      length,
      reader,
      accountId,
      hotspot,
      sectionId,
      inputs: inputs.value,
    },
  };
}

export function validateAccountWriting(body: unknown): { ok: true; value: AccountWriting } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "请填写发布设定" };
  const source = body as Record<string, unknown>;
  const platform = typeof source.platform === "string" ? source.platform : "";
  const style = typeof source.style === "string" ? source.style.trim() : "";
  const length = typeof source.length === "string" ? source.length.trim() : "";
  const reader = typeof source.reader === "string" ? source.reader.trim() : "";
  if (!isPublishPlatform(platform)) return { ok: false, error: "请选择一个发布平台" };
  if (!(STYLES as readonly string[]).includes(style)) return { ok: false, error: "请选择一种风格" };
  if (length.length > 20) return { ok: false, error: "目标字数请控制在 20 字以内" };
  if (reader.length > 80) return { ok: false, error: "目标读者请控制在 80 字以内" };
  return { ok: true, value: { platform, style, length, reader } };
}

function readSectionId(value: unknown) {
  if (value == null || value === "") return null;
  const id = typeof value === "number" ? value : Number.NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}

function readInputs(value: unknown): { ok: true; value: Record<string, string> } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: {} };
  if (typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "栏目素材格式不对" };
  const inputs: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const label = key.trim();
    if (!label || typeof item !== "string") continue;
    const text = item.trim();
    if (!text) continue;
    if (text.length > 800) return { ok: false, error: `「${label}」请控制在 800 字以内` };
    inputs[label] = text;
    if (Object.keys(inputs).length > 8) return { ok: false, error: "栏目素材太多了" };
  }
  return { ok: true, value: inputs };
}

export function validateSection(body: unknown): { ok: true; value: { name: string; purpose: string; guide: string; fields: SectionField[] } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "请填写栏目" };
  const source = body as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const purpose = typeof source.purpose === "string" ? source.purpose.trim() : "";
  const guide = typeof source.guide === "string" ? source.guide.trim() : "";
  if (name.length < 2 || name.length > 20) return { ok: false, error: "栏目名需要 2 到 20 字" };
  if (purpose.length > 200) return { ok: false, error: "栏目说明请控制在 200 字以内" };
  if (guide.length > 400) return { ok: false, error: "写作要点请控制在 400 字以内" };
  if (!Array.isArray(source.fields)) return { ok: false, error: "请设置栏目要填的素材" };
  if (source.fields.length > 8) return { ok: false, error: "一个栏目最多 8 项素材" };
  const fields: SectionField[] = [];
  for (const item of source.fields) {
    if (!item || typeof item !== "object") return { ok: false, error: "栏目素材格式不对" };
    const row = item as { label?: unknown; hint?: unknown; required?: unknown };
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const hint = typeof row.hint === "string" ? row.hint.trim() : "";
    if (label.length < 1 || label.length > 20) return { ok: false, error: "素材名称需要 1 到 20 字" };
    if (hint.length > 80) return { ok: false, error: "素材提示请控制在 80 字以内" };
    if (fields.some((field) => field.label === label)) return { ok: false, error: "素材名称不能重复" };
    fields.push({ label, hint, required: row.required === true });
  }
  return { ok: true, value: { name, purpose, guide, fields } };
}

const POOL_SOURCES = ["手动", "热点", "推荐"] as const;

export function cleanPlanDate(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function validatePoolCreate(body: unknown): { ok: true; value: { subject: string; note: string; source: string; planDate: string; hotspot: WorkHotspot | null } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "请写一条题材" };
  const source = body as Record<string, unknown>;
  const subject = typeof source.subject === "string" ? source.subject.trim() : "";
  const note = typeof source.note === "string" ? source.note.trim() : "";
  const from = typeof source.source === "string" && (POOL_SOURCES as readonly string[]).includes(source.source) ? source.source : "手动";
  if (subject.length < 2 || subject.length > 300) return { ok: false, error: "题材需要 2 到 300 字" };
  if (note.length > 200) return { ok: false, error: "备注请控制在 200 字以内" };
  return { ok: true, value: { subject, note, source: from, planDate: cleanPlanDate(source.planDate), hotspot: readHotspot(source.hotspot) } };
}

export function validatePoolPatch(body: unknown): { ok: true; value: { planDate?: string; status?: "idea" | "done" } } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "没有要改的内容" };
  const source = body as Record<string, unknown>;
  const patch: { planDate?: string; status?: "idea" | "done" } = {};
  if ("planDate" in source) patch.planDate = cleanPlanDate(source.planDate);
  if ("status" in source) patch.status = source.status === "done" ? "done" : "idea";
  if (!("planDate" in source) && !("status" in source)) return { ok: false, error: "没有要改的内容" };
  return { ok: true, value: patch };
}

function readHotspot(value: unknown): WorkHotspot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { title?: unknown; summary?: unknown };
  const title = typeof row.title === "string" ? row.title.trim().slice(0, 120) : "";
  const summary = typeof row.summary === "string" ? row.summary.trim().slice(0, 500) : "";
  if (!title) return null;
  return { title, summary };
}

export function validatePersonal(body: unknown): { ok: true; value: PersonalFields } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "请填写个人人设" };
  const source = body as Record<string, unknown>;
  const age = typeof source.age === "string" ? source.age.trim() : "";
  const occupation = typeof source.occupation === "string" ? source.occupation.trim() : "";
  const industry = typeof source.industry === "string" ? source.industry.trim() : "";
  const personality = typeof source.personality === "string" ? source.personality.trim() : "";
  const parsedAge = normalizeAge(age);

  if (!parsedAge.ok) return { ok: false, error: parsedAge.error };
  if (occupation.length < 2 || occupation.length > 40) return { ok: false, error: "职业需要 2 到 40 字" };
  if (industry.length < 2 || industry.length > 40) return { ok: false, error: "行业需要 2 到 40 字" };
  if (personality.length < 2 || personality.length > 80) return { ok: false, error: "性格特征需要 2 到 80 字" };

  return { ok: true, value: { age: parsedAge.value, occupation, industry, personality } };
}

export function validateMediaAccount(body: unknown): { ok: true; value: MediaAccountInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "请填写账号设定" };
  const source = body as Record<string, unknown>;
  const name = typeof source.name === "string" ? source.name.trim() : "";
  const rawPlatforms = source.platforms;
  if (!Array.isArray(rawPlatforms) || rawPlatforms.some((item) => typeof item !== "string" || !isPlatform(item))) {
    return { ok: false, error: "请选择有效的发布平台" };
  }
  const platforms = [...new Set(rawPlatforms)] as Platform[];
  const persona = typeof source.persona === "string" ? source.persona.trim() : "";
  const problem = typeof source.problem === "string" ? source.problem.trim() : "";
  const audience = typeof source.audience === "string" ? source.audience.trim() : "";
  const notes = typeof source.notes === "string" ? source.notes.trim() : "";

  if (name.length < 2 || name.length > 20) return { ok: false, error: "账号名称需要 2 到 20 字" };
  if (platforms.length === 0) return { ok: false, error: "请至少选择一个发布平台" };
  if (persona.length < 2 || persona.length > 800) return { ok: false, error: "主要内容需要 2 到 800 字" };
  if (problem.length < 2 || problem.length > 800) return { ok: false, error: "要解决的问题需要 2 到 800 字" };
  if (audience.length < 2 || audience.length > 200) return { ok: false, error: "目标用户需要 2 到 200 字" };
  if (notes.length > 400) return { ok: false, error: "备注请控制在 400 字以内" };

  return { ok: true, value: { name, platforms, persona, problem, audience, notes } };
}

function normalizeAge(age: string) {
  if (/^\d+$/.test(age)) {
    const years = Number(age);
    if (years >= 1 && years <= 120) return { ok: true as const, value: String(years) };
    return { ok: false as const, error: "年龄请填 1 到 120" };
  }
  if (age.length < 2 || age.length > 20) return { ok: false as const, error: "年龄请填 1 到 120，或 2 到 20 个字的说法" };
  return { ok: true as const, value: age };
}

export function validateDirectionIndex(body: unknown) {
  if (!body || typeof body !== "object" || !("index" in body)) {
    return { ok: false as const, error: "请选择一个方向" };
  }
  const index = (body as { index: unknown }).index;
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 2) {
    return { ok: false as const, error: "请选择一个方向" };
  }
  return { ok: true as const, index };
}

export function validateVariantPlatforms(body: unknown, current: Platform) {
  const parsed = validateDirectionIndex(body);
  if (!parsed.ok) return parsed;
  if (!body || typeof body !== "object" || !("platforms" in body) || !Array.isArray((body as { platforms: unknown }).platforms)) {
    return { ok: false as const, error: "请再选至少一个平台" };
  }
  const raw = (body as { platforms: unknown[] }).platforms;
  if (raw.some((item) => typeof item !== "string" || !isPlatform(item))) {
    return { ok: false as const, error: "请选择有效的发布平台" };
  }
  const platforms = [...new Set(raw as Platform[])].filter((item) => item !== current);
  if (platforms.length === 0) return { ok: false as const, error: "请再选至少一个其他平台" };
  return { ok: true as const, index: parsed.index, platforms };
}

export function validateWorkBody(body: unknown) {
  if (!body || typeof body !== "object" || !("body" in body) || typeof (body as { body: unknown }).body !== "string") {
    return { ok: false as const, error: "请先写正文" };
  }
  const text = (body as { body: string }).body.trim();
  if (text.length < 10 || text.length > 8000) return { ok: false as const, error: "正文需要 10 到 8000 字" };
  return { ok: true as const, body: text };
}

function clipContext(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export function validateAssist(body: unknown): { ok: true; value: AssistRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "请选择怎么改" };
  const source = body as Record<string, unknown>;
  const kind = source.kind === "rewrite" || source.kind === "insert" ? source.kind : null;
  const action = typeof source.action === "string" ? source.action : "";
  if (!kind) return { ok: false, error: "请选择怎么改" };
  const allowed = kind === "rewrite" ? REWRITE_ACTIONS.map((item) => item.id) : [...INSERT_ACTIONS.map((item) => item.id), "custom"];
  if (!allowed.includes(action as (typeof allowed)[number])) return { ok: false, error: "请选择怎么改" };
  const selection = typeof source.selection === "string" ? source.selection.trim() : "";
  const instruction = typeof source.instruction === "string" ? source.instruction.trim() : "";
  if (kind === "rewrite" && (selection.length < 4 || selection.length > 800)) return { ok: false, error: "请选中一小段再改" };
  if (kind === "insert" && action === "custom" && (instruction.length < 2 || instruction.length > 200)) {
    return { ok: false, error: "请写 2 到 200 字，说明要写什么" };
  }
  if (instruction.length > 200) return { ok: false, error: "补充说明请控制在 200 字以内" };
  return {
    ok: true,
    value: {
      kind,
      action: action as AssistRequest["action"],
      selection,
      before: clipContext(source.before, 500),
      after: clipContext(source.after, 500),
      instruction,
    },
  };
}

export function validateVoiceSample(body: unknown): { ok: true; text: string; source: "paste" | "draft" } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false as const, error: "请贴一段用来学语气的文字" };
  const source = body as Record<string, unknown>;
  const text = typeof source.text === "string" ? source.text.trim() : "";
  const from = source.source === "draft" ? "draft" : source.source === "paste" ? "paste" : null;
  if (!from) return { ok: false as const, error: "请贴一段用来学语气的文字" };
  if (text.length < 40 || text.length > 1500) return { ok: false as const, error: "语气样本需要 40 到 1500 字" };
  return { ok: true as const, text, source: from };
}

export function safeNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value === "/" || value.startsWith("/works/")) return value;
  if (value.startsWith("/studio")) return "/";
  return "/";
}
