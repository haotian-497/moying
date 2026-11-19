"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-3xl">页面出错了</p>
      <p className="mt-3 text-sm leading-6 text-muted">可以重试。如果是生成过程中断，回到稿库再打开这篇即可。</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 w-fit rounded-full bg-ink px-5 py-2.5 text-sm text-white"
      >
        重试
      </button>
    </main>
  );
}
