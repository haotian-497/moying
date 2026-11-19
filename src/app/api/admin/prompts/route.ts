import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/current-user";
import { markL1Needed } from "@/lib/eval-library";
import { isFeatureId } from "@/lib/features";
import { rollbackPrompt, savePromptVersion } from "@/lib/prompts";

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
  const source = body as { action?: unknown; feature?: unknown; body?: unknown; note?: unknown; versionId?: unknown };
  const feature = typeof source.feature === "string" ? source.feature : "";
  if (!isFeatureId(feature)) return NextResponse.json({ error: "请选择功能" }, { status: 400 });
  if (source.action === "rollback") {
    const versionId = Number(source.versionId);
    if (!Number.isSafeInteger(versionId)) return NextResponse.json({ error: "请选择版本" }, { status: 400 });
    const result = rollbackPrompt(feature, versionId, admin.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    markL1Needed(`已回滚正式提示词（${feature}），请跑一次产品回归`);
    return NextResponse.json({ ok: true, l1Needed: true });
  }
  const result = savePromptVersion(feature, typeof source.body === "string" ? source.body : "", typeof source.note === "string" ? source.note : "", admin.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  markL1Needed(`已更新正式提示词（${feature}），请跑一次产品回归`);
  return NextResponse.json({ ok: true, l1Needed: true });
}
