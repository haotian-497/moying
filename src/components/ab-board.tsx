"use client";

import { useMemo, useState } from "react";
import { fieldClass, primaryButton, secondaryButton, sectionTitleClass } from "@/components/ui";
import { FEATURES, featureLabel } from "@/lib/features";
import { formatTime } from "@/lib/format";

type Official = { id: number; feature: string; note: string; source: string; createdAt: string; author: string; active: boolean; body: string };
type VariantVersion = { id: number; variantId: number; note: string; source: string; createdAt: string; author: string; active: boolean; body: string };
type Variant = { id: number; feature: string; name: string; versions: VariantVersion[] };
type CaseItem = { key: string; feature: string; title: string; kind: string };
type TestResult = { title: string; text: string; error: string; summary: string };
type Run = {
  caseKey: string;
  title: string;
  original: string | null;
  outputA: string;
  outputB: string;
  scoreA: { summary: string; metrics?: { label: string; value: string }[] };
  scoreB: { summary: string; metrics?: { label: string; value: string }[] };
  flip: boolean;
  winner: string | null;
  errorA: string;
  errorB: string;
  variantVersionId: number | null;
};

function versionBody(versions: { id: number; active: boolean; body: string }[], id: number) {
  return versions.find((item) => item.id === id)?.body ?? versions.find((item) => item.active)?.body ?? versions[0]?.body ?? "";
}

