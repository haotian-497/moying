import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { parseId } from "@/lib/validators";
import { applyAllReviewIssues, reviewWork, settleReviewIssue } from "@/lib/works";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "请再试一次" }, { status: 400 });
    }
  }
  const action = body && typeof body === "object" && "action" in body ? (body as { action?: unknown }).action : "";
  if (action === "apply-all") {
    const result = applyAllReviewIssues(user.id, id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ work: result.work });
  }
  if (action === "apply" || action === "dismiss") {
    const index = body && typeof body === "object" && "index" in body ? (body as { index?: unknown }).index : null;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: "这条检查已经不在了" }, { status: 400 });
    }
    const result = settleReviewIssue(user.id, id, index, action);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ work: result.work });
  }
  const work = await reviewWork(user.id, id);
  if (!work) return NextResponse.json({ error: "还没有成稿" }, { status: 404 });
  return NextResponse.json({ work });
}
