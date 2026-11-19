import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getMediaAccount, insertTopicPool, listTopicPool } from "@/lib/db";
import { parseId, validatePoolCreate } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id || !getMediaAccount(user.id, id)) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  return NextResponse.json({ pool: listTopicPool(user.id, id) });
}

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id || !getMediaAccount(user.id, id)) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请写一条题材" }, { status: 400 });
  }
  const parsed = validatePoolCreate(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const item = insertTopicPool(user.id, id, parsed.value);
  if (!item) return NextResponse.json({ error: "没有存进选题池" }, { status: 400 });
  return NextResponse.json({ item });
}
