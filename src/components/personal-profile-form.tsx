"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { fieldClass, primaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import type { PersonalProfile } from "@/lib/types";

export function PersonalProfileForm({
  username,
  guest,
  profile,
}: {
  username: string;
  guest: boolean;
  profile: PersonalProfile;
}) {
  const router = useRouter();
  const [age, setAge] = useState(profile.age);
  const [occupation, setOccupation] = useState(profile.occupation);
  const [industry, setIndustry] = useState(profile.industry);
  const [personality, setPersonality] = useState(profile.personality);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const ageText = age.trim();
  const ageReady = /^\d+$/.test(ageText) ? Number(ageText) >= 1 && Number(ageText) <= 120 : ageText.length >= 2;
  const ready = ageReady && occupation.trim().length >= 2 && industry.trim().length >= 2 && personality.trim().length >= 2;

  function touch(update: () => void) {
    update();
    setSaved(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    setPending(true);
    try {
      await api<{ profile: PersonalProfile }>("/api/persona", {
        method: "PUT",
        body: JSON.stringify({ age, occupation, industry, personality }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader username={username} guest={guest} />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← 返回工作台
        </Link>
        <h1 className="mt-5 text-3xl">个人人设</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          这是你本人的身份，只跟这个平台账号绑定，一份就够。下面的每个自媒体账号设定都会用到它。出文案时，语气和例子会按这个年龄、职业、行业和性格来写。
        </p>
        <form onSubmit={onSubmit} className="mt-6 rounded-3xl border border-line bg-card p-5 shadow-[0_16px_40px_rgba(28,24,20,0.04)]">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1.5 block">年龄</span>
              <input
                className={fieldClass}
                value={age}
                onChange={(event) => touch(() => setAge(event.target.value))}
                placeholder="例如：32"
                maxLength={20}
                required
                disabled={pending}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block">职业</span>
              <input
                className={fieldClass}
                value={occupation}
                onChange={(event) => touch(() => setOccupation(event.target.value))}
                placeholder="例如：产品经理"
                maxLength={40}
                required
                disabled={pending}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block">行业</span>
              <input
                className={fieldClass}
                value={industry}
                onChange={(event) => touch(() => setIndustry(event.target.value))}
                placeholder="例如：互联网"
                maxLength={40}
                required
                disabled={pending}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm">
            <span className="mb-1.5 flex items-center justify-between">
              <span>性格特征</span>
              <span className="text-xs text-muted">{personality.trim().length}/80</span>
            </span>
            <input
              className={fieldClass}
              value={personality}
              onChange={(event) => touch(() => setPersonality(event.target.value))}
              placeholder="例如：直接、较真、不爱客套"
              maxLength={80}
              required
              disabled={pending}
            />
          </label>
          {error ? <p className="mt-4 text-sm text-cinnabar-deep">{error}</p> : null}
          {saved ? <p className="mt-4 text-sm text-moss">已保存。之后每个自媒体账号出文案都会带上这份个人人设。</p> : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" className={primaryButton} disabled={pending || !ready}>
              {pending ? "正在保存…" : "保存个人人设"}
            </button>
            <Link href="/settings" className="text-sm text-ink underline">
              去管理账号设定
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
