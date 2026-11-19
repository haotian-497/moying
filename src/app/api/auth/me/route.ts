import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getLlmStatus } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json({ user, llm: getLlmStatus() });
}
