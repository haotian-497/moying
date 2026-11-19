import type { Metadata } from "next";
import { AdminDays } from "@/components/admin-days";
import { pageDescClass, pageTitleClass, panelClass, panelPadClass, sectionTitleClass } from "@/components/ui";
import { costStats, sinceFromDays } from "@/lib/admin-stats";
import { featureLabel } from "@/lib/features";
import { formatTokens } from "@/lib/format";
import { formatYuan } from "@/lib/pricing";

export const metadata: Metadata = { title: "成本" };

export default async function AdminCostPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const { days, since } = sinceFromDays(raw);
  const stats = costStats(since);
  const rows = [...stats.rows].sort(
    (a, b) => featureLabel(a.feature).localeCompare(featureLabel(b.feature), "zh") || a.model.localeCompare(b.model, "zh"),
  );
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitleClass}>成本</h1>
          <p className={pageDescClass}>金额是估算。对不上单价的调用标成未计价。演示模式不进账单。真实花费以模型服务商后台为准。</p>
        </div>
        <AdminDays path="/admin/cost" days={days} className="shrink-0" />
      </div>
      <div className={`mt-6 overflow-x-auto ${panelClass}`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-paper-deep/60 text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">功能</th>
              <th className="px-4 py-3 font-medium">模型</th>
              <th className="px-4 py-3 font-medium">调用</th>
              <th className="px-4 py-3 font-medium">Token</th>
              <th className="px-4 py-3 text-right font-medium">成本</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-line">
                <td className="px-4 py-3 text-muted" colSpan={5}>
                  这段时间没有成功调用。
                </td>
              </tr>
            ) : null}
            {rows.map((row) => (
              <tr key={`${row.feature}-${row.model}`} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{featureLabel(row.feature)}</td>
                <td className="px-4 py-3">{row.model}</td>
                <td className="px-4 py-3">{row.calls}</td>
                <td className="px-4 py-3">
                  <span className="block">{formatTokens(row.inputTokens + row.outputTokens)}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    输入 {formatTokens(row.inputTokens)} · 输出 {formatTokens(row.outputTokens)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{row.yuan == null ? "未计价" : formatYuan(row.yuan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className={`mt-8 ${sectionTitleClass}`}>当前单价</h2>
      <p className="mt-1.5 text-sm text-muted">单位是每 100 万 token 多少元。可用环境变量 PRICING_JSON 覆盖。</p>
      <ul className="mt-3 space-y-2 text-sm">
        {stats.prices.map((price) => (
          <li key={price.model} className={panelPadClass}>
            <span className="font-medium">{price.model}</span>
            <span className="text-muted">：输入 {price.inputPerMillion} 元，输出 {price.outputPerMillion} 元</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
