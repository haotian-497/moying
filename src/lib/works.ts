import { dropIdea, getMediaAccount, getPersonalProfile, getSection, getWork, insertWork, saveContent, saveDirections, saveError, saveReviewedContent, saveSpokenCues, saveVariants, saveWorkContext } from "@/lib/db";
import { attachReview, replaceIssue } from "@/lib/copy-review";
import { generateContent, generateContentStream, generateDirections, generateSpokenCues, reviseSpan } from "@/lib/llm";
import { voiceCue } from "@/lib/voice";
import { runWithUser, runWithWork } from "@/lib/usage-context";
import { isMediaReady, isPersonalReady, platformLabel, type AssistRequest, type DraftInput, type PieceInput, type Platform, type PlatformCopy, type Work, type WorkSection } from "@/lib/types";

export class WorkInputError extends Error {}

function takenSection(userId: number, piece: PieceInput): WorkSection | null {
  if (!piece.sectionId) return null;
  const section = getSection(userId, piece.accountId, piece.sectionId);
  if (!section) throw new WorkInputError("找不到这个栏目");
  const missing = section.fields.find((field) => field.required && !(piece.inputs[field.label] ?? "").trim());
  if (missing) throw new WorkInputError(`请先填写栏目里的「${missing.label}」`);
  return { id: section.id, name: section.name, purpose: section.purpose, guide: section.guide, fields: section.fields };
}

function pieceFrom(existing: Work): PieceInput {
  return {
    theme: existing.theme,
    platform: existing.platform,
    style: existing.style,
    notes: existing.notes,
    length: existing.length,
    reader: existing.audience,
    accountId: existing.accountId ?? 0,
    hotspot: existing.hotspot,
    sectionId: existing.section?.id ?? null,
    inputs: existing.inputs ?? {},
  };
}

function fromProfile(userId: number, piece: PieceInput, fallback?: Work, section?: WorkSection | null): DraftInput {
  const personal = getPersonalProfile(userId);
  const usePersonal = isPersonalReady(personal);
  const accountId = piece.accountId || fallback?.accountId || 0;
  const account = accountId ? getMediaAccount(userId, accountId) : null;
  const useAccount = Boolean(account && isMediaReady(account));
  return {
    theme: piece.theme,
    platform: piece.platform,
    style: piece.style,
    notes: piece.notes,
    accountId: useAccount && account ? account.id : (fallback?.accountId ?? piece.accountId),
    accountName: useAccount && account ? account.name : (fallback?.accountName ?? ""),
    audience: useAccount && account ? account.audience : (fallback?.audience ?? ""),
    reader: (piece.reader || "").trim() || fallback?.audience || account?.reader || "",
    length: (piece.length || "").trim() || fallback?.length || account?.length || "",
    age: usePersonal ? personal.age : (fallback?.age ?? ""),
    occupation: usePersonal ? personal.occupation : (fallback?.occupation ?? ""),
    industry: usePersonal ? personal.industry : (fallback?.industry ?? ""),
    personality: usePersonal ? personal.personality : (fallback?.personality ?? ""),
    persona: useAccount && account ? account.persona : (fallback?.persona ?? ""),
    problem: useAccount && account ? account.problem : (fallback?.problem ?? ""),
    profileNotes: useAccount && account ? account.notes : (fallback?.profileNotes ?? ""),
    hotspot: piece.hotspot,
    section: section === undefined ? (fallback?.section ?? null) : section,
    inputs: piece.inputs,
  };
}

async function voiceOf(userId: number, accountId: number | null) {
  const account = accountId ? getMediaAccount(userId, accountId) : null;
  return voiceCue(userId, accountId, account?.styleDigest ?? "");
}

function toUserError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "生成失败，请再试一次";
}

export async function createWork(userId: number, piece: PieceInput) {
  const personal = getPersonalProfile(userId);
  if (!isPersonalReady(personal)) throw new WorkInputError("请先完成个人人设");
  const account = getMediaAccount(userId, piece.accountId);
  if (!account || !isMediaReady(account)) throw new WorkInputError("请选择一个账号设定");
  const section = takenSection(userId, piece);
  const input = fromProfile(userId, piece, undefined, section);
  const id = insertWork(userId, input, piece.hotspot);
  try {
    const voice = await voiceOf(userId, input.accountId);
    const directions = await runWithUser(userId, () => runWithWork(id, () => generateDirections(input, voice)));
    saveDirections(userId, id, directions);
    dropIdea(userId, piece.accountId, piece.theme);
  } catch (error) {
    console.error(error);
    saveError(userId, id, toUserError(error));
  }
  const work = getWork(userId, id);
  if (!work) throw new Error("稿件保存失败");
  return work;
}

export async function refreshDirections(userId: number, id: number) {
  const existing = getWork(userId, id);
  if (!existing) return null;
  const input = fromProfile(userId, pieceFrom(existing), existing);
  try {
    const voice = await voiceOf(userId, input.accountId);
    const directions = await runWithUser(userId, () => runWithWork(id, () => generateDirections(input, voice)));
    saveWorkContext(userId, id, input);
    saveDirections(userId, id, directions);
  } catch (error) {
    console.error(error);
    saveError(userId, id, toUserError(error));
  }
  return getWork(userId, id);
}

export async function writeContent(userId: number, id: number, index: number) {
  return streamWriteContent(userId, id, index);
}

