import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getHotPool, peekHotPool } from "@/lib/hot-sources";
import { generateHotTake, getLlmStatus } from "@/lib/llm";
import { HOT_SOURCE_LABEL, platformLabel, sameTopic, topicKey, type HotItem, type HotMatch, type HotRelevance, type HotSourceId, type HotTake, type HotTopic, type HotTopicKind, type MediaAccount, type PersonalProfile, type Platform } from "@/lib/types";

const EMPTY_NOTE = "今天没有适合这个账号蹭的点。";

type TakeCache = Map<string, HotTake>;

const globalForTake = globalThis as unknown as { moyinHotTake?: TakeCache; moyinHotTakeLoaded?: boolean };

function takesPath() {
  return path.join(process.cwd(), "data", "hot-takes.json");
}

function readStoredTakes(): TakeCache {
  const map: TakeCache = new Map();
  try {
    const raw = JSON.parse(readFileSync(takesPath(), "utf8")) as unknown;
    if (!Array.isArray(raw)) return map;
    for (const entry of raw) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [key, take] = entry;
      if (typeof key !== "string" || !take || typeof take !== "object") continue;
      const row = take as HotTake;
      if (!Array.isArray(row.matches) || !Array.isArray(row.board)) continue;
      map.set(key, row);
    }
  } catch {
    /* no prior takes */
  }
  return map;
}

function writeStoredTakes(map: TakeCache) {
  try {
    mkdirSync(path.dirname(takesPath()), { recursive: true });
    writeFileSync(takesPath(), JSON.stringify([...map.entries()]), "utf8");
  } catch (error) {
    console.error(error);
  }
}

function cache() {
  if (!globalForTake.moyinHotTakeLoaded) {
    globalForTake.moyinHotTakeLoaded = true;
    globalForTake.moyinHotTake = readStoredTakes();
  }
  if (!globalForTake.moyinHotTake) globalForTake.moyinHotTake = new Map();
  return globalForTake.moyinHotTake;
}

