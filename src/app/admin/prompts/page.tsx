import type { Metadata } from "next";
import Link from "next/link";
import { metaBadgeClass, pageDescClass, pageTitleClass, panelPadClass } from "@/components/ui";
import { FEATURES } from "@/lib/features";
import { formatTime } from "@/lib/format";
import { listPromptVersions } from "@/lib/prompts";

export const metadata: Metadata = { title: "提示词" };

export default function AdminPromptsPage() {
  return (
    <section>
      <h1 className={pageTitleClass}>提示词</h1>
      <p className={pageDescClass}>
        这里只看当前正在生效的提示词。修改、回滚和测试在{" "}
        <Link href="/admin/ab" className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
          提示词 A/B
        </Link>
        。
      </p>
      <div className="mt-6 space-y-3">
        {FEATURES.map((item) => {
          const current = listPromptVersions(item.id).find((version) => version.active);
          return (
            <article key={item.id} className={panelPadClass}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">{item.label}</h2>
                {current ? (
                  <span className={metaBadgeClass}>生效中</span>
                ) : (
                  <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    未生效
                  </span>
                )}
              </div>
              {current ? (
                <p className="mt-1.5 text-xs text-muted">
                  {current.source} · {current.author} · {formatTime(current.createdAt)} · {current.note}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-muted">还没有生效版本</p>
              )}
              <pre className="scrollbar-thin mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-paper px-3 py-3 text-sm leading-6">
                {current?.body || "还没有提示词"}
              </pre>
            </article>
          );
        })}
      </div>
    </section>
  );
}
