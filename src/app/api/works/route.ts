import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { listWorks } from "@/lib/db";
import { validateDraft } from "@/lib/validators";
import { WorkInputError, createWork } from "@/lib/works";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ works: [] });
  return NextResponse.json({ works: listWorks(user.id) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请先写一个题材" }, { status: 400 });
  }
  const parsed = validateDraft(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const existing = await getCurrentUser();
  if (!existing) return NextResponse.json({ error: "请先完成个人人设，并添加账号设定" }, { status: 400 });
  try {
    const work = await createWork(existing.id, parsed.value);
    return NextResponse.json({ work }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "生成失败，请再试一次" }, { status: 500 });
  }
}
