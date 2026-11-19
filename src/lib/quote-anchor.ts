import { copyTitle, type CopyContent, type CopyIssueWhere } from "@/lib/types";

export function quoteAnchor(content: Pick<CopyContent, "titles" | "coverText" | "body" | "cta" | "hashtags">, quote: string) {
  const fields: [CopyIssueWhere, string][] = [
    ["title", copyTitle(content)],
    ["cover", content.coverText],
    ["body", content.body],
    ["cta", content.cta],
    ["hashtag", content.hashtags.join(" ")],
  ];
  const text = quote.trim();
  if (!text) return null;
  for (const [where, field] of fields) {
    if (field.includes(text)) return { where, quote: text };
  }
  const head = text.split("\n\n")[0]?.trim() ?? "";
  if (!head || head === text) return null;
  for (const [where, field] of fields) {
    if (field.includes(head)) return { where, quote: head };
  }
  return null;
}