export async function streamWriteContent(
  userId: number,
  id: number,
  index: number,
  onDelta?: (text: string) => void,
  onAfterGenerate?: (work: Work) => void,
) {
  const existing = getWork(userId, id);
  if (!existing) return null;
  const direction = existing.directions?.[index];
  if (!direction) {
    saveError(userId, id, "还没有可选的方向");
    return getWork(userId, id);
  }
  const input = fromProfile(userId, pieceFrom(existing), existing);
  try {
    const voice = await voiceOf(userId, input.accountId);
    const content = await runWithUser(userId, () =>
      runWithWork(id, () => generateContentStream(input, direction, voice, onDelta ?? (() => undefined))),
    );
    saveWorkContext(userId, id, input);
    saveContent(userId, id, index, content);
    const generated = getWork(userId, id);
    if (generated) onAfterGenerate?.(generated);
    try {
      const reviewed = await runWithUser(userId, () => runWithWork(id, () => attachReview(content, input, voice, existing.hotspot)));
      saveReviewedContent(userId, id, reviewed);
    } catch (error) {
      console.error(error);
    }
  } catch (error) {
    console.error(error);
    saveError(userId, id, toUserError(error));
  }
  return getWork(userId, id);
}

export async function writeVariants(userId: number, id: number, index: number, platforms: Platform[]) {
  const existing = getWork(userId, id);
  if (!existing) return null;
  const direction = existing.directions?.[index];
  if (!direction || existing.selectedIndex !== index || !existing.content) {
    saveError(userId, id, "请先按这个方向生成成稿");
    return getWork(userId, id);
  }
  const base = fromProfile(userId, pieceFrom(existing), existing);
  const copies: PlatformCopy[] = [];
  const failed: string[] = [];
  const voice = await voiceOf(userId, base.accountId);
  for (const platform of platforms) {
    try {
      const content = await runWithUser(userId, () => runWithWork(id, () => generateContent({ ...base, platform }, direction, voice)));
      copies.push({ platform, content });
    } catch (error) {
      console.error(error);
      failed.push(platformLabel(platform));
    }
  }
  const kept = (existing.variants ?? []).filter((item) => !platforms.includes(item.platform) && item.platform !== existing.platform);
  const variants = [...kept, ...copies];
  if (variants.length > 0) saveVariants(userId, id, variants);
  if (failed.length > 0) saveError(userId, id, `${failed.join("、")}没有写成，可以再试一次`);
  return getWork(userId, id);
}

export async function assistWork(userId: number, id: number, request: AssistRequest) {
  const existing = getWork(userId, id);
  if (!existing?.content) return null;
  const input = fromProfile(userId, pieceFrom(existing), existing);
  try {
    const voice = await voiceOf(userId, input.accountId);
    const text = await runWithUser(userId, () => runWithWork(id, () => reviseSpan(input, voice, request)));
    return { text };
  } catch (error) {
    console.error(error);
    return { error: toUserError(error) };
  }
}

export async function reviewWork(userId: number, id: number) {
  const existing = getWork(userId, id);
  if (!existing?.content) return null;
  const draft = existing.content;
  const input = fromProfile(userId, pieceFrom(existing), existing);
  const voice = await voiceOf(userId, input.accountId);
  try {
    const content = await runWithUser(userId, () => runWithWork(id, () => attachReview(draft, input, voice, existing.hotspot)));
    return saveReviewedContent(userId, id, content);
  } catch (error) {
    console.error(error);
    saveError(userId, id, error instanceof Error && error.message ? error.message : "这次没查成");
    return getWork(userId, id);
  }
}

function canApplyIssue(issue: { suggestion: string; kind: string }) {
  return Boolean(issue.suggestion.trim()) || issue.kind === "flow";
}

export function applyAllReviewIssues(userId: number, id: number) {
  const existing = getWork(userId, id);
  const review = existing?.content?.review;
  if (!existing?.content || !review) return { error: "这条检查已经不在了" as const };
  let content = existing.content;
  const kept = [];
  for (const issue of review.issues) {
    if (!canApplyIssue(issue)) {
      kept.push(issue);
      continue;
    }
    const next = replaceIssue(content, issue);
    if (!next) {
      kept.push(issue);
      continue;
    }
    content = next;
  }
  content = { ...content, review: { ...review, issues: kept } };
  const work = saveReviewedContent(userId, id, content);
  return work ? { work } : { error: "没有保存这次处理" as const };
}

export function settleReviewIssue(userId: number, id: number, index: number, action: "apply" | "dismiss") {
  const existing = getWork(userId, id);
  const review = existing?.content?.review;
  const issue = review?.issues[index];
  if (!existing?.content || !review || !issue) return { error: "这条检查已经不在了" as const };
  let content = existing.content;
  if (action === "apply") {
    const next = replaceIssue(content, issue);
    if (!next) return { error: "原文里已经没有这句" as const };
    content = next;
  }
  content = { ...content, review: { ...review, issues: review.issues.filter((_, item) => item !== index) } };
  const work = saveReviewedContent(userId, id, content);
  return work ? { work } : { error: "没有保存这次处理" as const };
}

export async function writeSpokenCues(userId: number, id: number) {
  const existing = getWork(userId, id);
  if (!existing?.content) return null;
  const input = fromProfile(userId, pieceFrom(existing), existing);
  const body = existing.content.body;
  try {
    const voice = await voiceOf(userId, input.accountId);
    const cues = await runWithUser(userId, () => runWithWork(id, () => generateSpokenCues(input, voice, body)));
    const work = saveSpokenCues(userId, id, cues);
    return work ? { work, cues } : { error: "没有保存口播提示" as const };
  } catch (error) {
    console.error(error);
    return { error: toUserError(error) };
  }
}
