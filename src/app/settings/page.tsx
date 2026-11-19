import type { Metadata } from "next";
import { MediaAccountManager } from "@/components/media-account-manager";
import { getCurrentUser } from "@/lib/current-user";
import { listMediaAccounts } from "@/lib/db";

export const metadata: Metadata = { title: "账号设定" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const accounts = user ? listMediaAccounts(user.id) : [];
  return <MediaAccountManager username={user?.username ?? ""} guest={!user || user.guest} accounts={accounts} />;
}
