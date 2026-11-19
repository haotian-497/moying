import { countChars } from "@/lib/format";
import { platformLabel, type Platform } from "@/lib/types";

export const PLATFORM_LENGTH: Record<Platform, [number, number]> = {
  xiaohongshu: [400, 700],
  wechat: [900, 1400],
  zhihu: [1100, 1900],
  weibo: [180, 420],
  douyin: [220, 320],
  bilibili: [800, 1600],
  shipinhao: [180, 420],
  moments: [120, 220],
};

export function defaultTargetLength(platform: Platform) {
  const range = PLATFORM_LENGTH[platform];
  return String(Math.round((range[0] + range[1]) / 2));
}

export const TEST_LOGIC = [
  {
    id: "directions",
    title: "三个方向",
    rules: ["只记数字：有几条、标题是否重复、标题或角度空了几个", "角度写法不同不记成失败", "数字在盲选之后才显示"],
  },
  {
    id: "content",
    title: "成稿",
    rules: [
      "只记字数偏离该平台目标多少。目标是区间中点：小红书 550，公众号 1150，抖音 270，视频号 300，朋友圈 170",
      "参考区间仍是小红书 400–700，公众号 900–1400，抖音 220–320，视频号 180–420，朋友圈 120–220。出了区间也不判失败",
      "另记段数和平均段长。段按空行切开：段太少说明没分开，平均段长太大说明一整段没换气",
      "另记不该出现的格式：口播标注（抖音和视频号除外）、正文里的话题标签（小红书和朋友圈除外），以及「以下是」「这是一篇」「好的，」这类开头",
      "数字在盲选之后才显示",
    ],
  },
  {
    id: "hot",
    title: "热点",
    rules: ["不设通过线", "只记字数、耗时和是否报错", "好不好在盲选里看"],
  },
  {
    id: "revise",
    title: "改写",
    rules: ["不设通过线", "只记字数、耗时和是否报错", "好不好在盲选里看"],
  },
  {
    id: "cues",
    title: "口播",
    rules: ["不设通过线", "只记字数、耗时和是否报错", "好不好在盲选里看"],
  },
  {
    id: "review",
    title: "校对",
    rules: ["检查不改正文。错字、语句不通、连着的车轱辘、前后矛盾、标点要等采纳才替换", "总评，以及账号调性、平台调性、公序良俗、法律风险、热点使用、事实存疑，只提示", "单独数有几条引用在原文里对不上，这条数字在盲选之后才显示"],
  },
  {
    id: "relation",
    title: "跨段校对",
    rules: ["单独数有几条引用在原文里对不上", "这条数字在盲选之后才显示", "不跟方向、成稿放在同一条线上"],
  },
] as const;

export type HardFailure = {
  code: string;
  message: string;
};

export const FAILURE_LABEL: Record<string, string> = {
  count: "条数",
  incomplete: "字段",
  title: "标题",
  angle: "角度",
  body: "正文",
  length: "字数",
  empty: "空输出",
  json: "格式",
  quote: "引用",
  thin: "内容",
  error: "报错",
};

export type ScoreMetric = {
  label: string;
  value: string;
};

export type ScoreCard = {
  pass: boolean;
  summary: string;
  chars: number;
  failures: HardFailure[];
  metrics: ScoreMetric[];
};

function readJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("不是 JSON");
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

function anglesDistinct(angles: string[]) {
  const cleaned = angles.map((item) => item.replace(/\s+/g, ""));
  if (new Set(cleaned).size !== cleaned.length) return false;
  return cleaned.every((item, index) => cleaned.every((other, otherIndex) => index === otherIndex || item.length < 6 || !other.includes(item)));
}

function noted(chars: number, metrics: ScoreMetric[]): ScoreCard {
  return {
    pass: true,
    chars,
    failures: [],
    metrics,
    summary: metrics.map((item) => `${item.label} ${item.value}`).join("；"),
  };
}