function clip(text: string, max = 16) {
  const compact = text.replace(/\s+/g, "");
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

const LOCAL_WHY: Record<HotTopicKind, string> = {
  tight: "就着这条热点写，只讲和这个账号有关的那一点",
  bridge: "从热点里只借一个问题，回到这个账号平时要写的事",
  own: "这是账号本来就会写的题材，热点只用来开头",
  regular: "不借今天的热点，写这个号本来就会写的题",
};

const PLATFORM_WHY: Record<Platform, string> = {
  xiaohongshu: "适合小红书短段，标题里放一个具体做法",
  wechat: "适合公众号用一节把这一点讲完",
  zhihu: "适合知乎先给结论，再拆原因",
  weibo: "适合微博用一句态度说完",
  douyin: "适合抖音开头三秒就停住，接着口播",
  bilibili: "适合 B 站拆成一段有信息量的讲解",
  shipinhao: "适合视频号用好懂的口播说完",
  moments: "适合朋友圈写成发给熟人的短文",
};

function fitTitle(text: string) {
  const compact = text.replace(/\s+/g, "");
  return compact.length > 40 ? `${compact.slice(0, 39)}…` : compact;
}

function localTitle(kind: HotTopicKind, item: HotItem, account: MediaAccount, platform: Platform) {
  const hot = clip(item.title, 12);
  const persona = clip(account.persona, 8);
  const problem = clip(account.problem, 10);
  if (platform === "xiaohongshu") {
    if (kind === "tight") return fitTitle(`${hot}里，${persona}能照做的一个做法`);
    if (kind === "bridge") return fitTitle(`只解决${problem}：从${hot}借一个问题`);
    return fitTitle(`${persona}本来就能写，${hot}只是由头`);
  }
  if (platform === "wechat") {
    if (kind === "tight") return fitTitle(`${hot}：和${persona}有关的那一件事`);
    if (kind === "bridge") return fitTitle(`从${hot}只取一个问题，回到${problem}`);
    return fitTitle(`写${persona}，用${hot}当开头`);
  }
  if (platform === "zhihu") {
    if (kind === "tight") return fitTitle(`怎么看${hot}里和${persona}有关的部分`);
    if (kind === "bridge") return fitTitle(`${hot}只说明一个问题：${problem}`);
    return fitTitle(`${persona}该怎么做，${hot}只是由头`);
  }
  if (platform === "weibo") {
    if (kind === "tight") return fitTitle(`${hot}，其实在说${persona}`);
    if (kind === "bridge") return fitTitle(`${hot}里我只认一个问题：${problem}`);
    return fitTitle(`还是写${persona}，${hot}只是由头`);
  }
  if (platform === "douyin" || platform === "shipinhao") {
    if (kind === "tight") return fitTitle(`先说结论：${hot}和${persona}有关的一点`);
    if (kind === "bridge") return fitTitle(`${hot}先放一边，只讲${problem}`);
    return fitTitle(`${persona}怎么做，${hot}只用来开场`);
  }
  if (platform === "bilibili") {
    if (kind === "tight") return fitTitle(`拆开${hot}里和${persona}有关的部分`);
    if (kind === "bridge") return fitTitle(`${hot}里只留一个问题：${problem}`);
    return fitTitle(`${persona}的做法，用${hot}当由头`);
  }
  if (kind === "tight") return fitTitle(`${hot}里，和${persona}有关的一件小事`);
  if (kind === "bridge") return fitTitle(`从${hot}只借一个问题：${problem}`);
  return fitTitle(`还是聊${persona}，${hot}只是由头`);
}

const STOP = new Set([
  "一个",
  "我们",
  "你们",
  "他们",
  "自己",
  "可以",
  "不是",
  "就是",
  "这个",
  "那个",
  "什么",
  "怎么",
  "如何",
  "因为",
  "所以",
  "如果",
  "但是",
  "而且",
  "以及",
  "通过",
  "进行",
  "需要",
  "已经",
  "没有",
  "还是",
  "或者",
  "内容",
  "问题",
  "用户",
  "账号",
  "主要",
  "解决",
  "目标",
  "今天",
  "大家",
  "时候",
  "地方",
  "事情",
  "知道",
  "觉得",
  "可能",
  "应该",
]);

function anchors(text: string) {
  const parts = text
    .split(/[^\u4e00-\u9fffA-Za-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  const found = new Set<string>();
  for (const part of parts) {
    if (part.length <= 8 && !STOP.has(part)) found.add(part);
    for (let index = 0; index + 2 <= part.length; index += 1) {
      const two = part.slice(index, index + 2);
      if (!STOP.has(two)) found.add(two);
    }
  }
  return [...found];
}

function freshLocalTopics(items: HotItem[], account: MediaAccount, platform: Platform, written: string[]) {
  const kinds: HotTopicKind[] = ["tight", "bridge"];
  const topics: HotTopic[] = [];
  const used = new Set<string>();
  for (const kind of kinds) {
    const ordered = [...items.filter((item) => !used.has(item.title)), ...items.filter((item) => used.has(item.title))];
    const topic = ordered
      .map((item) => ({ title: localTitle(kind, item, account, platform), kind, basedOn: item.title, why: `${LOCAL_WHY[kind]}。${PLATFORM_WHY[platform]}` }))
      .find((item) => !written.some((theme) => sameTopic(theme, item.title)) && !topics.some((chosen) => sameTopic(chosen.title, item.title)));
    if (topic) {
      topics.push(topic);
      used.add(topic.basedOn);
    }
  }
  return topics;
}

function localTake(items: HotItem[], account: MediaAccount, personal: PersonalProfile, platform: Platform, fetchedAt: string, written: string[]): Omit<HotTake, "board" | "sources"> {
  if (items.length === 0) {
    return { matches: [], topics: [], note: "今天没有抓到热点。", fetchedAt, matchedBy: "local" };
  }
  const fields: { link: string; terms: string[] }[] = [
    { link: "主要内容", terms: anchors(account.persona) },
    { link: "要解决的问题", terms: anchors(account.problem) },
    { link: "目标用户", terms: anchors(account.audience) },
    { link: "作者本人", terms: anchors(`${personal.occupation} ${personal.industry}`) },
  ];
  const ranked = items
    .map((item) => {
      let best = { link: "", term: "", score: 0 };
      for (const field of fields) {
        for (const term of field.terms) {
          if (!item.title.includes(term)) continue;
          const score = term.length;
          if (score > best.score) best = { link: field.link, term, score };
        }
      }
      return { item, ...best };
    })
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score || a.item.rank - b.item.rank)
    .slice(0, 12);
  const matches: HotMatch[] = ranked.map((item) => {
    const fit: HotRelevance = item.score >= 4 ? "high" : "mid";
    return {
      ...item.item,
      reason: `「${item.term}」和这个账号的${item.link}对得上。`,
      bridge: `用${platformLabel(platform)}的格式，借「${clip(item.item.title, 12)}」当由头，回到${clip(account.problem, 12)}。`,
      caution: "",
      fit,
      link: item.link,
    };
  });
  const topics = freshLocalTopics(
    matches.map((item) => item),
    account,
    platform,
    written,
  );
  const note =
    matches.length === 0
      ? "模型还没接上，没法逐条判断。榜单标题里也没有和账号定位相同的词。"
      : topics.length < 2
        ? "模型还没接上。能对上用词、又没写过的热点话题不够两条。"
        : "";
  return { matches, topics, note, fetchedAt, matchedBy: "local" };
}

function withBoard(take: Omit<HotTake, "board" | "sources">, pool: { items: HotTake["board"]; sources: HotTake["sources"] }): HotTake {
  return { ...take, board: pool.items, sources: pool.sources ?? [] };
}

export async function takeForAccount(personal: PersonalProfile, account: MediaAccount, platform: Platform, written: string[], refresh = false) {
  const pool = refresh ? await getHotPool(true) : peekHotPool();
  if (!pool) return null;
  const fetchedAt = new Date(pool.at).toISOString();
  const key = [
    account.id,
    account.updatedAt,
    personal.updatedAt,
    platform,
    getLlmStatus().mode,
    written.map((theme) => topicKey(theme)).sort().join("|"),
    pool.items.map((item) => `${item.source}:${item.rank}:${item.title}:${item.summary ? "1" : "0"}`).join("|"),
    "topics-from-matches",
  ].join("\n");
  const hit = cache().get(key);
  if (hit) return withBoard(hit, pool);

  let take: Omit<HotTake, "board" | "sources">;
  if (getLlmStatus().mode === "live") {
    const result = await generateHotTake({ personal, account, platform, items: pool.items, written });
    const fitOrder = { high: 0, mid: 1, low: 2, unknown: 3 };
    take = {
      ...result,
      fetchedAt,
      matchedBy: "model",
      matches: [...result.matches].sort((a, b) => fitOrder[a.fit] - fitOrder[b.fit] || a.rank - b.rank),
    };
  } else {
    take = localTake(pool.items, account, personal, platform, fetchedAt, written);
  }
  if (take.matches.length === 0 && take.topics.length === 0 && !take.note) take.note = EMPTY_NOTE;
  const stored = { ...take, board: pool.items, sources: pool.sources ?? [] };
  const map = cache();
  map.set(key, stored);
  writeStoredTakes(map);
  return withBoard(take, pool);
}

export function hotSourceLabel(source: string) {
  return source in HOT_SOURCE_LABEL ? HOT_SOURCE_LABEL[source as HotSourceId] : source;
}
