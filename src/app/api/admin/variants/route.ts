import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/current-user";
import { markL1Needed } from "@/lib/eval-library";
import { isFeatureId } from "@/lib/features";
import { createVariant, getVariantVersion, rollbackVariant, savePromptVersion, saveVariantVersion } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const source = body as { action?: unknown; feature?: unknown; name?: unknown; body?: unknown; note?: unknown; variantId?: unknown; versionId?: unknown };
  const feature = typeof source.feature === "string" ? source.feature : "";
  if (source.action === "create") {
    if (!isFeatureId(feature)) return NextResponse.json({ error: "请选择功能" }, { status: 400 });
    const result = createVariant(feature, String(source.name || ""), String(source.body || ""), String(source.note || ""), admin.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  }
  if (source.action === "save") {
    const result = saveVariantVersion(Number(source.variantId), String(source.body || ""), String(source.note || ""), admin.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (source.action === "rollback") {
    const result = rollbackVariant(Number(source.variantId), Number(source.versionId), admin.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (source.action === "promote") {
    const version = getVariantVersion(Number(source.versionId));
    if (!version || !isFeatureId(version.feature)) return NextResponse.json({ error: "没有这一版试验稿" }, { status: 400 });
    const note = typeof source.note === "string" ? source.note.trim() : "";
    const result = savePromptVersion(version.feature, version.body, note || `采用试验「${version.name}」`, admin.id, "从试验稿采用");
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    markL1Needed(`已采用试验稿到正式版（${version.feature}），请跑一次产品回归`);
    return NextResponse.json({ ok: true, l1Needed: true });
  }
  return NextResponse.json({ error: "请求不正确" }, { status: 400 });
}