const TRACE_RULES: { label: string; pattern: RegExp; skip?: (platform: string) => boolean }[] = [
  { label: "口播标注", pattern: /【(?:口播|画面|字幕|转场)】/g, skip: (platform) => platform === "douyin" || platform === "shipinhao" },
  { label: "话题标签", pattern: /#[^\s#]{2,20}/g, skip: (platform) => platform === "xiaohongshu" || platform === "moments" },
  { label: "交付前言", pattern: /(?:^|\n)\s*(?:以下是|这是一篇|好的[，,])/g },
];

function traceMetric(text: string, platform: string): ScoreMetric {
  const found = TRACE_RULES.flatMap((rule) => {
    if (rule.skip?.(platform)) return [];
    const count = text.match(rule.pattern)?.length ?? 0;
    return count > 0 ? [`${rule.label} ${count}`] : [];
  });
  return { label: "格式痕迹", value: found.length > 0 ? found.join("，") : "0" };
}

function paragraphMetrics(body: string): ScoreMetric[] {
  const parts = body.split(/\n{2,}/).filter((item) => item.trim());
  const count = parts.length;
  const avg = body.trim() ? Math.round(body.replace(/\n/g, "").length / Math.max(1, count)) : 0;
  return [
    { label: "段数", value: String(count) },
    { label: "平均段长", value: `${avg} 字` },
  ];
}

function lengthMetric(body: string, platform: string): ScoreMetric {
  const length = countChars(body);
  if (!(platform in PLATFORM_LENGTH)) return { label: "字数", value: body.trim() ? `${length} 字` : "0，没有正文" };
  const range = PLATFORM_LENGTH[platform as Platform];
  const target = Math.round((range[0] + range[1]) / 2);
  const off = Math.round(((length - target) / target) * 100);
  const sign = off > 0 ? "+" : "";
  return { label: "字数", value: `${length} 字，较目标 ${target} 字 ${sign}${off}%（参考 ${range[0]}–${range[1]}）` };
}

function directionMetrics(list: { title: string; angle: string }[]): ScoreMetric[] {
  const empty = list.reduce((count, item) => count + (item.title.trim() ? 0 : 1) + (item.angle.trim() ? 0 : 1), 0);
  const titles = list.map((item) => item.title.trim()).filter(Boolean);
  const duplicated = titles.length >= 2 && new Set(titles).size !== titles.length;
  return [
    { label: "条数", value: String(list.length) },
    { label: "标题", value: duplicated ? "有重复" : "各不相同" },
    { label: "空字段", value: String(empty) },
  ];
}

export function directionHardFailures(list: { title: string; angle: string }[]): HardFailure[] {
  const failures: HardFailure[] = [];
  if (list.length !== 3) failures.push({ code: "count", message: `条数是 ${list.length}，要正好 3 条` });
  if (list.length > 0 && list.some((item) => !item.title.trim() || !item.angle.trim())) {
    failures.push({ code: "incomplete", message: "有的方向缺少标题或角度" });
  }
  const titles = list.map((item) => item.title.trim()).filter(Boolean);
  if (titles.length >= 2 && new Set(titles).size !== titles.length) failures.push({ code: "title", message: "标题有重复" });
  const angles = list.map((item) => item.angle.trim()).filter(Boolean);
  if (angles.length >= 2 && angles.length === list.length && !anglesDistinct(angles)) {
    failures.push({ code: "angle", message: "三条角度相同，或一条包含另一条" });
  }
  return failures;
}

function lengthBand(platform: string, requested = ""): [number, number] | null {
  const digits = requested.trim().match(/\d{2,5}/);
  if (digits) {
    const target = Number(digits[0]);
    if (target >= 20 && target <= 20000) return [Math.round(target * 0.8), Math.round(target * 1.2)];
  }
  if (platform in PLATFORM_LENGTH) return PLATFORM_LENGTH[platform as Platform];
  return null;
}

export function contentHardFailures(body: string, platform: string, requested = ""): HardFailure[] {
  const text = body.trim();
  if (!text) return [{ code: "body", message: "没有正文" }];
  const range = lengthBand(platform, requested);
  if (!range) return [];
  const length = countChars(text);
  if (length < range[0] || length > range[1]) {
    const asked = requested.trim().match(/\d{2,5}/);
    const name = asked ? `目标约 ${asked[0]} 字` : platformLabel(platform as Platform);
    return [{ code: "length", message: `${name}，正文 ${length} 字，要在 ${range[0]}–${range[1]} 字` }];
  }
  return [];
}

function directionRows(data: unknown) {
  if (!data || typeof data !== "object" || !("directions" in data)) throw new Error("没有方向");
  const list = (data as { directions: unknown }).directions;
  if (!Array.isArray(list)) throw new Error("没有方向");
  return list.map((item) => {
    if (!item || typeof item !== "object") return { title: "", angle: "" };
    const row = item as { title?: unknown; angle?: unknown };
    return {
      title: typeof row.title === "string" ? row.title.trim() : "",
      angle: typeof row.angle === "string" ? row.angle.trim() : "",
    };
  });
}

export function scoreOutput(feature: string, input: string, output: string, platform: string): ScoreCard {
  const chars = countChars(output);
  if (!output.trim()) return noted(chars, [{ label: "字数", value: "0" }]);
  if (feature === "directions") {
    try {
      return noted(chars, directionMetrics(directionRows(readJson(output))));
    } catch {
      return noted(chars, [{ label: "条数", value: "没有解析出来" }]);
    }
  }
  if (feature === "content") {
    try {
      const data = readJson(output) as { body?: unknown };
      const body = typeof data.body === "string" ? data.body : "";
      if (!body.trim()) return noted(chars, [{ label: "字数", value: "0，没有正文" }]);
      return noted(countChars(body), [lengthMetric(body, platform), ...paragraphMetrics(body), traceMetric(body, platform)]);
    } catch {
      return noted(chars, [lengthMetric(output, platform), traceMetric(output, platform), { label: "格式", value: "没有解析出成稿" }]);
    }
  }
  if (feature === "review" || feature === "relation") {
    try {
      const data = readJson(output) as { issues?: { quote?: string }[] };
      const issues = Array.isArray(data.issues) ? data.issues : [];
      const missing = issues.filter((item) => {
        const quote = typeof item.quote === "string" ? item.quote.trim() : "";
        return quote && !input.includes(quote);
      }).length;
      const value = missing === 0 ? `${issues.length} 条都能对上原文` : `${missing} 条对不上原文`;
      return noted(chars, [{ label: "引用", value }]);
    } catch {
      return noted(chars, [{ label: "引用", value: "没有解析出校对结果" }]);
    }
  }
  return noted(chars, [{ label: "字数", value: `${chars}` }]);
}
