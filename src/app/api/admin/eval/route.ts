import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/current-user";
import { addManualCase, deleteManualCase, excludeSample, runBatch, saveVote, testPrompt } from "@/lib/eval-data";
import {
  acceptCandidateAsGold,
  addManualGold,
  deleteLibraryItem,
  markL1Needed,
  promoteSampleToLibrary,
  promoteWorkToLibrary,
  resolveCandidate,
} from "@/lib/eval-library";
import { runPipelineRegression, saveHumanReview } from "@/lib/eval-pipeline";
import { isFeatureId } from "@/lib/features";
import { isPlatform, type DraftInput } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "没有权限" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求不正确" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求不正确" }, { status: 400 });
  const source = body as Record<string, unknown>;

  if (source.action === "case") {
    const feature = typeof source.feature === "string" ? source.feature : "";
    if (!isFeatureId(feature)) return NextResponse.json({ error: "请选择功能" }, { status: 400 });
    const result = addManualCase(feature, String(source.title || ""), String(source.user || ""), String(source.platform || ""));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (source.action === "delete-case") {
    deleteManualCase(Number(source.id));
    return NextResponse.json({ ok: true });
  }
  if (source.action === "exclude") {
    excludeSample(Number(source.id), source.excluded !== false);
    return NextResponse.json({ ok: true });
  }
  if (source.action === "promote-sample") {
    const kind = source.kind === "anti" ? "anti" : "gold";
    const result = promoteSampleToLibrary(Number(source.id), kind);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  }
  if (source.action === "promote-work") {
    const kind = source.kind === "anti" ? "anti" : "gold";
    const path = source.path === "spoken" ? "spoken" : source.path === "main" ? "main" : undefined;
    const result = promoteWorkToLibrary(Number(source.id), kind, path);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  }
  if (source.action === "delete-library") {
    deleteLibraryItem(Number(source.id));
    return NextResponse.json({ ok: true });
  }
  if (source.action === "add-gold") {
    const draft = source.draft as DraftInput | undefined;
    if (!draft || !isPlatform(draft.platform)) return NextResponse.json({ error: "请提供可冻结的输入" }, { status: 400 });
    const result = addManualGold({
      title: String(source.title || draft.theme || "金标"),
      draft,
      path: source.path === "spoken" ? "spoken" : "main",
      kind: source.kind === "anti" ? "anti" : "gold",
      voiceDigest: typeof source.voiceDigest === "string" ? source.voiceDigest : "",
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  }
  if (source.action === "pipeline-run") {
    const ids = Array.isArray(source.ids) ? source.ids.filter((item): item is number => typeof item === "number") : undefined;
    const result = await runPipelineRegression({ ids, note: typeof source.note === "string" ? source.note : "" });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, batch: result.batch, passRate: result.passRate });
  }
  if (source.action === "human-review") {
    const likeSelf = source.likeSelf === "过" || source.likeSelf === "勉强" || source.likeSelf === "不过" ? source.likeSelf : null;
    const fitAccount = source.fitAccount === "过" || source.fitAccount === "勉强" || source.fitAccount === "不过" ? source.fitAccount : null;
    const darePublish = source.darePublish === "过" || source.darePublish === "勉强" || source.darePublish === "不过" ? source.darePublish : null;
    if (!likeSelf || !fitAccount || !darePublish) return NextResponse.json({ error: "请完成三项人审" }, { status: 400 });
    const result = saveHumanReview(Number(source.id), {
      likeSelf,
      fitAccount,
      darePublish,
      note: String(source.note || "").slice(0, 200),
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (source.action === "candidate-dismiss") {
    resolveCandidate(Number(source.id), "dismissed");
    return NextResponse.json({ ok: true });
  }
  if (source.action === "candidate-accept") {
    const result = acceptCandidateAsGold(Number(source.id));
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  }
  if (source.action === "test") {
    const feature = typeof source.feature === "string" ? source.feature : "";
    if (!isFeatureId(feature)) return NextResponse.json({ error: "请选择功能" }, { status: 400 });
    const keys = Array.isArray(source.keys) ? source.keys.filter((item): item is string => typeof item === "string") : [];
    const result = await testPrompt({ feature, body: typeof source.body === "string" ? source.body : "", keys });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, results: result.results });
  }
  if (source.action === "run") {
    const feature = typeof source.feature === "string" ? source.feature : "";
    if (!isFeatureId(feature)) return NextResponse.json({ error: "请选择功能" }, { status: 400 });
    const keys = Array.isArray(source.keys) ? source.keys.filter((item): item is string => typeof item === "string") : [];
    const result = await runBatch({
      feature,
      officialVersionId: Number(source.officialVersionId),
      variantVersionId: Number(source.variantVersionId),
      keys,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, batch: result.batch });
  }
  if (source.action === "vote") {
    const winner = source.winner === "left" || source.winner === "right" || source.winner === "tie" ? source.winner : null;
    if (!winner || typeof source.batch !== "string" || typeof source.caseKey !== "string") {
      return NextResponse.json({ error: "请选择一边" }, { status: 400 });
    }
    const result = saveVote(source.batch, source.caseKey, winner);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (source.action === "mark-l1") {
    markL1Needed(typeof source.reason === "string" ? source.reason : "需要链路回归");
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "请求不正确" }, { status: 400 });
}
