import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { createGuestUser, getPersonalProfile, savePersonalProfile } from "@/lib/db";
import { withSession } from "@/lib/session-token";
import { EMPTY_PERSONAL } from "@/lib/types";
import { validatePersonal } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ profile: EMPTY_PERSONAL });
  return NextResponse.json({ profile: getPersonalProfile(user.id) });
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请填写个人人设" }, { status: 400 });
  }
  const parsed = validatePersonal(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const existing = await getCurrentUser();
  const user = existing ?? createGuestUser();
  const profile = savePersonalProfile(user.id, parsed.value);
  if (existing) return NextResponse.json({ profile });
  return withSession({ profile }, user);
}
