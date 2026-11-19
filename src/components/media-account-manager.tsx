"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { fieldClass, primaryButton, secondaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import { SectionBox } from "@/components/section-box";
import { PLATFORMS, PUBLISH_PLATFORMS, platformLabel, type MediaAccount, type MediaAccountInput, type Platform, type VoiceSample } from "@/lib/types";

const emptyForm: MediaAccountInput = {
  name: "",
  platforms: [],
  persona: "",
  problem: "",
  audience: "",
  notes: "",
};

export function MediaAccountManager({
  username,
  guest,
  accounts,
}: {
  username: string;
  guest: boolean;
  accounts: MediaAccount[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(accounts);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<MediaAccountInput>(emptyForm);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [samples, setSamples] = useState<VoiceSample[]>([]);

  useEffect(() => {
    api<{ samples: VoiceSample[] }>("/api/voice-samples")
      .then((data) => setSamples(data.samples))
      .catch(() => setSamples([]));
  }, []);

  const ready =
    form.name.trim().length >= 2 &&
    form.platforms.length > 0 &&
    form.persona.trim().length >= 2 &&
    form.problem.trim().length >= 2 &&
    form.audience.trim().length >= 2;

  function openNew() {
    setEditing("new");
    setForm(emptyForm);
    setError("");
  }

  function openEdit(account: MediaAccount) {
    setEditing(account.id);
    setForm({
      name: account.name,
      platforms: account.platforms,
      persona: account.persona,
      problem: account.problem,
      audience: account.audience,
      notes: account.notes,
    });
    setError("");
  }

  function togglePlatform(id: Platform) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(id) ? current.platforms.filter((item) => item !== id) : [...current.platforms, id],
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (editing === "new") {
        const data = await api<{ account: MediaAccount }>("/api/accounts", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setItems((current) => [data.account, ...current.filter((item) => item.id !== data.account.id)]);
      } else if (typeof editing === "number") {
        const data = await api<{ account: MediaAccount }>(`/api/accounts/${editing}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        setItems((current) => current.map((item) => (item.id === data.account.id ? data.account : item)));
      }
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setPending(false);
    }
  }

  async function onDelete(account: MediaAccount) {
    if (!window.confirm(`删除「${account.name}」？已经写过的稿还会留着。`)) return;
    setError("");
    try {
      await api(`/api/accounts/${account.id}`, { method: "DELETE" });
      setItems((current) => current.filter((item) => item.id !== account.id));
      if (editing === account.id) setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader username={username} guest={guest} />
      <main className="mx-auto max-w-2xl px-5 py-8">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← 返回工作台
        </Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl">账号设定</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              每个自媒体账号单独一份。写稿时先选账号，再按这个账号的主要内容、问题和目标用户来写。个人年龄、职业和性格在<Link href="/persona" className="text-ink">个人人设</Link>里，所有账号共用。
            </p>
          </div>
          <button type="button" className={secondaryButton} onClick={openNew} disabled={pending}>
            新建账号
          </button>
        </div>

        {error && editing === null ? <p className="mt-4 text-sm text-cinnabar-deep">{error}</p> : null}

        {items.length === 0 && editing === null ? (
          <div className="mt-6 rounded-3xl border border-dashed border-line bg-card px-5 py-8 text-sm leading-7 text-muted">
            还没有自媒体账号。先建一个，比如「小红书穿搭号」。
          </div>
        ) : null}

        <ul className="mt-6 space-y-3">
          {items.map((account) => (
            <li key={account.id} className="rounded-3xl border border-line bg-card px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl">{account.name}</h2>
                  <p className="mt-1 text-xs text-muted">{account.platforms.map((id) => platformLabel(id)).join("、")}</p>
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <button type="button" className="text-ink" onClick={() => openEdit(account)}>
                    编辑
                  </button>
                  <button type="button" className="text-muted hover:text-ink" onClick={() => onDelete(account)}>
                    删除
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6">主要内容：{account.persona}</p>
              <p className="mt-1 text-sm leading-6 text-muted">解决：{account.problem}</p>
              <p className="text-sm leading-6 text-muted">写给：{account.audience}</p>
              {account.notes ? <p className="text-sm leading-6 text-muted">备注：{account.notes}</p> : null}
              <SectionBox accountId={account.id} />
              <VoiceBox accountId={account.id} digest={account.styleDigest} samples={samples} onChange={setSamples} onDigest={(digest) => setItems((current) => current.map((item) => (item.id === account.id ? { ...item, styleDigest: digest } : item)))} />
            </li>
          ))}
        </ul>

        {editing !== null ? (
          <form onSubmit={onSubmit} className="mt-6 rounded-3xl border border-line bg-card p-5">
            <h2 className="text-2xl">{editing === "new" ? "新建账号设定" : "编辑账号设定"}</h2>
            <label className="mt-4 block text-sm">
              <span className="mb-1.5 flex items-center justify-between">
                <span>账号名称</span>
                <span className="text-xs text-muted">{form.name.trim().length}/20</span>
              </span>
              <input
                className={fieldClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="例如：小红书穿搭号"
                maxLength={20}
                required
                disabled={pending}
              />
            </label>
            <fieldset className="mt-5" disabled={pending}>
              <legend className="text-sm">发布平台</legend>
              <p className="mt-1 text-xs leading-5 text-muted">可以多选。写稿时的平台、风格、字数和读者，在选题材里保存后会记住。</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PUBLISH_PLATFORMS.map((id) => PLATFORMS.find((item) => item.id === id)).filter((item) => item != null).map((item) => {
                  const on = form.platforms.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => togglePlatform(item.id)}
                      className={`rounded-2xl border px-3 py-2 text-left ${on ? "border-ink bg-paper" : "border-line bg-paper"}`}
                    >
                      <span className="block text-sm">{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted">{item.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="mt-5 block text-sm">
              <span className="mb-1.5 flex items-center justify-between">
                <span>主要内容</span>
                <span className="text-xs text-muted">{form.persona.trim().length}/800</span>
              </span>
              <textarea
                className={`${fieldClass} min-h-28 resize-y`}
                value={form.persona}
                onChange={(event) => setForm({ ...form, persona: event.target.value })}
                placeholder="例如：通勤穿搭、平价搭配、一周衣橱"
                maxLength={800}
                required
                disabled={pending}
              />
            </label>
            <label className="mt-5 block text-sm">
              <span className="mb-1.5 flex items-center justify-between">
                <span>解决的问题</span>
                <span className="text-xs text-muted">{form.problem.trim().length}/800</span>
              </span>
              <textarea
                className={`${fieldClass} min-h-24 resize-y`}
                value={form.problem}
                onChange={(event) => setForm({ ...form, problem: event.target.value })}
                placeholder="例如：帮预算有限的人把日常衣服穿得整齐"
                maxLength={800}
                required
                disabled={pending}
              />
            </label>
            <label className="mt-5 block text-sm">
              <span className="mb-1.5 flex items-center justify-between">
                <span>目标用户</span>
                <span className="text-xs text-muted">{form.audience.trim().length}/200</span>
              </span>
              <textarea
                className={`${fieldClass} min-h-20 resize-y`}
                value={form.audience}
                onChange={(event) => setForm({ ...form, audience: event.target.value })}
                placeholder="例如：刚工作、在大城市租房的人"
                maxLength={200}
                required
                disabled={pending}
              />
            </label>
            <label className="mt-5 block text-sm">
              <span className="mb-1.5 flex items-center justify-between">
                <span>备注，可选</span>
                <span className="text-xs text-muted">{form.notes.trim().length}/400</span>
              </span>
              <textarea
                className={`${fieldClass} min-h-20 resize-y`}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="例如：不卖课，不说绝对化承诺"
                maxLength={400}
                disabled={pending}
              />
            </label>
            {error ? <p className="mt-4 text-sm text-cinnabar-deep">{error}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" className={primaryButton} disabled={pending || !ready}>
                {pending ? "正在保存…" : "保存账号设定"}
              </button>
              <button type="button" className={secondaryButton} onClick={() => setEditing(null)} disabled={pending}>
                取消
              </button>
            </div>
          </form>
        ) : null}
      </main>
    </div>
  );
}

function VoiceBox({
  accountId,
  digest,
  samples,
  onChange,
  onDigest,
}: {
  accountId: number;
  digest: string;
  samples: VoiceSample[];
  onChange: (next: VoiceSample[]) => void;
  onDigest: (digest: string) => void;
}) {
  const mine = samples.filter((item) => item.accountId === accountId);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setPending(true);
    setError("");
    try {
      const data = await api<{ sample: VoiceSample; digest: string }>(`/api/accounts/${accountId}/samples`, {
        method: "POST",
        body: JSON.stringify({ text, source: "paste" }),
      });
      onChange([data.sample, ...samples.filter((item) => item.id !== data.sample.id)]);
      onDigest(data.digest);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有收进语气样本");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: number) {
    setPending(true);
    setError("");
    try {
      const data = await api<{ digest: string }>(`/api/voice-samples/${id}`, { method: "DELETE" });
      onChange(samples.filter((item) => item.id !== id));
      onDigest(data.digest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-sm">语气样本</p>
      <p className="mt-1 text-xs leading-5 text-muted">贴一段你确认过的成稿。收进来之后会先蒸馏成语气档案，之后写稿优先服从这份档案，只拿两小段原文当语感。每个账号最多 8 段。</p>
      {digest.trim() ? (
        <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-paper px-3 py-2 text-xs leading-5 text-muted">{digest}</pre>
      ) : (
        <p className="mt-2 text-xs text-muted">{mine.length > 0 ? "下次生成时会用这些样本蒸馏语气档案。" : "还没有语气档案。"}</p>
      )}
      {mine.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {mine.map((item) => (
            <li key={item.id} className="rounded-2xl bg-paper px-3 py-2 text-sm leading-6">
              <p className="line-clamp-3">{item.text}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>{item.source === "draft" ? "从成稿收的" : "贴进来的"}</span>
                <button type="button" className="hover:text-ink" disabled={pending} onClick={() => void remove(item.id)}>
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">还没有样本。</p>
      )}
      <textarea
        className={`${fieldClass} mt-2 min-h-20 resize-y`}
        value={text}
        maxLength={1500}
        placeholder="贴一段爆款或自己满意的成稿，40 到 1500 字"
        disabled={pending}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="button" className={`${secondaryButton} mt-2`} disabled={pending || text.trim().length < 40} onClick={() => void add()}>
        {pending ? "正在蒸馏…" : "收进这个账号"}
      </button>
      {error ? <p className="mt-2 text-sm text-cinnabar-deep">{error}</p> : null}
    </div>
  );
}
