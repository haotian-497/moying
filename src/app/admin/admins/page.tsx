import type { Metadata } from "next";
import { AdminRoles } from "@/components/admin-roles";
import { pageDescClass, pageTitleClass } from "@/components/ui";
import { adminUsername } from "@/lib/current-user";
import { listAdminUsers } from "@/lib/db";

export const metadata: Metadata = { title: "管理员" };

export default function AdminAccountsPage() {
  const users = listAdminUsers().filter((user) => !user.guest);
  return (
    <section>
      <h1 className={pageTitleClass}>管理员</h1>
      <p className={pageDescClass}>
        用现在的登录账号进入后台。游客不能成为管理员。取消后至少还要留下一个。配置指定的用户名不能在这里取消。
      </p>
      <div className="mt-6">
        <AdminRoles
          users={users.map((user) => ({ id: user.id, username: user.username, admin: user.admin }))}
          protectedUsername={adminUsername()}
        />
      </div>
    </section>
  );
}
