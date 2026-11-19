import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { deleteWork, getWork } from "@/lib/db";
import { parseId } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const work = getWork(user.id, id);
  if (!work) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  return NextResponse.json({ work });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const id = parseId((await context.params).id);
  if (!id || !deleteWork(user.id, id)) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
