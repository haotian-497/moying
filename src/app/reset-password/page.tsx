import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { passwordResetEnabled } from "@/lib/password-reset";

export const metadata: Metadata = { title: "重置密码" };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <ResetPasswordForm resetEnabled={passwordResetEnabled()} />;
}
