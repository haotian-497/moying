export const PLATFORMS = [
  { id: "wechat", label: "微信公众号", hint: "有小标题的完整文章" },
  { id: "zhihu", label: "知乎", hint: "先给结论，再拆原因" },
  { id: "weibo", label: "微博", hint: "短、快、有态度" },
  { id: "douyin", label: "抖音口播脚本", hint: "前三秒抓人的口语稿" },
  { id: "bilibili", label: "B站视频文案", hint: "有悬念的中视频脚本" },
  { id: "xiaohongshu", label: "小红书", hint: "短段笔记，标题要具体" },
  { id: "shipinhao", label: "视频号", hint: "好懂、适合转发的口播" },
  { id: "moments", label: "朋友圈", hint: "像发给熟人的短文" },
] as const;

export const PUBLISH_PLATFORMS = ["xiaohongshu", "wechat", "zhihu", "weibo", "douyin", "bilibili"] as const;

export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

export const STYLES = ["真诚分享", "干货清单", "故事叙事", "犀利观点", "温暖治愈", "轻松幽默"] as const;

export type Platform = (typeof PLATFORMS)[number]["id"];

export type PersonalFields = {
  age: string;
  occupation: string;
  industry: string;
  personality: string;
};

export type PersonalProfile = PersonalFields & {
  updatedAt: string | null;
};

export const EMPTY_PERSONAL: PersonalProfile = {
  age: "",
  occupation: "",
  industry: "",
  personality: "",
  updatedAt: null,
};

export type MediaAccountInput = {
  name: string;
  platforms: Platform[];
  persona: string;
  problem: string;
  audience: string;
  notes: string;
};

export type AccountWriting = {
  platform: PublishPlatform;
  style: string;
  length: string;
  reader: string;
};

export type MediaAccount = MediaAccountInput & AccountWriting & {
  id: number;
  styleDigest: string;
  updatedAt: string;
};

export type SectionField = {
  label: string;
  hint: string;
  required: boolean;
};

export type ContentSection = {
  id: number;
  accountId: number;
  name: string;
  purpose: string;
  guide: string;
  fields: SectionField[];
};

export type WorkSection = {
  id: number;
  name: string;
  purpose: string;
  guide: string;
  fields: SectionField[];
};

export type AccountIdea = {
  title: string;
  why: string;
};

export type TopicPoolItem = {
  id: number;
  accountId: number;
  subject: string;
  note: string;
  source: string;
  planDate: string;
  status: "idea" | "done";
  hotspot: WorkHotspot | null;
  createdAt: string;
};

export type VoiceCue = {
  digest: string;
  excerpts: string[];
};

export function formatAge(age: string) {
  const text = age.trim();
  return /^\d{1,3}$/.test(text) ? `${text}岁` : text;
}

export function isPersonalReady(profile: PersonalFields) {
  const age = profile.age.trim();
  const ageReady = /^\d+$/.test(age) ? Number(age) >= 1 && Number(age) <= 120 : age.length >= 2;
  return ageReady && profile.occupation.trim().length >= 2 && profile.industry.trim().length >= 2 && profile.personality.trim().length >= 2;
}

export function isMediaReady(account: Pick<MediaAccountInput, "platforms" | "persona" | "problem" | "audience">) {
  return account.platforms.length > 0 && account.persona.trim().length >= 2 && account.problem.trim().length >= 2 && account.audience.trim().length >= 2;
}

export type WorkHotspot = {
  title: string;
  summary: string;
};

export type PieceInput = {
  theme: string;
  platform: Platform;
  style: string;
  notes: string;
  length: string;
  reader: string;
  accountId: number;
  hotspot: WorkHotspot | null;
  sectionId: number | null;
  inputs: Record<string, string>;
};

export type DraftInput = Omit<PieceInput, "accountId" | "hotspot" | "sectionId"> &
  PersonalFields & {
    accountId: number | null;
    accountName: string;
    audience: string;
    length: string;
    persona: string;
    problem: string;
    profileNotes: string;
    hotspot: WorkHotspot | null;
    section: WorkSection | null;
    inputs: Record<string, string>;
  };

export const HOT_SOURCES = ["weibo", "baidu", "douyin", "toutiao", "zhihu", "bilibili"] as const;

export type HotSourceId = (typeof HOT_SOURCES)[number];

export const HOT_SOURCE_LABEL: Record<HotSourceId, string> = {
  weibo: "微博热搜",
  baidu: "百度热搜",
  douyin: "抖音热榜",
  toutiao: "今日头条",
  zhihu: "知乎热榜",
  bilibili: "B站热搜",
};

export type HotRelevance = "high" | "mid" | "low" | "unknown";

export const HOT_RELEVANCE_LABEL: Record<HotRelevance, string> = {
  high: "高",
  mid: "中",
  low: "低",
  unknown: "未判断",
};

export type HotSourceStatus = {
  id: HotSourceId;
  ok: boolean;
  error: string;
};

export type HotItem = {
  title: string;
  source: HotSourceId;
  rank: number;
  heat: number | null;
  summary: string;
};

export type HotMatch = HotItem & {
  reason: string;
  bridge: string;
  caution: string;
  fit: HotRelevance;
  link: string;
};

export type HotTopicKind = "tight" | "bridge" | "own" | "regular";

export const HOT_TOPIC_LABEL: Record<HotTopicKind, string> = {
  tight: "就写这条热点",
  bridge: "借来写自己的事",
  own: "拿热点当由头",
  regular: "不蹭热点",
};

