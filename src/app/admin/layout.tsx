import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin-header";
import { AdminNav } from "@/components/admin-nav";
import { getAdmin } from "@/lib/current-user";
import { seedOfficialPrompts } from "@/lib/llm";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdmin();
  if (!admin) notFound();
  seedOfficialPrompts();
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <AdminHeader username={admin.username} />
      <div className="mx-auto flex w-full max-w-[100rem] flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-card sm:flex">
          <div className="scrollbar-thin flex-1 overflow-y-auto py-2">
            <AdminNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="animate-fade-in p-4 sm:p-6 lg:px-8">
            <div className="mb-4 sm:hidden">
              <AdminNav />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
