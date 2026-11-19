import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ChangePasswordForm } from "@/components/change-password-form";
import { pageDescClass, pageTitleClass, panelPadClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/current-user";

export const metadata: Metadata = { title: "修改密码" };
export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  const user = await getCurrentUser();
  if (!user || user.guest) redirect("/reset-password");
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <AppHeader username={user.username} guest={false} />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:px-6">
        <h1 className={pageTitleClass}>修改密码</h1>
        <p className={pageDescClass}>登录状态下可改自己的密码。若已退出且忘记密码，请走登录页的「忘记密码」。</p>
        <div className={`mt-6 ${panelPadClass}`}>
          <ChangePasswordForm />
        </div>
        <p className="mt-4 text-sm text-muted">
          <Link href="/" className="text-ink underline">
            返回工作台
          </Link>
        </p>
      </main>
    </div>
  );
}