export type HotTopic = {
  title: string;
  kind: HotTopicKind;
  basedOn: string;
  why: string;
};

export function topicKey(text: string) {
  return text.trim().replace(/\s+/g, "").replace(/[「」“”‘’"'，。！？、,.!?;；:：·…—\-()（）【】[\]《》]/g, "").toLowerCase();
}

export function sameTopic(left: string, right: string) {
  const a = topicKey(left);
  const b = topicKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.length >= 8 && long.includes(short);
}

export type HotTake = {
  matches: HotMatch[];
  topics: HotTopic[];
  note: string;
  fetchedAt: string;
  matchedBy: "model" | "local";
  board: HotItem[];
  sources: HotSourceStatus[];
};

export type Direction = {
  label?: string;
  title: string;
  angle: string;
  hook: string;
  outline: string[];
  why: string;
};

export const SPOKEN_TONE_TAGS = ["日常", "激动", "沉稳", "吐槽", "温柔"] as const;

export type SpokenToneTag = (typeof SPOKEN_TONE_TAGS)[number];

export type SpokenCueLine = {
  quote: string;
  emotion: string;
  toneTag: SpokenToneTag;
  stress: string[];
  pause: string;
  expression: string;
  gesture: string;
};

export type SpokenCues = {
  overall: {
    tone: string;
    pace: string;
    note: string;
  };
  cues: SpokenCueLine[];
  coverage: number;
  dropped: number;
  at: string;
};

export type CopyContent = {
  titles: string[];
  coverText: string;
  body: string;
  cta: string;
  hashtags: string[];
  publishNotes: string;
  review?: CopyReview;
};

export function copyTitle(content: { titles: string[] }) {
  return content.titles.map((title) => title.trim()).find(Boolean) ?? "";
}

export type CopyIssueKind = "typo" | "punct" | "flow" | "repeat" | "conflict" | "sensitive";

export const COPY_ISSUE_LABEL: Record<CopyIssueKind, string> = {
  typo: "错字",
  punct: "标点",
  flow: "语句不通",
  repeat: "重复啰嗦",
  conflict: "前后矛盾",
  sensitive: "敏感",
};

export type CopyIssueWhere = "title" | "cover" | "body" | "cta" | "hashtag";

export const COPY_ISSUE_WHERE: Record<CopyIssueWhere, string> = {
  title: "标题",
  cover: "封面",
  body: "正文",
  cta: "结尾",
  hashtag: "标签",
};

export type CopyIssue = {
  kind: CopyIssueKind;
  where: CopyIssueWhere;
  quote: string;
  suggestion: string;
  note: string;
  count?: number;
};

export type ReviewVerdict = "ok" | "minor" | "bad";

export const REVIEW_VERDICT_LABEL: Record<ReviewVerdict, string> = {
  ok: "可以直接发",
  minor: "还有几处要你看",
  bad: "建议重写",
};

export const REVIEW_DIMENSIONS = ["账号调性", "平台调性", "公序良俗", "法律风险", "热点使用", "事实存疑"] as const;

export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number];

export type ReviewFlag = {
  dimension: ReviewDimension;
  level: "高" | "中";
  quote: string;
  what: string;
  suggestion: string;
  locatable?: boolean;
};

export type CopyReview = {
  issues: CopyIssue[];
  flags?: ReviewFlag[];
  verdict?: ReviewVerdict;
  summary?: string;
  risk?: "高" | "中" | "无";
  dropped?: number;
  padded?: number;
  failed: boolean;
  checkedAt: string;
};

export const REWRITE_ACTIONS = [
  { id: "expand", label: "扩写" },
  { id: "professional", label: "专业点" },
  { id: "casual", label: "轻松点" },
  { id: "shorten", label: "缩写" },
  { id: "example", label: "举个例子" },
  { id: "clarify", label: "写得更容易理解" },
] as const;

export const INSERT_ACTIONS = [
  { id: "add", label: "补一句" },
  { id: "next", label: "接下去" },
  { id: "example", label: "举个例子" },
] as const;

export type RewriteAction = (typeof REWRITE_ACTIONS)[number]["id"];
export type InsertAction = (typeof INSERT_ACTIONS)[number]["id"] | "custom";

export type AssistRequest = {
  kind: "rewrite" | "insert";
  action: RewriteAction | InsertAction;
  selection: string;
  before: string;
  after: string;
  instruction: string;
};

export type VoiceSample = {
  id: number;
  accountId: number;
  text: string;
  source: "paste" | "draft";
  createdAt: string;
};

export type PlatformCopy = {
  platform: Platform;
  content: CopyContent;
};

export type WorkStatus = "ready" | "draft" | "failed";

export type WorkSummary = {
  id: number;
  theme: string;
  platform: Platform;
  style: string;
  status: WorkStatus;
  updatedAt: string;
};

export type Work = {
  id: number;
  theme: string;
  platform: Platform;
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
  directions: Direction[] | null;
  selectedIndex: number | null;
  content: CopyContent | null;
  cues: SpokenCues | null;
  variants: PlatformCopy[] | null;
  variantsStale: boolean;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LlmStatus = {
  mode: "live" | "mock" | "missing";
  model: string | null;
};

export function platformLabel(id: string) {
  return PLATFORMS.find((item) => item.id === id)?.label ?? id;
}

export function isPlatform(value: string): value is Platform {
  return PLATFORMS.some((item) => item.id === value);
}

export function isPublishPlatform(value: string): value is PublishPlatform {
  return (PUBLISH_PLATFORMS as readonly string[]).includes(value);
}
