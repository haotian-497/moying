import { getMediaAccount, getPersonalProfile, listWrittenThemes } from "@/lib/db";
import { takeForAccount } from "@/lib/hotspots";
import { runWithUser } from "@/lib/usage-context";
import { isMediaReady, isPersonalReady, type Platform } from "@/lib/types";

type Job = {
  status: "running" | "done" | "error";
  error: string;
  startedAt: number;
};

const globalForJobs = globalThis as unknown as { moyinHotJobs?: Map<string, Job> };

function jobs() {
  if (!globalForJobs.moyinHotJobs) globalForJobs.moyinHotJobs = new Map();
  return globalForJobs.moyinHotJobs;
}

function jobKey(userId: number, accountId: number, platform: string) {
  return `${userId}:${accountId}:${platform}`;
}

export function hotRefreshStatus(userId: number, accountId: number, platform: string) {
  const job = jobs().get(jobKey(userId, accountId, platform));
  if (!job) return { refreshing: false, error: "" };
  if (job.status === "running") return { refreshing: true, error: "" };
  if (job.status === "error") return { refreshing: false, error: job.error };
  return { refreshing: false, error: "" };
}

export function startHotRefresh(userId: number, accountId: number, platform: Platform) {
  const id = jobKey(userId, accountId, platform);
  const current = jobs().get(id);
  if (current?.status === "running") return { started: false, refreshing: true as const };

  jobs().set(id, { status: "running", error: "", startedAt: Date.now() });

  void (async () => {
    try {
      const personal = getPersonalProfile(userId);
      const account = getMediaAccount(userId, accountId);
      if (!isPersonalReady(personal) || !account || !isMediaReady(account)) {
        throw new Error("请先完成个人人设，并选择账号设定");
      }
      if (!account.platforms.includes(platform)) {
        throw new Error("请选择这个账号设定里的发布平台");
      }
      await runWithUser(userId, () => takeForAccount(personal, account, platform, listWrittenThemes(userId), true));
      jobs().set(id, { status: "done", error: "", startedAt: jobs().get(id)?.startedAt ?? Date.now() });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error && error.message ? error.message : "热点抓取失败，请稍后再试";
      jobs().set(id, { status: "error", error: message, startedAt: jobs().get(id)?.startedAt ?? Date.now() });
    }
  })();

  return { started: true, refreshing: true as const };
}
