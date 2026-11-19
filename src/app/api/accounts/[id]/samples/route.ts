import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { insertVoiceSample } from "@/lib/db";
import { rebuildVoice } from "@/lib/voice";
import { parseId, validateVoiceSample } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请贴一段用来学语气的文字" }, { status: 400 });
  }
  const parsed = validateVoiceSample(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = insertVoiceSample(user.id, id, parsed.text, parsed.source);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  let digest = "";
  try {
    digest = await rebuildVoice(user.id, id);
  } catch (error) {
    console.error(error);
  }
  return NextResponse.json({ sample: result.sample, digest });
}
