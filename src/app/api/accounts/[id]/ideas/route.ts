import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getMediaAccount, getPersonalProfile, listIdeas, listWrittenThemes, saveIdeas } from "@/lib/db";
import { generateRegularIdeas } from "@/lib/llm";
import { runWithUser } from "@/lib/usage-context";
import { isMediaReady, isPersonalReady } from "@/lib/types";
import { parseId } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

async function readyAccount(userId: number, accountId: number) {
  const personal = getPersonalProfile(userId);
  const account = getMediaAccount(userId, accountId);
  if (!isPersonalReady(personal) || !account || !isMediaReady(account)) return null;
  return { personal, account };
}

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id || !getMediaAccount(user.id, id)) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  return NextResponse.json({ ideas: listIdeas(user.id, id) });
}

export async function POST(_request: Request, context: Context) {
  const user = await getCurrentUser();
  const id = parseId((await context.params).id);
  if (!user || !id) return NextResponse.json({ error: "找不到这个账号设定" }, { status: 404 });
  const ready = await readyAccount(user.id, id);
  if (!ready) return NextResponse.json({ error: "请先完成个人人设和账号设定" }, { status: 400 });
  const avoid = [...listWrittenThemes(user.id), ...listIdeas(user.id, id).map((idea) => idea.title)];
  try {
    const ideas = await runWithUser(user.id, () =>
      generateRegularIdeas({
        persona: ready.account.persona,
        problem: ready.account.problem,
        audience: ready.account.audience,
        occupation: ready.personal.occupation,
        industry: ready.personal.industry,
        avoid,
      }),
    );
    saveIdeas(user.id, id, ideas);
    return NextResponse.json({ ideas });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error && error.message ? error.message : "没有想出新的常规题";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
