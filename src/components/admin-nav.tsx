"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

const GROUPS: { title: string; links: { href: string; label: string; Icon: LucideIcon }[] }[] = [
  {
    title: "运营",
    links: [
      { href: "/admin", label: "运行概览", Icon: Activity },
      { href: "/admin/cost", label: "成本", Icon: CircleDollarSign },
      { href: "/admin/usage", label: "功能用量", Icon: BarChart3 },
    ],
  },
  {
    title: "提示词",
    links: [
      { href: "/admin/ab", label: "提示词 A/B", Icon: GitCompareArrows },
      { href: "/admin/eval", label: "Eval", Icon: FlaskConical },
      { href: "/admin/prompts", label: "提示词", Icon: FileText },
    ],
  },
  {
    title: "账号",
    links: [
      { href: "/admin/users", label: "用户", Icon: Users },
      { href: "/admin/admins", label: "管理员", Icon: Shield },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5 p-3">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <h4 className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted">{group.title}</h4>
          <div className="flex flex-col gap-0.5">
            {group.links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-paper-deep text-ink" : "text-muted hover:bg-paper hover:text-ink"
                  }`}
                >
                  <link.Icon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
