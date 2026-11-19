import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/current-user";

export const metadata: Metadata = { title: "注册" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user && !user.guest) redirect("/");
  return <AuthForm mode="register" nextPath="/" />;
}
