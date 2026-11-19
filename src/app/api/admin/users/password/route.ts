import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/current-user";
import { findUserById, updateUserPassword } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { validateAdminResetPassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "没有权限" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写新密码" }, { status: 400 });
  }
  const parsed = validateAdminResetPassword(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const user = findUserById(parsed.userId);
  if (!user || user.is_guest === 1) return NextResponse.json({ error: "只能重置注册用户的密码" }, { status: 400 });
  if (!updateUserPassword(user.id, hashPassword(parsed.password))) {
    return NextResponse.json({ error: "重置失败，请再试一次" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, username: user.username });
}
