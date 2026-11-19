import type { Metadata } from "next";
import { AdminUsersBoard } from "@/components/admin-users-board";
import { listAdminUsers } from "@/lib/db";

export const metadata: Metadata = { title: "用户" };

export default function AdminUsersPage() {
  return <AdminUsersBoard users={listAdminUsers()} />;
}
