import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { saveAccountWriting } from "@/lib/db";
import { parseId, validateAccountWriting } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写发布设定" }, { status: 400 });
  }
  const parsed = validateAccountWriting(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const account = saveAccountWriting(user.id, id, parsed.value);
  if (!account) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  return NextResponse.json({ account });
}
