import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { HotItem, HotSourceId, HotSourceStatus } from "@/lib/types";
import { HOT_SOURCES } from "@/lib/types";

const TTL_MS = 30 * 60 * 1000;
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  accept: "application/json",
};

export type HotPool = { at: number; items: HotItem[]; sources: HotSourceStatus[] };

type Pool = HotPool;

const globalForHot = globalThis as unknown as { moyinHotPool?: Pool; moyinHotPoolLoaded?: boolean };

function poolPath() {
  return path.join(process.cwd(), "data", "hot-pool.json");
}

function isHotSourceId(value: unknown): value is HotSourceId {
  return typeof value === "string" && (HOT_SOURCES as readonly string[]).includes(value);
}

function readStoredPool(): Pool | null {
  try {
    const raw = JSON.parse(readFileSync(poolPath(), "utf8")) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const row = raw as { at?: unknown; items?: unknown; sources?: unknown };
    if (typeof row.at !== "number" || !Number.isFinite(row.at) || !Array.isArray(row.items) || row.items.length === 0) return null;
    const items: HotItem[] = [];
    for (const entry of row.items) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Partial<HotItem>;
      if (typeof item.title !== "string" || !item.title.trim() || !isHotSourceId(item.source)) continue;
      if (typeof item.rank !== "number" || !Number.isFinite(item.rank)) continue;
      items.push({
        title: item.title,
        source: item.source,
        rank: item.rank,
        heat: typeof item.heat === "number" && Number.isFinite(item.heat) ? item.heat : null,
        summary: typeof item.summary === "string" ? item.summary : "",
      });
    }
    if (items.length === 0) return null;
    const sources: HotSourceStatus[] = Array.isArray(row.sources)
      ? row.sources.flatMap((entry) => {
          if (!entry || typeof entry !== "object") return [];
          const source = entry as Partial<HotSourceStatus>;
          if (!isHotSourceId(source.id)) return [];
          return [{ id: source.id, ok: Boolean(source.ok), error: typeof source.error === "string" ? source.error : "" }];
        })
      : [];
    return { at: row.at, items, sources };
  } catch {
    return null;
  }
}

function writeStoredPool(pool: Pool) {
  try {
    mkdirSync(path.dirname(poolPath()), { recursive: true });
    writeFileSync(poolPath(), JSON.stringify(pool), "utf8");
  } catch (error) {
    console.error(error);
  }
}

function cleanTitle(value: string) {
  const text = value.replace(/^#+|#+$/g, "").replace(/\s+/g, " ").trim();
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function asHeat(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())) {
    const heat = Number(value);
    return heat > 0 ? Math.round(heat) : null;
  }
  return null;
}

function cleanSummary(value: string, title: string) {
  const text = value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 8) return "";
  if (text.replace(/\s/g, "") === title.replace(/\s/g, "")) return "";
  if (text.length <= 140) return text;
  const cut = text.slice(0, 140);
  const end = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("，"));
  return end > 40 ? cut.slice(0, end + 1) : `${cut}…`;
}

function takeRows(source: HotSourceId, rows: { title: string; heat: number | null; summary?: string }[], limit = 20) {
  const items: HotItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const title = cleanTitle(row.title);
    if (title.length < 2 || seen.has(title)) continue;
    seen.add(title);
    items.push({ title, source, rank: items.length + 1, heat: row.heat, summary: cleanSummary(row.summary || "", title) });
    if (items.length >= limit) break;
  }
  return items;
}

