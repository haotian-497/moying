import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getMediaAccount, insertSection, listSections } from "@/lib/db";
import { parseId, validateSection } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id || !getMediaAccount(user.id, id)) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  return NextResponse.json({ sections: listSections(user.id, id) });
}

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id || !getMediaAccount(user.id, id)) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写栏目" }, { status: 400 });
  }
  const parsed = validateSection(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const section = insertSection(user.id, id, parsed.value);
  if (!section) return NextResponse.json({ error: "一个账号最多 12 个栏目" }, { status: 400 });
  return NextResponse.json({ section });
}
