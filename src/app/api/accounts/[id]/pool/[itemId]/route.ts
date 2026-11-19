import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { deleteTopicPool, updateTopicPool } from "@/lib/db";
import { parseId, validatePoolPatch } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(request: Request, context: Context) {
  const user = await getCurrentUser();
  const params = await context.params;
  const id = parseId(params.id);
  const itemId = parseId(params.itemId);
  if (!user || !id || !itemId) return NextResponse.json({ error: "找不到这条选题" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "没有要改的内容" }, { status: 400 });
  }
  const parsed = validatePoolPatch(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const item = updateTopicPool(user.id, id, itemId, parsed.value);
  if (!item) return NextResponse.json({ error: "找不到这条选题" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const params = await context.params;
  const id = parseId(params.id);
  const itemId = parseId(params.itemId);
  if (!user || !id || !itemId || !deleteTopicPool(user.id, id, itemId)) {
    return NextResponse.json({ error: "找不到这条选题" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
