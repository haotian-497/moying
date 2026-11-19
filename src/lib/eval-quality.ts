import { database } from "@/lib/db";
import { getEvalMeta, listLibrary, listCandidates } from "@/lib/eval-library";
import { listPipelineRuns } from "@/lib/eval-pipeline";
import { FEATURES } from "@/lib/features";

export const QUALITY_TARGETS = {
  pipelinePassRate: 0.9,
  directionHardFailRate: 0.1,
  contentHardFailRate: 0.15,
  reviewAlignRate: 0.85,
  cueCoverage: 0.8,
} as const;

export function qualityOverview() {
  const gold = listLibrary("gold");
  const anti = listLibrary("anti");
  const runs = listPipelineRuns();
  const latest = runs[0] ?? null;
  const candidates = listCandidates("pending");
  const l1Needed = getEvalMeta("l1_needed") === "1";
  const l1Reason = getEvalMeta("l1_needed_reason") || "";

  const tagCounts = new Map<string, number>();
  for (const item of gold) {
    for (const tag of item.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }

  const votes = database()
    .prepare(
      `SELECT r.feature, v.winner, r.flip, COUNT(*) AS n
       FROM eval_votes v
       JOIN eval_runs r ON r.batch = v.batch AND r.case_key = v.case_key
       GROUP BY r.feature, v.winner, r.flip`,
    )
    .all() as { feature: string; winner: string; flip: number; n: number }[];

  const promoteStats = FEATURES.map((feature) => {
    let officialWins = 0;
    let variantWins = 0;
    let ties = 0;
    for (const row of votes.filter((item) => item.feature === feature.id)) {
      const n = Number(row.n);
      if (row.winner === "tie") {
        ties += n;
        continue;
      }
      const leftIsOfficial = row.flip !== 1;
      if (row.winner === "left") {
        if (leftIsOfficial) officialWins += n;
        else variantWins += n;
      } else if (row.winner === "right") {
        if (leftIsOfficial) variantWins += n;
        else officialWins += n;
      }
    }
    return { feature: feature.id, label: feature.label, officialWins, variantWins, ties };
  }).filter((item) => item.officialWins + item.variantWins + item.ties > 0);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const recentHard = database()
    .prepare(
      `SELECT feature, COUNT(*) AS n,
        SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS fails
       FROM usage_events
       WHERE feature IN ('directions', 'content') AND created_at >= ?
       GROUP BY feature`,
    )
    .all(since) as { feature: string; n: number; fails: number }[];

  const hardRates = {
    directions: (() => {
      const row = recentHard.find((item) => item.feature === "directions");
      if (!row || !row.n) return null;
      return Number(row.fails) / Number(row.n);
    })(),
    content: (() => {
      const row = recentHard.find((item) => item.feature === "content");
      if (!row || !row.n) return null;
      return Number(row.fails) / Number(row.n);
    })(),
  };

  return {
    targets: QUALITY_TARGETS,
    goldCount: gold.length,
    antiCount: anti.length,
    tagCoverage: [...tagCounts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    latestRun: latest,
    runHistory: runs.slice(0, 8),
    pendingCandidates: candidates.length,
    l1Needed,
    l1Reason,
    promoteStats,
    hardRates,
  };
}
