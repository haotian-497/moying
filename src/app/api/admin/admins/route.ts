import { NextResponse } from "next/server";
import { adminUsername, getAdmin } from "@/lib/current-user";
import { setUserAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "没有权限" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求不正确" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "请求不正确" }, { status: 400 });
  const source = body as { userId?: unknown; admin?: unknown };
  const userId = Number(source.userId);
  if (!Number.isSafeInteger(userId)) return NextResponse.json({ error: "请选择用户" }, { status: 400 });
  const result = setUserAdmin(userId, source.admin === true, adminUsername());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