async function fetchJson(url: string, referer: string) {
  const response = await fetch(url, {
    headers: { ...HEADERS, referer },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`热点源返回 ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function fetchWeibo(): Promise<HotItem[]> {
  const data = (await fetchJson("https://weibo.com/ajax/side/hotSearch", "https://weibo.com/")) as {
    data?: { realtime?: { word?: string; num?: unknown; icon_desc?: string; small_icon_desc?: string }[] };
  };
  const rows = data.data?.realtime;
  if (!Array.isArray(rows)) throw new Error("微博热搜格式变了");
  const items = takeRows(
    "weibo",
    rows
      .filter((item) => item.icon_desc !== "商" && item.small_icon_desc !== "商")
      .map((item) => ({ title: item.word || "", heat: asHeat(item.num) })),
  );
  if (items.length === 0) throw new Error("微博热搜是空的");
  return items;
}

async function fetchBaidu(): Promise<HotItem[]> {
  const data = (await fetchJson(
    "https://top.baidu.com/api/board?platform=pc&tab=realtime",
    "https://top.baidu.com/board?tab=realtime",
  )) as { data?: { cards?: { content?: unknown }[] } };
  const content = data.data?.cards?.[0]?.content;
  const nested = Array.isArray(content) && content[0] && typeof content[0] === "object" && content[0] && "content" in content[0]
    ? (content[0] as { content?: { word?: string; hotScore?: unknown }[] }).content
    : content;
  if (!Array.isArray(nested)) throw new Error("百度热搜格式变了");
  const rows = nested.map((item) => {
    if (!item || typeof item !== "object") return { title: "", heat: null };
    const row = item as { word?: string; hotScore?: unknown; desc?: string };
    return {
      title: typeof row.word === "string" ? row.word : "",
      heat: asHeat(row.hotScore),
      summary: typeof row.desc === "string" ? row.desc : "",
    };
  });
  const items = takeRows("baidu", rows);
  if (items.length === 0) throw new Error("百度热搜是空的");
  return items;
}

async function fetchDouyin(): Promise<HotItem[]> {
  const data = (await fetchJson("https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/", "https://www.douyin.com/")) as {
    word_list?: { word?: string; hot_value?: unknown }[];
  };
  const rows = data.word_list;
  if (!Array.isArray(rows)) throw new Error("抖音热榜格式变了");
  const items = takeRows(
    "douyin",
    rows.map((item) => ({ title: item.word || "", heat: asHeat(item.hot_value) })),
  );
  if (items.length === 0) throw new Error("抖音热榜是空的");
  return items;
}

async function fetchToutiao(): Promise<HotItem[]> {
  const data = (await fetchJson("https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc", "https://www.toutiao.com/")) as {
    data?: { Title?: string; HotValue?: unknown; Label?: string }[];
  };
  const rows = data.data;
  if (!Array.isArray(rows)) throw new Error("头条热榜格式变了");
  const items = takeRows(
    "toutiao",
    rows.filter((item) => item.Label !== "ad").map((item) => ({ title: item.Title || "", heat: asHeat(item.HotValue) })),
  );
  if (items.length === 0) throw new Error("头条热榜是空的");
  return items;
}

function zhihuHeat(text: string) {
  const wan = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*万/);
  if (wan) return Math.round(Number(wan[1]) * 10000);
  return asHeat(text.replace(/[^\d.]/g, ""));
}

async function fetchZhihu(): Promise<HotItem[]> {
  const data = (await fetchJson(
    "https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=30&desktop=true",
    "https://www.zhihu.com/",
  )) as {
    data?: { target?: { title_area?: { text?: string }; excerpt_area?: { text?: string }; metrics_area?: { text?: string } } }[];
  };
  const rows = data.data;
  if (!Array.isArray(rows)) throw new Error("知乎热榜格式变了");
  const items = takeRows(
    "zhihu",
    rows.map((item) => ({
      title: item.target?.title_area?.text || "",
      heat: zhihuHeat(item.target?.metrics_area?.text || ""),
      summary: clipExcerpt(item.target?.excerpt_area?.text || ""),
    })),
  );
  if (items.length === 0) throw new Error("知乎热榜是空的");
  return items;
}

async function fetchBilibili(): Promise<HotItem[]> {
  const data = (await fetchJson("https://s.search.bilibili.com/main/hotword?limit=30", "https://www.bilibili.com/")) as {
    list?: { show_name?: string; keyword?: string; heat_score?: unknown; stat_datas?: { is_commercial?: string } }[];
  };
  const rows = data.list;
  if (!Array.isArray(rows)) throw new Error("B站热搜格式变了");
  const items = takeRows(
    "bilibili",
    rows
      .filter((item) => item.stat_datas?.is_commercial !== "1")
      .map((item) => ({ title: item.show_name || item.keyword || "", heat: asHeat(item.heat_score) })),
  );
  if (items.length === 0) throw new Error("B站热搜是空的");
  return items;
}

function clipExcerpt(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  const stop = clean.search(/_ |\s+https?:/);
  return stop > 24 ? clean.slice(0, stop) : clean;
}

function sharesPhrase(title: string, text: string) {
  const compactTitle = title.replace(/\s/g, "");
  const compact = text.replace(/\s/g, "");
  for (let index = 0; index + 2 <= compactTitle.length; index += 1) {
    if (compact.includes(compactTitle.slice(index, index + 2))) return true;
  }
  return false;
}

function novelScore(title: string, text: string) {
  const compactTitle = title.replace(/\s/g, "");
  const compact = text.replace(/\s/g, "");
  let score = 0;
  for (let index = 0; index + 2 <= compact.length; index += 1) {
    if (!compactTitle.includes(compact.slice(index, index + 2))) score += 1;
  }
  return score;
}

async function relatedSummary(title: string) {
  const data = (await fetchJson(
    `https://weibo.com/ajax/side/search?q=${encodeURIComponent(title)}`,
    "https://weibo.com/",
  )) as { data?: { hotquery?: { suggestion?: string }[] } };
  const suggestions = data.data?.hotquery?.map((item) => (item.suggestion || "").replace(/\s+/g, " ").trim()).filter(Boolean) ?? [];
  const useful = suggestions.filter((text) => {
    const compactTitle = title.replace(/\s/g, "");
    const compact = text.replace(/\s/g, "");
    return compact.length >= 4 && compact !== compactTitle && !compactTitle.includes(compact) && sharesPhrase(title, text) && novelScore(title, text) >= 3;
  });
  const ranked = [...useful].sort((left, right) => novelScore(title, right) - novelScore(title, left));
  const extended = ranked.find((text) => text.includes(title) && text.length > title.length + 2);
  return cleanSummary(extended || ranked[0] || "", title);
}