export function AbBoard({
  officials,
  variants,
  cases,
  batch,
  runs,
}: {
  officials: Official[];
  variants: Variant[];
  cases: CaseItem[];
  batch: string | null;
  runs: Run[];
}) {
  const initialFeature = runs[0] ? variants.find((item) => item.versions.some((version) => version.id === runs[0].variantVersionId))?.feature ?? FEATURES[0].id : FEATURES[0].id;
  const [feature, setFeature] = useState(initialFeature);
  const featureOfficials = officials.filter((item) => item.feature === feature);
  const featureVariants = variants.filter((item) => item.feature === feature);
  const [officialId, setOfficialId] = useState(featureOfficials.find((item) => item.active)?.id ?? featureOfficials[0]?.id ?? 0);
  const [variantId, setVariantId] = useState(featureVariants[0]?.id ?? 0);
  const currentVariant = featureVariants.find((item) => item.id === variantId) ?? featureVariants[0];
  const [variantVersionId, setVariantVersionId] = useState(currentVariant?.versions.find((item) => item.active)?.id ?? currentVariant?.versions[0]?.id ?? 0);
  const [officialBody, setOfficialBody] = useState(versionBody(featureOfficials, officialId));
  const [draftBody, setDraftBody] = useState(versionBody(currentVariant?.versions ?? [], variantVersionId));
  const [officialNote, setOfficialNote] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [createName, setCreateName] = useState("");
  const [createBody, setCreateBody] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [officialConfirm, setOfficialConfirm] = useState<"save" | "rollback" | null>(null);
  const [draftConfirm, setDraftConfirm] = useState<"save" | "rollback" | "promote" | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);
  const [officialResults, setOfficialResults] = useState<TestResult[] | null>(null);
  const [draftResults, setDraftResults] = useState<TestResult[] | null>(null);
  const pickedCases = useMemo(() => cases.filter((item) => item.feature === feature), [cases, feature]);

  function chooseFeature(next: string) {
    const nextOfficials = officials.filter((item) => item.feature === next);
    const nextVariants = variants.filter((item) => item.feature === next);
    const nextOfficialId = nextOfficials.find((item) => item.active)?.id ?? nextOfficials[0]?.id ?? 0;
    const nextVariant = nextVariants[0];
    const nextVersionId = nextVariant?.versions.find((item) => item.active)?.id ?? nextVariant?.versions[0]?.id ?? 0;
    setFeature(next);
    setOfficialId(nextOfficialId);
    setVariantId(nextVariant?.id ?? 0);
    setVariantVersionId(nextVersionId);
    setOfficialBody(versionBody(nextOfficials, nextOfficialId));
    setDraftBody(versionBody(nextVariant?.versions ?? [], nextVersionId));
    setSelected([]);
    setOfficialResults(null);
    setDraftResults(null);
    setOfficialConfirm(null);
    setDraftConfirm(null);
  }

  function chooseVariant(id: number) {
    const found = featureVariants.find((item) => item.id === id);
    const versionId = found?.versions.find((item) => item.active)?.id ?? found?.versions[0]?.id ?? 0;
    setVariantId(id);
    setVariantVersionId(versionId);
    setDraftBody(versionBody(found?.versions ?? [], versionId));
    setDraftResults(null);
  }

  async function post(url: string, payload: unknown, next?: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await response.json()) as { error?: string; batch?: string };
      if (!response.ok) throw new Error(data.error || "没有完成");
      window.location.href = next ?? (data.batch ? `/admin/ab?batch=${data.batch}` : window.location.href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有完成");
      setPending(false);
    }
  }

  async function testSide(side: "official" | "draft", promptBody: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", feature, body: promptBody, keys: selected }),
      });
      const data = (await response.json()) as { error?: string; results?: TestResult[] };
      if (!response.ok) throw new Error(data.error || "没有完成");
      if (side === "official") setOfficialResults(data.results ?? []);
      else setDraftResults(data.results ?? []);
      setPending(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有完成");
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-cinnabar-deep">{error}</p> : null}
      <div className="space-y-3 rounded-lg border border-line bg-card px-4 py-4 shadow-sm">
        <label className="block text-xs text-muted">功能</label>
        <select className={fieldClass} value={feature} onChange={(event) => chooseFeature(event.target.value)}>
          {FEATURES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <p className="text-xs text-muted">两边的测试和下面的盲比都用这里勾选的用例，至少一条。</p>
        <ul className="max-h-64 space-y-2 overflow-auto text-sm">
          {pickedCases.map((item) => (
            <li key={item.key}>
              <label className="flex gap-2">
                <input type="checkbox" checked={selected.includes(item.key)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.key] : selected.filter((key) => key !== item.key))} />
                <span>{item.kind} · {item.title}</span>
              </label>
            </li>
          ))}
          {pickedCases.length === 0 ? <li className="text-muted">这个功能还没有用例。先到 Eval 添加。</li> : null}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-line bg-card px-4 py-4 shadow-sm">
          <h2 className={sectionTitleClass}>正式版本</h2>
          <p className="mt-2 text-sm text-muted">保存后，之后所有用户的这类生成都会用这份提示词。</p>
          <select
            className={`${fieldClass} mt-3`}
            value={officialId}
            onChange={(event) => {
              const id = Number(event.target.value);
              setOfficialId(id);
              setOfficialBody(versionBody(featureOfficials, id));
              setOfficialResults(null);
            }}
          >
            {featureOfficials.map((item) => (
              <option key={item.id} value={item.id}>{item.active ? "当前生效 · " : ""}{item.author} · {formatTime(item.createdAt)} · {item.note}</option>
            ))}
          </select>
          <textarea className={`${fieldClass} mt-3 min-h-80`} value={officialBody} onChange={(event) => setOfficialBody(event.target.value)} />
          {officialConfirm === "save" ? (
            <div className="mt-3 rounded-md bg-paper-deep px-3 py-3 text-sm leading-6">
              <p>保存后，之后所有用户都会用新提示词。已经写好的稿子不会改。</p>
              <input className={`${fieldClass} mt-2`} value={officialNote} onChange={(event) => setOfficialNote(event.target.value)} placeholder="这次改了什么" />
              <div className="mt-2 flex gap-2">
                <button type="button" className={primaryButton} disabled={pending} onClick={() => post("/api/admin/prompts", { feature, body: officialBody, note: officialNote }, "/admin/ab")}>确认保存</button>
                <button type="button" className={secondaryButton} onClick={() => setOfficialConfirm(null)}>返回</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={secondaryButton} onClick={() => setOfficialConfirm("save")}>保存为正式版</button>
              <button type="button" className={primaryButton} disabled={pending} onClick={() => testSide("official", officialBody)}>{pending ? "正在测试…" : "测试"}</button>
            </div>
          )}
          <TestList results={officialResults} />
          <ul className="mt-4 space-y-2 text-sm">
            {featureOfficials.map((item) => (
              <li key={item.id} className="rounded-md border border-line px-3 py-2">
                {item.active ? "正在生效 · " : ""}{item.source} · {item.author} · {formatTime(item.createdAt)} · {item.note}
                {item.active ? null : (
                  <button type="button" className={`${secondaryButton} ml-3`} disabled={pending} onClick={() => { setRollbackVersion(item.id); setDraftConfirm(null); setOfficialConfirm("rollback"); }}>回到这一版</button>
                )}
              </li>
            ))}
          </ul>
          {officialConfirm === "rollback" && rollbackVersion ? (
            <div className="mt-3 rounded-md bg-paper-deep px-3 py-3 text-sm">
              <p>确认回到这一版正式提示词。较新的版本会留着，还可以再切回去。之后用户写稿会用这一版。</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={primaryButton} disabled={pending} onClick={() => post("/api/admin/prompts", { action: "rollback", feature, versionId: rollbackVersion }, "/admin/ab")}>确认回滚</button>
                <button type="button" className={secondaryButton} onClick={() => setOfficialConfirm(null)}>取消</button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-lg border border-line bg-card px-4 py-4 shadow-sm">
          <h2 className={sectionTitleClass}>预修改版本</h2>
          <p className="mt-2 text-sm text-muted">这里的保存和测试都不会改变用户正在用的提示词。</p>
          <select className={`${fieldClass} mt-3`} value={currentVariant?.id ?? 0} onChange={(event) => chooseVariant(Number(event.target.value))}>
            {featureVariants.length === 0 ? <option value={0}>还没有预修改版本</option> : null}
            {featureVariants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {currentVariant ? (
            <select
              className={`${fieldClass} mt-3`}
              value={variantVersionId}
              onChange={(event) => {
                const id = Number(event.target.value);
                setVariantVersionId(id);
                setDraftBody(versionBody(currentVariant.versions, id));
                setDraftResults(null);
              }}
            >
              {currentVariant.versions.map((item) => (
                <option key={item.id} value={item.id}>{item.active ? "当前 · " : ""}{item.source} · {formatTime(item.createdAt)} · {item.note}</option>
              ))}
            </select>
          ) : null}
          <textarea className={`${fieldClass} mt-3 min-h-80`} value={draftBody} onChange={(event) => setDraftBody(event.target.value)} placeholder="预修改提示词" />
          {currentVariant && draftConfirm === "save" ? (
            <div className="mt-3 rounded-md bg-paper-deep px-3 py-3 text-sm">
              <p>这次只保存预修改版本，不会改用户正在用的提示词。</p>
              <input className={`${fieldClass} mt-2`} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="根据什么结果改的" />
              <div className="mt-2 flex gap-2">
                <button type="button" className={primaryButton} disabled={pending} onClick={() => post("/api/admin/variants", { action: "save", variantId: currentVariant.id, body: draftBody, note: draftNote }, "/admin/ab")}>确认保存</button>
                <button type="button" className={secondaryButton} onClick={() => setDraftConfirm(null)}>返回</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {currentVariant ? <button type="button" className={secondaryButton} onClick={() => setDraftConfirm("save")}>保存为新版本</button> : null}
              <button type="button" className={primaryButton} disabled={pending} onClick={() => testSide("draft", draftBody)}>{pending ? "正在测试…" : "测试"}</button>
            </div>
          )}
          <TestList results={draftResults} />
          {currentVariant ? (
            <ul className="mt-4 space-y-2 text-sm">
              {currentVariant.versions.map((item) => (
                <li key={item.id} className="rounded-md border border-line px-3 py-2">
                  {item.active ? "当前 · " : ""}{item.source} · {item.author} · {formatTime(item.createdAt)} · {item.note}
                  {item.active ? null : (
                    <button type="button" className={`${secondaryButton} ml-3`} disabled={pending} onClick={() => { setRollbackVersion(item.id); setOfficialConfirm(null); setDraftConfirm("rollback"); }}>回到这一版</button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {currentVariant && draftConfirm === "rollback" && rollbackVersion ? (
            <div className="mt-3 rounded-md bg-paper-deep px-3 py-3 text-sm">
              <p>确认回到这一版预修改稿。较新的版本会留着，还可以再切回去。</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className={primaryButton} disabled={pending} onClick={() => post("/api/admin/variants", { action: "rollback", variantId: currentVariant.id, versionId: rollbackVersion }, "/admin/ab")}>确认回滚</button>
                <button type="button" className={secondaryButton} onClick={() => setDraftConfirm(null)}>取消</button>
              </div>
            </div>
          ) : null}
          {currentVariant && draftConfirm === "promote" ? (
            <div className="mt-3 rounded-md bg-paper-deep px-3 py-3 text-sm">
              <p>保存后，之后所有用户的这类生成都会用这份提示词。未确认前仍用原来的正式版。</p>
              <input className={`${fieldClass} mt-2`} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="为什么采用" />
              <div className="mt-2 flex gap-2">
                <button type="button" className={primaryButton} disabled={pending} onClick={() => post("/api/admin/variants", { action: "promote", versionId: variantVersionId, note: draftNote })}>确认设为正式</button>
                <button type="button" className={secondaryButton} onClick={() => setDraftConfirm(null)}>返回</button>
              </div>
            </div>
          ) : currentVariant ? (
            <button type="button" className={`${primaryButton} mt-3`} onClick={() => setDraftConfirm("promote")}>把当前选中的预修改版设为正式</button>
          ) : null}
        </section>
      </div>

      <div className="rounded-lg border border-line bg-card px-4 py-4 shadow-sm">
        <h2 className={sectionTitleClass}>新建预修改版本</h2>
        <p className="mt-2 text-sm text-muted">保存在这里不会改变用户写稿时的提示词。</p>
        <input className={`${fieldClass} mt-3`} value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="名称" />
        <textarea className={`${fieldClass} mt-3 min-h-32`} value={createBody} onChange={(event) => setCreateBody(event.target.value)} placeholder="预修改提示词" />
        <input className={`${fieldClass} mt-3`} value={createNote} onChange={(event) => setCreateNote(event.target.value)} placeholder="修改说明" />
        <button type="button" className={`${secondaryButton} mt-3`} disabled={pending} onClick={() => post("/api/admin/variants", { action: "create", feature, name: createName, body: createBody, note: createNote }, "/admin/ab")}>保存</button>
      </div>

      <div>
        <button type="button" className={primaryButton} disabled={pending} onClick={() => post("/api/admin/eval", { action: "run", feature, officialVersionId: officialId, variantVersionId, keys: selected })}>
          {pending ? "正在对比…" : "用已保存版本盲比"}
        </button>
        <p className="mt-2 text-xs text-muted">盲比用的是上面选中的已保存版本，不包含编辑框里还没保存的文字。</p>
      </div>

      {batch ? (
        <div>
          <h2 className={sectionTitleClass}>这一轮 {batch}</h2>
          <p className="mt-2 text-sm text-muted">左边和右边藏起了正式版与预修改版。选出之前只看正文。选出之后才显示哪边是哪一份，以及字数、条数这些数字。用户当时的结果只作对照。</p>
          <div className="mt-4 space-y-4">
            {runs.map((run) => {
              const left = run.flip ? { text: run.outputB, score: run.scoreB, error: run.errorB, side: "预修改版" } : { text: run.outputA, score: run.scoreA, error: run.errorA, side: "正式版" };
              const right = run.flip ? { text: run.outputA, score: run.scoreA, error: run.errorA, side: "正式版" } : { text: run.outputB, score: run.scoreB, error: run.errorB, side: "预修改版" };
              return (
                <article key={run.caseKey} className="rounded-lg border border-line bg-card px-4 py-4 shadow-sm text-sm">
                  <h3 className="text-sm font-semibold">{run.title}</h3>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {[{ label: "左边", item: left }, { label: "右边", item: right }].map(({ label, item }) => (
                      <div key={label} className="rounded-md bg-paper px-3 py-3">
                        <p>{label}{run.winner ? ` · ${item.side}` : ""}</p>
                        {run.winner && (item.score.metrics ?? []).length > 0 ? (
                          <ul className="mt-1 space-y-1 text-muted">
                            {(item.score.metrics ?? []).map((metric) => (
                              <li key={metric.label}>{metric.label}：{metric.value}</li>
                            ))}
                          </ul>
                        ) : null}
                        {run.winner && (item.score.metrics ?? []).length === 0 && item.score.summary ? <p className="mt-1 text-muted">{item.score.summary}</p> : null}
                        {item.error ? <p className="mt-1 text-cinnabar-deep">{item.error}</p> : null}
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{item.text || "没有输出"}</pre>
                      </div>
                    ))}
                  </div>
                  {run.original ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer">用户当时得到的结果</summary>
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-muted">{run.original}</pre>
                    </details>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["left", "right", "tie"] as const).map((winner) => (
                      <button key={winner} type="button" className={run.winner === winner ? primaryButton : secondaryButton} disabled={pending} onClick={() => post("/api/admin/eval", { action: "vote", batch, caseKey: run.caseKey, winner }, `/admin/ab?batch=${batch}`)}>
                        {winner === "left" ? "左边更好" : winner === "right" ? "右边更好" : "差不多"}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
      <p className="text-xs text-muted">功能对照：{FEATURES.map((item) => featureLabel(item.id)).join("、")}</p>
    </div>
  );
}

function TestList({ results }: { results: TestResult[] | null }) {
  if (!results) return null;
  return (
    <ul className="mt-4 space-y-3">
      {results.map((item) => (
        <li key={item.title} className="rounded-md bg-paper px-3 py-3 text-sm">
          <p>{item.title}</p>
          {item.summary ? <p className="mt-1 text-muted">{item.summary}</p> : null}
          {item.error ? <p className="mt-1 text-cinnabar-deep">{item.error}</p> : null}
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{item.text || "没有输出"}</pre>
        </li>
      ))}
    </ul>
  );
}
