import { NextResponse } from "next/server";
import { adminUsername, getCurrentUser } from "@/lib/current-user";
import { claimGuestWorks, findUserByUsername, markAdmin } from "@/lib/db";
import { getLlmStatus } from "@/lib/llm";
import { dummyPasswordHash, verifyPassword } from "@/lib/password";
import { withSession } from "@/lib/session-token";
import { validateCredentials } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写用户名和密码" }, { status: 400 });
  }
  const parsed = validateCredentials(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const user = findUserByUsername(parsed.username);
  const ok = verifyPassword(parsed.password, user?.password_hash ?? dummyPasswordHash);
  if (!user || user.is_guest === 1 || !ok) return NextResponse.json({ error: "用户名或密码不对" }, { status: 401 });
  if (adminUsername() && user.username === adminUsername()) markAdmin(user.id);
  const current = await getCurrentUser();
  if (current?.guest) claimGuestWorks(current.id, user.id);
  return withSession({ user: { id: user.id, username: user.username }, llm: getLlmStatus() }, user);
}
