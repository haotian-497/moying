import type { WorkHotspot } from "@/lib/types";

export function hotspotLimitNote(hotspot: WorkHotspot | null | undefined) {
  if (!hotspot?.title.trim()) return "";
  return hotspot.summary.trim()
    ? "借这条热点时，只用概要里已经写明的事实。"
    : "没抓到原文概要，成稿里只能写到「最近大家在讨论这件事」。";
}

export function hotspotRefBlock(hotspot: WorkHotspot | null | undefined) {
  const title = hotspot?.title.trim() ?? "";
  if (!title) return "";
  const summary = hotspot?.summary.trim() ?? "";
  const rule = summary
    ? "引用时只能用上面概要里给出的信息。概要没说的细节、数字、人名、时间一律不要写。"
    : "没有原文概要，所以你不知道这条热点的具体内容。只能写到「最近大家在讨论这件事」这个程度，绝对不要编造事件细节、数据或当事人说法。";
  return [
    "本篇要借势的热点：",
    `原标题：${title}`,
    summary ? `原文概要：${summary}` : "原文概要：抓不到原文，只有这个标题。",
    "写作要求：",
    "在开头或前三分之一处自然地把这条热点当作由头引出来，别写成新闻转述，也别通篇围着它转。它是引子，账号自己的观点才是主体。",
    rule,
    "不要写「据报道」「有数据显示」这类看似有出处、实则没有的表述。",
  ].join("\n");
}
