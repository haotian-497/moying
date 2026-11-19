import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { deleteSection, getMediaAccount, updateSection } from "@/lib/db";
import { parseId, validateSection } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; sectionId: string }> };

export async function PUT(request: Request, context: Context) {
  const user = await getCurrentUser();
  const params = await context.params;
  const id = parseId(params.id);
  const sectionId = parseId(params.sectionId);
  if (!user || !id || !sectionId || !getMediaAccount(user.id, id)) return NextResponse.json({ error: "找不到这个栏目" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写栏目" }, { status: 400 });
  }
  const parsed = validateSection(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const section = updateSection(user.id, id, sectionId, parsed.value);
  if (!section) return NextResponse.json({ error: "找不到这个栏目" }, { status: 404 });
  return NextResponse.json({ section });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const params = await context.params;
  const id = parseId(params.id);
  const sectionId = parseId(params.sectionId);
  if (!user || !id || !sectionId || !deleteSection(user.id, id, sectionId)) {
    return NextResponse.json({ error: "找不到这个栏目" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
