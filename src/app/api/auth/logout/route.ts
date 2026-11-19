import { clearSession } from "@/lib/session-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  return clearSession();
}
