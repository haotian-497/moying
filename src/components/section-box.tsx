"use client";

import { useEffect, useState } from "react";
import { fieldClass, secondaryButton } from "@/components/ui";
import { api } from "@/lib/client";
import { SECTION_PRESETS } from "@/lib/sections";
import type { ContentSection, SectionField } from "@/lib/types";

const emptyField = (): SectionField => ({ label: "", hint: "", required: true });

export function SectionBox({ accountId }: { accountId: number }) {
  const [sections, setSections] = useState<ContentSection[]>([]);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [guide, setGuide] = useState("");
  const [fields, setFields] = useState<SectionField[]>([emptyField()]);
  const [preset, setPreset] = useState(SECTION_PRESETS[0].name);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ sections: ContentSection[] }>(`/api/accounts/${accountId}/sections`)
      .then((data) => {
        if (!cancelled) setSections(data.sections);
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  function openNew() {
    const chosen = SECTION_PRESETS.find((item) => item.name === preset) ?? SECTION_PRESETS[0];
    setEditing("new");
    setName(chosen.name);
    setPurpose(chosen.purpose);
    setGuide(chosen.guide);
    setFields(chosen.fields.map((field) => ({ ...field })));
    setError("");
  }

  function openEdit(section: ContentSection) {
    setEditing(section.id);
    setName(section.name);
    setPurpose(section.purpose);
    setGuide(section.guide);
    setFields(section.fields.length ? section.fields.map((field) => ({ ...field })) : [emptyField()]);
    setError("");
  }

  async function save() {
    setPending(true);
    setError("");
    const body = { name, purpose, guide, fields: fields.filter((field) => field.label.trim()) };
    try {
      if (editing === "new") {
        const data = await api<{ section: ContentSection }>(`/api/accounts/${accountId}/sections`, { method: "POST", body: JSON.stringify(body) });
        setSections((current) => [...current, data.section]);
      } else if (typeof editing === "number") {
        const data = await api<{ section: ContentSection }>(`/api/accounts/${accountId}/sections/${editing}`, { method: "PUT", body: JSON.stringify(body) });
        setSections((current) => current.map((item) => (item.id === data.section.id ? data.section : item)));
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "没有保存栏目");
    } finally {
      setPending(false);
    }
  }

  async function remove(id: number) {
    setPending(true);
    setError("");
    try {
      await api(`/api/accounts/${accountId}/sections/${id}`, { method: "DELETE" });
      setSections((current) => current.filter((item) => item.id !== id));
      if (editing === id) setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-sm">内容栏目</p>
      <p className="mt-1 text-xs leading-5 text-muted">一个账号可以分几条内容线。写的时候选一条，并填上这条栏目要的真实素材。没填必填项不能生成。</p>
      {sections.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {sections.map((section) => (
            <li key={section.id} className="rounded-2xl bg-paper px-3 py-2 text-sm leading-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p>{section.name}</p>
                  {section.purpose ? <p className="text-xs leading-5 text-muted">{section.purpose}</p> : null}
                </div>
                <span className="flex shrink-0 gap-3 text-xs text-muted">
                  <button type="button" className="hover:text-ink" disabled={pending} onClick={() => openEdit(section)}>
                    编辑
                  </button>
                  <button type="button" className="hover:text-ink" disabled={pending} onClick={() => void remove(section.id)}>
                    删除
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted">还没有栏目。可以从下面的模板加一条。</p>
      )}
      {editing === null ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className={fieldClass} value={preset} onChange={(event) => setPreset(event.target.value)}>
            {SECTION_PRESETS.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="button" className={secondaryButton} disabled={pending} onClick={openNew}>
            用这个模板
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block">栏目名</span>
            <input className={fieldClass} value={name} maxLength={20} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block">这个栏目讲什么</span>
            <input className={fieldClass} value={purpose} maxLength={200} onChange={(event) => setPurpose(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block">写作要点</span>
            <textarea className={`${fieldClass} min-h-16 resize-y`} value={guide} maxLength={400} onChange={(event) => setGuide(event.target.value)} />
          </label>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
                <input
                  className={fieldClass}
                  value={field.label}
                  maxLength={20}
                  placeholder="要作者填什么"
                  onChange={(event) => setFields((current) => current.map((item, at) => (at === index ? { ...item, label: event.target.value } : item)))}
                />
                <input
                  className={fieldClass}
                  value={field.hint}
                  maxLength={80}
                  placeholder="提示"
                  onChange={(event) => setFields((current) => current.map((item, at) => (at === index ? { ...item, hint: event.target.value } : item)))}
                />
                <label className="flex items-center gap-1 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) => setFields((current) => current.map((item, at) => (at === index ? { ...item, required: event.target.checked } : item)))}
                  />
                  必填
                </label>
                <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setFields((current) => current.filter((_, at) => at !== index))}>
                  去掉
                </button>
              </div>
            ))}
            <button type="button" className="text-xs text-muted hover:text-ink" onClick={() => setFields((current) => [...current, emptyField()])}>
              加一项素材
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} disabled={pending} onClick={() => void save()}>
              {pending ? "正在保存…" : "保存栏目"}
            </button>
            <button type="button" className="text-sm text-muted" disabled={pending} onClick={() => setEditing(null)}>
              取消
            </button>
          </div>
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-cinnabar-deep">{error}</p> : null}
    </div>
  );
}
