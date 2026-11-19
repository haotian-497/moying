import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { saveWorkBody } from "@/lib/db";
import { parseId, validateWorkBody } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请先写正文" }, { status: 400 });
  }
  const parsed = validateWorkBody(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const work = saveWorkBody(user.id, id, parsed.body);
  if (!work) return NextResponse.json({ error: "还没有成稿" }, { status: 404 });
  return NextResponse.json({ work });
}
