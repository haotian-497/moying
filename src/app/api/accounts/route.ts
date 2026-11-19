import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { countMediaAccounts, createGuestUser, insertMediaAccount, listMediaAccounts } from "@/lib/db";
import { withSession } from "@/lib/session-token";
import { validateMediaAccount } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACCOUNT_LIMIT = 20;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ accounts: [] });
  return NextResponse.json({ accounts: listMediaAccounts(user.id) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写账号设定" }, { status: 400 });
  }
  const parsed = validateMediaAccount(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const existing = await getCurrentUser();
  const user = existing ?? createGuestUser();
  if (countMediaAccounts(user.id) >= ACCOUNT_LIMIT) {
    const error = { error: "最多添加 20 个账号设定" };
    if (existing) return NextResponse.json(error, { status: 400 });
    return withSession(error, user, 400);
  }
  const account = insertMediaAccount(user.id, parsed.value);
  if (!account) {
    if (existing) return NextResponse.json({ error: "保存失败，请再试一次" }, { status: 500 });
    return withSession({ error: "保存失败，请再试一次" }, user, 500);
  }
  if (existing) return NextResponse.json({ account }, { status: 201 });
  return withSession({ account }, user, 201);
}