async function fillMissingSummaries(items: HotItem[]) {
  const missing = items.filter((item) => !item.summary);
  let cursor = 0;
  async function worker() {
    while (cursor < missing.length) {
      const item = missing[cursor];
      cursor += 1;
      try {
        item.summary = await relatedSummary(item.title);
      } catch (error) {
        console.error(error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, () => worker()));
}

function shareSummaries(items: HotItem[]) {
  const summaryByTitle = new Map<string, string>();
  for (const item of items) {
    if (item.summary) summaryByTitle.set(item.title, item.summary);
  }
  for (const item of items) {
    if (!item.summary) {
      const summary = summaryByTitle.get(item.title);
      if (summary) item.summary = summary;
    }
  }
  return items;
}

const FETCHERS: { id: HotSourceId; run: () => Promise<HotItem[]> }[] = [
  { id: "weibo", run: fetchWeibo },
  { id: "baidu", run: fetchBaidu },
  { id: "douyin", run: fetchDouyin },
  { id: "toutiao", run: fetchToutiao },
  { id: "zhihu", run: fetchZhihu },
  { id: "bilibili", run: fetchBilibili },
];

export function peekHotPool() {
  if (!globalForHot.moyinHotPoolLoaded) {
    globalForHot.moyinHotPoolLoaded = true;
    if (!globalForHot.moyinHotPool || globalForHot.moyinHotPool.items.length === 0) {
      const stored = readStoredPool();
      if (stored) globalForHot.moyinHotPool = stored;
    }
  }
  const cached = globalForHot.moyinHotPool;
  if (!cached || cached.items.length === 0) return null;
  return cached;
}

export async function getHotPool(refresh = false) {
  const cached = peekHotPool();
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) return cached;
  const settled = await Promise.allSettled(FETCHERS.map((item) => item.run()));
  const sources: HotSourceStatus[] = FETCHERS.map((item, index) => {
    const result = settled[index];
    if (result?.status === "fulfilled") return { id: item.id, ok: true, error: "" };
    const reason = result?.status === "rejected" && result.reason instanceof Error ? result.reason.message : "抓取失败";
    return { id: item.id, ok: false, error: reason };
  });
  const items = shareSummaries(settled.flatMap((result) => (result.status === "fulfilled" ? result.value : [])));
  try {
    await fillMissingSummaries(items);
  } catch (error) {
    console.error(error);
  }
  if (items.length === 0) {
    const reason = sources
      .filter((item) => !item.ok)
      .map((item) => item.error)
      .join("；");
    throw new Error(reason || "今天没有抓到热点");
  }
  for (const result of settled) {
    if (result.status === "rejected") console.error(result.reason);
  }
  const pool = { at: Date.now(), items, sources };
  globalForHot.moyinHotPool = pool;
  globalForHot.moyinHotPoolLoaded = true;
  writeStoredPool(pool);
  return pool;
}
