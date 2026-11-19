import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createUser, isUniqueError, promoteGuest } from "@/lib/db";
import { getLlmStatus } from "@/lib/llm";
import { hashPassword } from "@/lib/password";
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
  const passwordHash = hashPassword(parsed.password);
  const current = await getCurrentUser();
  try {
    if (current?.guest && promoteGuest(current.id, parsed.username, passwordHash)) {
      return withSession({ user: { id: current.id, username: parsed.username }, llm: getLlmStatus() }, {
        id: current.id,
        username: parsed.username,
      }, 201);
    }
    const user = createUser(parsed.username, passwordHash);
    return withSession({ user: { id: user.id, username: user.username }, llm: getLlmStatus() }, user, 201);
  } catch (error) {
    if (isUniqueError(error)) return NextResponse.json({ error: "这个用户名已经有人用了" }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "注册失败，请再试一次" }, { status: 500 });
  }
}
