import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { listVoiceSamples } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ samples: [] });
  return NextResponse.json({ samples: listVoiceSamples(user.id) });
}
