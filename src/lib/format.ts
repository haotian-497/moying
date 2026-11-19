import { copyTitle, type CopyContent } from "@/lib/types";

export function countChars(text: string) {
  return text.replace(/\s/g, "").length;
}

export function formatCopy(content: CopyContent) {
  const tags = content.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  const parts = [`标题：${copyTitle(content)}`, "", `封面大字：${content.coverText}`, "", content.body.trim(), "", `结尾互动：${content.cta}`];
  if (tags) parts.push("", `标签：${tags}`);
  if (content.publishNotes) parts.push("", `发布备注：${content.publishNotes}`);
  return parts.join("\n");
}

export function formatMarkdown(theme: string, content: CopyContent) {
  const tags = content.hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  const parts = [`# ${copyTitle(content) || theme}`, "", `**封面大字：** ${content.coverText}`, "", content.body.trim(), "", `**结尾互动：** ${content.cta}`];
  if (tags) parts.push("", tags);
  if (content.publishNotes) parts.push("", `> 发布备注：${content.publishNotes}`);
  return parts.join("\n");
}

export function formatTokens(value: number) {
  const count = Math.round(value);
  if (!Number.isFinite(count) || Math.abs(count) < 10000) return String(Number.isFinite(count) ? count : 0);
  return `${(count / 10000).toFixed(1).replace(/\.0$/, "")}万`;
}

export function formatTime(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
