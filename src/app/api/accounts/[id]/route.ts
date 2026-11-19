import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { deleteMediaAccount, updateMediaAccount } from "@/lib/db";
import { parseId, validateMediaAccount } from "@/lib/validators";

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
    return NextResponse.json({ error: "请填写账号设定" }, { status: 400 });
  }
  const parsed = validateMediaAccount(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const account = updateMediaAccount(user.id, id, parsed.value);
  if (!account) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  return NextResponse.json({ account });
}

export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id || !deleteMediaAccount(user.id, id)) {
    return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
