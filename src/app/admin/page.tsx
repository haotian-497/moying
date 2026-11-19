import type { Metadata } from "next";
import { AdminDays } from "@/components/admin-days";
import { metaBadgeClass, pageDescClass, pageTitleClass, panelPadClass, sectionTitleClass } from "@/components/ui";
import { overviewStats, sinceFromDays } from "@/lib/admin-stats";
import { featureLabel } from "@/lib/features";
import { formatTime, formatTokens } from "@/lib/format";
import { getLlmStatus } from "@/lib/llm";

export const metadata: Metadata = { title: "运行概览" };

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: raw } = await searchParams;
  const { days, since } = sinceFromDays(raw);
  const stats = overviewStats(since);
  const llm = getLlmStatus();
  const peak = Math.max(1, ...stats.days.map((item) => item.calls));
  const channel = llm.mode === "live" ? `正在使用 ${llm.model}` : llm.mode === "mock" ? "演示模式" : "还没配密钥";
  const channelTone =
    llm.mode === "live"
      ? "border-moss/30 bg-moss-soft text-moss"
      : llm.mode === "mock"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";
  const period = `近 ${days} 天`;
  const readyRate = stats.works === 0 ? null : Math.round((stats.readyWorks / stats.works) * 100);
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={pageTitleClass}>运行概览</h1>
          <p className={pageDescClass}>看的是产品和模型调用，不是这台电脑的 CPU。</p>
        </div>
        <AdminDays path="/admin" days={days} className="shrink-0" />
      </div>
      <p className="mt-4">
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${channelTone}`}>{channel}</span>
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { title: "用户数", hint: "累计", value: String(stats.members), note: null as string | null },
          { title: "创作总数", hint: "累计", value: String(stats.works), note: `已完成 ${readyRate == null ? "—" : `${readyRate}%`}` },
          { title: "模型调用", hint: period, value: String(stats.calls), note: `成功率 ${stats.successRate == null ? "—" : `${stats.successRate}%`}` },
          {
            title: "平均耗时",
            hint: period,
            value: stats.avgLatencyMs == null ? "—" : `${stats.avgLatencyMs} ms`,
            note: "全部调用的平均值",
          },
          {
            title: "Token",
            hint: period,
            value: formatTokens(stats.inputTokens + stats.outputTokens),
            note: `输入 ${formatTokens(stats.inputTokens)}、输出 ${formatTokens(stats.outputTokens)}`,
            wide: true,
          },
        ].map((card) => (
          <article key={card.title} className={`min-w-0 ${panelPadClass} ${card.wide ? "col-span-2 lg:col-span-1" : ""}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">{card.title}</h2>
              <span className="shrink-0 text-[10px] text-muted">{card.hint}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{card.value}</p>
            {card.note ? <p className="mt-2 text-xs text-muted">{card.note}</p> : null}
          </article>
        ))}
      </div>
      <div className="mt-10 flex items-baseline justify-between gap-3">
        <h2 className={sectionTitleClass}>按天调用</h2>
        <span className={metaBadgeClass}>{period}</span>
      </div>
      {stats.days.length === 0 ? <p className="mt-3 text-sm text-muted">这段时间还没有调用。</p> : null}
      <ul className="mt-3 space-y-2">
        {stats.days.map((item) => (
          <li key={item.day} className="flex items-center gap-3 text-sm">
            <span className="w-12 text-muted">{item.day}</span>
            <span className="h-2 rounded-md bg-ink" style={{ width: `${Math.max(8, (item.calls / peak) * 180)}px` }} />
            <span className="font-medium">{item.calls}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className={sectionTitleClass}>最近失败</h2>
        <span className={metaBadgeClass}>{period}</span>
      </div>
      {stats.failures.length === 0 ? <p className="mt-3 text-sm text-muted">这段时间没有失败记录。</p> : null}
      <ul className="mt-3 space-y-2">
        {stats.failures.map((item, index) => (
          <li key={`${item.createdAt}-${index}`} className={`${panelPadClass} text-sm`}>
            <span className="font-medium">{featureLabel(item.feature)}</span>
            <span className="mx-2 text-muted">·</span>
            <span>{item.model || "未知模型"}</span>
            <span className="mx-2 text-muted">·</span>
            <span className="text-muted">{formatTime(item.createdAt)}</span>
            {item.error ? <p className="mt-1 text-cinnabar-deep">{item.error}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
