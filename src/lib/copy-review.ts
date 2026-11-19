import { draftBrief, getLlmStatus, reviewArticle } from "@/lib/llm";
import { copyTitle, type CopyContent, type CopyIssue, type CopyIssueWhere, type CopyReview, type DraftInput, type VoiceCue, type WorkHotspot } from "@/lib/types";

export function articleText(content: Pick<CopyContent, "titles" | "coverText" | "body" | "cta" | "hashtags">) {
  return [copyTitle(content), content.coverText.trim(), content.body.trim(), content.cta.trim(), content.hashtags.join(" ").trim()]
    .filter(Boolean)
    .join("\n\n");
}

export { quoteAnchor } from "@/lib/quote-anchor";

function locate(content: Pick<CopyContent, "titles" | "coverText" | "body" | "cta" | "hashtags">, quote: string): CopyIssueWhere | null {
  const parts: [CopyIssueWhere, string][] = [
    ["title", copyTitle(content)],
    ["cover", content.coverText],
    ["body", content.body],
    ["cta", content.cta],
    ["hashtag", content.hashtags.join(" ")],
  ];
  const joined = parts.map(([, text]) => text).join("\n\n");
  const at = joined.indexOf(quote);
  if (at < 0) return null;
  let cursor = 0;
  for (const [where, text] of parts) {
    if (at < cursor + text.length) return where;
    cursor += text.length + 2;
  }
  return null;
}

function hotspotLine(hotspot: WorkHotspot | null) {
  if (!hotspot?.title) return "没有这条题材对应的热点材料。没有材料时，不要报「热点使用」。";
  return [`热点标题：${hotspot.title}`, hotspot.summary ? `概要：${hotspot.summary}` : "概要：没有抓到原文，只有标题。"].join("\n");
}

export async function attachReview(content: CopyContent, input: DraftInput, voice: VoiceCue = { digest: "", excerpts: [] }, hotspot: WorkHotspot | null = null): Promise<CopyContent> {
  const checkedAt = new Date().toISOString();
  const text = articleText(content);
  if (!text.trim()) return content;
  if (text.length > 20000) throw new Error("正文过长，请分段检查");
  const mode = getLlmStatus().mode;
  if (mode !== "live") {
    const review: CopyReview = {
      issues: [],
      flags: [],
      verdict: "ok",
      summary: mode === "missing" ? "还没有配置模型，这次没查成。" : "演示模式，配置模型后这里会列出要采纳的修改和总评。",
      risk: "无",
      dropped: 0,
      padded: 0,
      failed: mode === "missing",
      checkedAt,
    };
    return { ...content, review };
  }
  try {
    const model = await reviewArticle(text, { brief: draftBrief(input, voice), hotspot: hotspotLine(hotspot) });
    const issues: CopyIssue[] = [];
    for (const issue of model.issues) {
      const where = locate(content, issue.quote);
      if (!where) continue;
      issues.push({ ...issue, where, count: text.split(issue.quote).length - 1 });
    }
    const risk = model.flags.some((flag) => flag.level === "高") ? "高" : model.flags.length > 0 ? "中" : "无";
    const review: CopyReview = {
      issues,
      flags: model.flags,
      verdict: model.verdict,
      summary: model.summary,
      risk,
      dropped: model.dropped + (model.issues.length - issues.length),
      padded: model.padded,
      failed: false,
      checkedAt,
    };
    return { ...content, review };
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message === "正文过长，请分段检查") throw error;
    return {
      ...content,
      review: {
        issues: [],
        flags: [],
        verdict: "minor",
        summary: "这次没查成。稿子还是原来的，没有改动。",
        risk: "无",
        dropped: 0,
        padded: 0,
        failed: true,
        checkedAt,
      },
    };
  }
}

function replaceFirst(text: string, quote: string, next: string) {
  const index = text.indexOf(quote);
  if (index < 0) return null;
  return text.slice(0, index) + next + text.slice(index + quote.length);
}

function writeTrimmed(raw: string, nextTrimmed: string) {
  const trimmed = raw.trim();
  const at = raw.indexOf(trimmed);
  if (!trimmed || at < 0) return nextTrimmed;
  return raw.slice(0, at) + nextTrimmed + raw.slice(at + trimmed.length);
}

function pieceList(content: CopyContent) {
  return [
    { where: "title" as const, raw: copyTitle(content), text: copyTitle(content).trim() },
    { where: "cover" as const, raw: content.coverText, text: content.coverText.trim() },
    { where: "body" as const, raw: content.body, text: content.body.trim() },
    { where: "cta" as const, raw: content.cta, text: content.cta.trim() },
    { where: "hashtag" as const, raw: content.hashtags.join(" "), text: content.hashtags.join(" ").trim() },
  ].filter((piece) => piece.text);
}

function writePiece(content: CopyContent, where: CopyIssueWhere, raw: string, nextTrimmed: string) {
  const next = writeTrimmed(raw, nextTrimmed);
  if (where === "title") return { ...content, titles: [next] };
  if (where === "cover") return { ...content, coverText: next };
  if (where === "body") return { ...content, body: next };
  if (where === "cta") return { ...content, cta: next };
  return { ...content, hashtags: next.trim().split(/\s+/).filter(Boolean) };
}

function replaceAcross(content: CopyContent, quote: string, replacement: string) {
  const pieces = pieceList(content);
  for (let index = 0; index < pieces.length - 1; index += 1) {
    const left = pieces[index];
    const right = pieces[index + 1];
    const bridge = `${left.text}\n\n${right.text}`;
    const at = bridge.indexOf(quote);
    if (at < 0) continue;
    const end = at + quote.length;
    const seam = left.text.length;
    if (at >= seam || end <= seam + 2) continue;
    const nextLeft = bridge.slice(0, at) + replacement;
    const nextRight = bridge.slice(end);
    return writePiece(writePiece(content, left.where, left.raw, nextLeft), right.where, right.raw, nextRight);
  }
  return null;
}

export function replaceIssue(content: CopyContent, issue: CopyIssue) {
  const next = issue.suggestion.trim();
  const removing = !next && issue.kind === "flow";
  if (!next && !removing) return null;
  const title = copyTitle(content);
  const replacedTitle = replaceFirst(title, issue.quote, next);
  if (replacedTitle !== null) return { ...content, titles: [replacedTitle] };
  const coverText = replaceFirst(content.coverText, issue.quote, next);
  if (coverText !== null) return { ...content, coverText };
  const body = replaceFirst(content.body, issue.quote, next);
  if (body !== null) return { ...content, body };
  const cta = replaceFirst(content.cta, issue.quote, next);
  if (cta !== null) return { ...content, cta };
  const tagIndex = content.hashtags.findIndex((tag) => tag.includes(issue.quote));
  if (tagIndex >= 0) {
    const tag = replaceFirst(content.hashtags[tagIndex], issue.quote, next);
    if (tag === null) return null;
    const hashtags = content.hashtags.slice();
    hashtags[tagIndex] = tag;
    return { ...content, hashtags };
  }
  const joined = content.hashtags.join(" ");
  const replacedTags = replaceFirst(joined, issue.quote, next);
  if (replacedTags !== null) return { ...content, hashtags: replacedTags.trim().split(/\s+/).filter(Boolean) };
  return replaceAcross(content, issue.quote, next);
}
