import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { findUserById, updateUserPassword } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { validateChangePassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current || current.guest) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写密码" }, { status: 400 });
  }
  const parsed = validateChangePassword(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const user = findUserById(current.id);
  if (!user || user.is_guest === 1) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!verifyPassword(parsed.currentPassword, user.password_hash)) {
    return NextResponse.json({ error: "当前密码不对" }, { status: 401 });
  }
  if (!updateUserPassword(user.id, hashPassword(parsed.password))) {
    return NextResponse.json({ error: "改密失败，请再试一次" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
