import type { Metadata } from "next";
import { AdminDays } from "@/components/admin-days";
import { pageDescClass, pageTitleClass, panelClass, panelPadClass, sectionTitleClass } from "@/components/ui";
import { sinceFromDays } from "@/lib/admin-stats";
import { listRecentUsage, listUsageByFeature, listUsageByUser } from "@/lib/db";
import { FEATURES, featureLabel } from "@/lib/features";
import { formatTime, formatTokens } from "@/lib/format";

export const metadata: Metadata = { title: "功能用量" };

function tokens(value: number | null) {
  return value == null ? "未返回" : formatTokens(value);
}

export default async function AdminUsagePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const { days, since } = sinceFromDays(raw);
  const byFeature = listUsageByFeature(since);
  const byUser = listUsageByUser(since);
  const recent = listRecentUsage(40, since);
  const failures = recent.filter((item) => !item.ok).slice(0, 12);
  const rows = FEATURES.map(
    (item) =>
      byFeature.find((row) => row.feature === item.id) ?? {
        feature: item.id,
        calls: 0,
        okCount: 0,
        failCount: 0,
        inputTokens: null,
        outputTokens: null,
        avgLatencyMs: null,
      },
  );
  const extra = byFeature.filter((row) => !FEATURES.some((item) => item.id === row.feature));
  const calls = [...rows, ...extra].reduce((sum, row) => sum + row.calls, 0);
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitleClass}>功能用量</h1>
          <p className={pageDescClass}>共 {calls} 次模型调用。演示模式不记在这里。Eval 对比单独记成「Eval 对比」。</p>
        </div>
        <AdminDays path="/admin/usage" days={days} className="shrink-0" />
      </div>
      <div className={`mt-6 overflow-x-auto ${panelClass}`}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-paper-deep/60 text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">功能</th>
              <th className="px-4 py-3 font-medium">调用</th>
              <th className="px-4 py-3 font-medium">成功率</th>
              <th className="px-4 py-3 font-medium">失败</th>
              <th className="px-4 py-3 font-medium">平均耗时</th>
              <th className="px-4 py-3 font-medium">输入 token</th>
              <th className="px-4 py-3 font-medium">输出 token</th>
            </tr>
          </thead>
          <tbody>
            {[...rows, ...extra].map((row) => (
              <tr key={row.feature} className="border-t border-line">
                <td className="px-4 py-3 font-medium">{featureLabel(row.feature)}</td>
                <td className="px-4 py-3">{row.calls}</td>
                <td className="px-4 py-3">{row.calls === 0 ? "—" : `${Math.round((row.okCount / row.calls) * 100)}%`}</td>
                <td className="px-4 py-3">{row.failCount}</td>
                <td className="px-4 py-3 text-muted">{row.avgLatencyMs == null ? "—" : `${row.avgLatencyMs} ms`}</td>
                <td className="px-4 py-3 text-muted">{row.calls === 0 ? "—" : tokens(row.inputTokens)}</td>
                <td className="px-4 py-3 text-muted">{row.calls === 0 ? "—" : tokens(row.outputTokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {byUser.length > 0 ? (
        <div className={`mt-8 overflow-x-auto ${panelClass}`}>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-line bg-paper-deep/60 text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">用户</th>
                <th className="px-4 py-3 font-medium">调用</th>
                <th className="px-4 py-3 font-medium">失败</th>
              </tr>
            </thead>
            <tbody>
              {byUser.map((row) => (
                <tr key={row.username} className="border-t border-line">
                  <td className="px-4 py-3">
                    <span className="font-medium">{row.username}</span>
                    {row.guest ? (
                      <span className="ml-2 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        游客
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.calls}</td>
                  <td className="px-4 py-3">{row.failCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <h2 className={`mt-8 ${sectionTitleClass}`}>最近失败</h2>
      {failures.length === 0 ? <p className="mt-3 text-sm text-muted">这段时间没有失败。</p> : null}
      <ul className="mt-3 space-y-2">
        {failures.map((item, index) => (
          <li key={`${item.createdAt}-${index}`} className={`${panelPadClass} text-sm`}>
            <span className="font-medium">{featureLabel(item.feature)}</span>
            <span className="mx-2 text-muted">·</span>
            <span>{item.username}</span>
            <span className="ml-2 text-muted">{formatTime(item.createdAt)}</span>
            {item.error ? <p className="mt-1 text-cinnabar-deep">{item.error}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
