import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { parseId } from "@/lib/validators";
import { refreshDirections } from "@/lib/works";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const work = await refreshDirections(user.id, id);
  if (!work) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  return NextResponse.json({ work });
}
