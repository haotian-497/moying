import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/current-user";
import { safeNext } from "@/lib/validators";

export const metadata: Metadata = { title: "登录" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const user = await getCurrentUser();
  if (user && !user.guest) redirect("/");
  const { from } = await searchParams;
  return <AuthForm mode="login" nextPath={safeNext(from)} />;
}
