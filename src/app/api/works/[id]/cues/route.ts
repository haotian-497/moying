import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { parseId } from "@/lib/validators";
import { writeSpokenCues } from "@/lib/works";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const result = await writeSpokenCues(user.id, id);
  if (!result) return NextResponse.json({ error: "还没有成稿" }, { status: 404 });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ work: result.work, cues: result.cues });
}
