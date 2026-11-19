import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-3xl">没有这一页</p>
      <Link href="/" className="mt-6 text-sm text-ink underline">
        回首页
      </Link>
    </main>
  );
}
