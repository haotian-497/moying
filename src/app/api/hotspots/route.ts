import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getMediaAccount, getPersonalProfile, listWrittenThemes } from "@/lib/db";
import { hotRefreshStatus, startHotRefresh } from "@/lib/hot-refresh";
import { takeForAccount } from "@/lib/hotspots";
import { runWithUser } from "@/lib/usage-context";
import { isMediaReady, isPersonalReady, isPlatform, type MediaAccount, type PersonalProfile, type Platform } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Resolved = {
  accountId: number;
  platform: Platform;
  personal: PersonalProfile;
  account: MediaAccount;
};

function resolveAccount(userId: number, request: Request): Resolved | { response: Response } {
  const url = new URL(request.url);
  const accountId = Number(url.searchParams.get("accountId"));
  const platform = url.searchParams.get("platform") || "";
  if (!Number.isSafeInteger(accountId) || accountId <= 0 || !isPlatform(platform)) {
    return { response: NextResponse.json({ error: "请选择账号和发布平台" }, { status: 400 }) };
  }
  const personal = getPersonalProfile(userId);
  const account = getMediaAccount(userId, accountId);
  if (!isPersonalReady(personal)) return { response: NextResponse.json({ error: "请先完成个人人设" }, { status: 400 }) };
  if (!account || !isMediaReady(account)) return { response: NextResponse.json({ error: "请选择一个账号设定" }, { status: 400 }) };
  if (!account.platforms.includes(platform)) {
    return { response: NextResponse.json({ error: "请选择这个账号设定里的发布平台" }, { status: 400 }) };
  }
  return { accountId, platform, personal, account };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先完成个人人设，并添加账号设定" }, { status: 400 });
  const resolved = resolveAccount(user.id, request);
  if ("response" in resolved) return resolved.response;
  const { accountId, platform, personal, account } = resolved;
  try {
    const status = hotRefreshStatus(user.id, accountId, platform);
    const take = await runWithUser(user.id, () => takeForAccount(personal, account, platform, listWrittenThemes(user.id), false));
    return NextResponse.json({ take, refreshing: status.refreshing, error: status.error || undefined });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error && error.message ? error.message : "热点整理失败，请稍后再试";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先完成个人人设，并添加账号设定" }, { status: 400 });
  const resolved = resolveAccount(user.id, request);
  if ("response" in resolved) return resolved.response;
  const { accountId, platform, personal, account } = resolved;
  try {
    startHotRefresh(user.id, accountId, platform);
    const take = await runWithUser(user.id, () => takeForAccount(personal, account, platform, listWrittenThemes(user.id), false));
    return NextResponse.json({ take, refreshing: true });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error && error.message ? error.message : "热点抓取失败，请稍后再试";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
