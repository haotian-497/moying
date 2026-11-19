import type { Metadata } from "next";
import { PersonalProfileForm } from "@/components/personal-profile-form";
import { getCurrentUser } from "@/lib/current-user";
import { getPersonalProfile } from "@/lib/db";
import { EMPTY_PERSONAL } from "@/lib/types";

export const metadata: Metadata = { title: "个人人设" };

export default async function PersonaPage() {
  const user = await getCurrentUser();
  const profile = user ? getPersonalProfile(user.id) : EMPTY_PERSONAL;
  return <PersonalProfileForm username={user?.username ?? ""} guest={!user || user.guest} profile={profile} />;
}
