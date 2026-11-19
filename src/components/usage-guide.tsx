"use client";

import { useEffect, useId, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { ghostButton, secondaryButton } from "@/components/ui";

const STEPS: { title: string; body: string }[] = [
  {
    title: "先填人设，再建账号",
    body: "左侧「个人人设」补齐年龄、职业、行业、性格；再在「账号设定」里写清这个号写什么、解决什么问题、写给谁。两边都齐了，才能开写——这是墨引「像你、落号」的前提。",
  },
  {
    title: "选题：手写题材，或借热点",
    body: "顶栏切到「创作」直接填题材、平台、风格；切到「热点」看六源热榜与可蹭点，选一条「开写」或先丢进选题池。热点事实只能按页面给的概要用，不要让模型编细节。",
  },
  {
    title: "三步成稿：方向 → 成稿 → 改",
    body: "提交后先出三个切入方向，选一个生成正文（可流式看着写出来）。成稿后可改字、划词局部改写/插入，也可把满意段落收成语气样本，下次更像你的口吻。",
  },
  {
    title: "校对与发布准备",
    body: "点终审：语言问题可一键采纳替换，调性/合规风险只提示不改稿。需要时再生成其他平台版本，或给口播稿生成按句提示。最后自行复制去发——产品不代发。",
  },
];

const EXTRAS: { title: string; body: string }[] = [
  { title: "内容栏目", body: "给账号建栏目并填素材，写稿时勾上，减少空泛编造。" },
  { title: "语气样本", body: "粘贴旧稿或从成稿收入，系统会蒸馏语气再注入新稿。" },
  { title: "选题池", body: "灵感先存着，定计划日期，空了再从池子开写。" },
  { title: "稿库", body: "左侧可按草稿 / 已成稿筛选，随时点开继续。" },
];

export function UsageGuideButton() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className={ghostButton} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <BookOpen className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">使用说明</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="关闭使用说明" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-line bg-card shadow-lg animate-fade-in">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold tracking-tight">
                  墨引 · 快速上手
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted">用人设 + 账号约束，把「选题 → 方向 → 成稿 → 校对 → 发布准备」走完一遍，就能体验全套能力。</p>
              </div>
              <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-paper-deep hover:text-ink" onClick={() => setOpen(false)} aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="scrollbar-thin overflow-y-auto px-5 py-4">
              <ol className="space-y-4">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink text-[11px] font-semibold text-white">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tracking-tight">{step.title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-6 border-t border-line pt-4">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">可选加分项</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {EXTRAS.map((item) => (
                    <li key={item.title} className="rounded-md border border-line bg-paper/60 px-3 py-2.5">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{item.body}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-5 rounded-md border border-line bg-paper-deep/80 px-3 py-2.5 text-xs leading-5 text-muted">
                游客可先试用；注册登录后可认领游客稿。生成需配置模型密钥。满意就复制去发，平台外发需你自己完成。
              </p>
            </div>

            <div className="flex justify-end border-t border-line px-5 py-3">
              <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>
                知道了，开始写
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
