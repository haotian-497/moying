import { database, listRecentFailures, listUsageByFeature } from "@/lib/db";
import { estimateYuan, listPrices } from "@/lib/pricing";

export function sinceFromDays(value: string | undefined) {
  const days = value === "1" || value === "30" || value === "90" ? Number(value) : 7;
  return { days, since: new Date(Date.now() - days * 86400000).toISOString() };
}

export function overviewStats(since: string) {
  const db = database();
  const users = db.prepare("SELECT SUM(CASE WHEN is_guest = 1 THEN 1 ELSE 0 END) AS guests, SUM(CASE WHEN is_guest = 0 THEN 1 ELSE 0 END) AS members FROM users").get() as {
    guests: number | null;
    members: number | null;
  };
  const works = db.prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN content_json IS NOT NULL THEN 1 ELSE 0 END) AS ready FROM works").get() as {
    n: number;
    ready: number | null;
  };
  const usage = db
    .prepare(
      `SELECT COUNT(*) AS calls, SUM(ok) AS ok_count, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, AVG(latency_ms) AS avg_latency
      FROM usage_events WHERE created_at >= ?`,
    )
    .get(since) as {
    calls: number;
    ok_count: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
    avg_latency: number | null;
  };
  const days = db
    .prepare(
      `SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS calls
      FROM usage_events WHERE created_at >= ? GROUP BY day ORDER BY day`,
    )
    .all(since) as { day: string; calls: number }[];
  const calls = Number(usage.calls);
  const okCount = Number(usage.ok_count ?? 0);
  return {
    members: Number(users.members ?? 0),
    guests: Number(users.guests ?? 0),
    works: Number(works.n),
    readyWorks: Number(works.ready ?? 0),
    calls,
    successRate: calls === 0 ? null : Math.round((okCount / calls) * 100),
    inputTokens: Number(usage.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? 0),
    avgLatencyMs: usage.avg_latency == null ? null : Math.round(Number(usage.avg_latency)),
    days: days.map((row) => ({ day: row.day.slice(5), calls: Number(row.calls) })),
    failures: listRecentFailures(8, since),
    byFeature: listUsageByFeature(since),
  };
}

type CostRow = { model: string; feature: string; input_tokens: number | null; output_tokens: number | null; calls: number };

export function costStats(since: string) {
  const rows = database()
    .prepare(
      `SELECT model, feature, SUM(input_tokens) AS input_tokens, SUM(output_tokens) AS output_tokens, COUNT(*) AS calls
      FROM usage_events WHERE created_at >= ? AND ok = 1 GROUP BY model, feature`,
    )
    .all(since) as CostRow[];
  return {
    prices: listPrices(),
    rows: rows.map((row) => {
      const inputTokens = Number(row.input_tokens ?? 0);
      const outputTokens = Number(row.output_tokens ?? 0);
      return {
        feature: row.feature,
        model: row.model || "未知模型",
        calls: Number(row.calls),
        inputTokens,
        outputTokens,
        yuan: estimateYuan(row.model, inputTokens, outputTokens),
      };
    }),
  };
}
