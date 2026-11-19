import Link from "next/link";
import { PenTool } from "lucide-react";

export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white" aria-hidden>
        <PenTool className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold leading-none tracking-tight">墨引 · AI自媒体工作台</span>
      </span>
    </Link>
  );
}
