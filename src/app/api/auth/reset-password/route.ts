import { NextResponse } from "next/server";
import { findUserByUsername, updateUserPassword } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { passwordResetEnabled, verifyPasswordResetKey } from "@/lib/password-reset";
import { validateResetPassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!passwordResetEnabled()) {
    return NextResponse.json(
      { error: "还没开启重置。请在 .env.local 配置 PASSWORD_RESET_KEY（或至少 8 位的 SESSION_SECRET）后重启服务。" },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写重置信息" }, { status: 400 });
  }
  const parsed = validateResetPassword(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!verifyPasswordResetKey(parsed.resetKey)) {
    return NextResponse.json({ error: "本机重置口令不对" }, { status: 401 });
  }
  const user = findUserByUsername(parsed.username);
  if (!user || user.is_guest === 1) return NextResponse.json({ error: "找不到这个注册账号" }, { status: 404 });
  if (!updateUserPassword(user.id, hashPassword(parsed.password))) {
    return NextResponse.json({ error: "重置失败，请再试一次" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, username: user.username });
}
