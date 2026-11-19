import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getWork } from "@/lib/db";
import { parseId, validateVariantPlatforms } from "@/lib/validators";
import { writeVariants } from "@/lib/works";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  const work = getWork(user.id, id);
  if (!work) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请再选至少一个平台" }, { status: 400 });
  }
  const parsed = validateVariantPlatforms(body, work.platform);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const updated = await writeVariants(user.id, id, parsed.index, parsed.platforms);
  if (!updated) return NextResponse.json({ error: "找不到这篇稿" }, { status: 404 });
  return NextResponse.json({ work: updated });
}
