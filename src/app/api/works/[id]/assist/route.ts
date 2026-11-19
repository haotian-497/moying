import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { parseId, validateAssist } from "@/lib/validators";
import { assistWork } from "@/lib/works";

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
    return NextResponse.json({ error: "请选择怎么改" }, { status: 400 });
  }
  const parsed = validateAssist(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = await assistWork(user.id, id, parsed.value);
  if (!result) return NextResponse.json({ error: "还没有成稿" }, { status: 404 });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ text: result.text });
}
