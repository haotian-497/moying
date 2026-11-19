import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { getCurrentUser } from "@/lib/current-user";
import { getPersonalProfile, listMediaAccounts } from "@/lib/db";
import { getLlmStatus } from "@/lib/llm";
import { EMPTY_PERSONAL } from "@/lib/types";

export const metadata: Metadata = { title: "工作台" };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ work?: string; step?: string; mode?: string }> }) {
  const user = await getCurrentUser();
  const personal = user ? getPersonalProfile(user.id) : EMPTY_PERSONAL;
  const accounts = user ? listMediaAccounts(user.id) : [];
  const query = await searchParams;
  const step = query.step === "direction" || query.step === "draft" || query.step === "topic" ? query.step : "topic";
  const workId = query.work && /^\d+$/.test(query.work) ? query.work : null;
  return (
    <Workspace
      username={user?.username ?? ""}
      guest={!user || user.guest}
      llm={getLlmStatus()}
      personal={personal}
      accounts={accounts}
      initialWorkId={workId}
      initialStep={workId ? step : step === "topic" ? "topic" : step}
      initialMode={query.mode === "hot" ? "hot" : "create"}
    />
  );
}
