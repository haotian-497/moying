import { cookies } from "next/headers";
import { findUserById, markAdmin } from "@/lib/db";
import { COOKIE_NAME, readSessionToken } from "@/lib/session-token";

export function adminUsername() {
  return (process.env.ADMIN_USERNAME || "").trim();
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = readSessionToken(token);
  if (!session) return null;
  const user = findUserById(session.uid);
  if (!user) return null;
  return { id: user.id, username: user.username, guest: user.is_guest === 1 };
}

export async function getAdmin() {
  const current = await getCurrentUser();
  if (!current || current.guest) return null;
  const user = findUserById(current.id);
  if (!user || user.is_guest === 1) return null;
  const named = adminUsername();
  if (named && user.username === named) {
    if (user.is_admin !== 1) markAdmin(user.id);
    return { id: user.id, username: user.username };
  }
  if (user.is_admin === 1) return { id: user.id, username: user.username };
  return null;
}
