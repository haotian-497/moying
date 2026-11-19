import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { deleteVoiceSample } from "@/lib/db";
import { rebuildVoice } from "@/lib/voice";
import { parseId } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  const accountId = user && id ? deleteVoiceSample(user.id, id) : null;
  if (!user || !id || !accountId) {
    return NextResponse.json({ error: "找不到这段语气样本" }, { status: 404 });
  }
  let digest = "";
  try {
    digest = await rebuildVoice(user.id, accountId);
  } catch (error) {
    console.error(error);
  }
  return NextResponse.json({ ok: true, digest });
}
