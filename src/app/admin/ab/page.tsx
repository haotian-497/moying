import type { Metadata } from "next";
import Link from "next/link";
import { AbBoard } from "@/components/ab-board";
import { pageDescClass, pageTitleClass, primaryButton } from "@/components/ui";
import { getBatch, listManualCases, listSamples, listWorkCases } from "@/lib/eval-data";
import { getEvalMeta, libraryAsEvalCases } from "@/lib/eval-library";
import { FEATURES, isFeatureId } from "@/lib/features";
import { listPromptVersions, listVariants } from "@/lib/prompts";

export const metadata: Metadata = { title: "提示词 A/B" };

export default async function AdminAbPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch } = await searchParams;
  const runs = batch ? getBatch(batch) : [];
  const officials = FEATURES.flatMap((item) => listPromptVersions(item.id).map((version) => ({ ...version, feature: item.id })));
  const variants = listVariants();
  const goldCases = FEATURES.flatMap((item) =>
    isFeatureId(item.id) ? libraryAsEvalCases(item.id).map((entry) => ({ key: entry.key, feature: entry.feature, title: entry.title, kind: entry.kind })) : [],
  );
  const cases = [
    ...goldCases,
    ...listManualCases().map((item) => ({ key: `manual:${item.id}`, feature: item.feature, title: item.title, kind: "手工" })),
    ...listSamples()
      .filter((item) => !item.excluded)
      .map((item) => ({ key: `sample:${item.id}`, feature: item.feature, title: `${item.username} 的真实使用`, kind: "真实" })),
    ...listWorkCases().map((item) => ({ key: item.key, feature: item.feature, title: item.title, kind: "历史稿子" })),
  ];
  const l1Needed = getEvalMeta("l1_needed") === "1";
  const l1Reason = getEvalMeta("l1_needed_reason") || "";
  return (
    <section>
      <h1 className={pageTitleClass}>提示词 A/B</h1>
      <p className={pageDescClass}>
        左边是正式版本，右边是预修改版本。两边都可以改，也可以拿选中的用例单独测试。保存正式版之后，之后的用户写稿才会用新提示词。预修改版本的保存和测试不会影响正在写稿的用户。金标/反例会优先出现在用例列表顶部。
      </p>
      {l1Needed ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">正式提示词已变更，请跑产品回归</p>
          <p className="mt-1 text-amber-800/90">{l1Reason}</p>
          <Link href="/admin/eval" className={`${primaryButton} mt-3 inline-flex`}>
            去 Eval 跑链路回归
          </Link>
        </div>
      ) : null}
      <div className="mt-6">
        <AbBoard
          officials={officials}
          variants={variants}
          cases={cases}
          batch={batch ?? null}
          runs={runs.map((item) => ({
            caseKey: item.caseKey,
            title: item.title,
            original: item.original,
            outputA: item.outputA,
            outputB: item.outputB,
            scoreA: item.scoreA,
            scoreB: item.scoreB,
            flip: item.flip,
            winner: item.winner,
            errorA: item.errorA,
            errorB: item.errorB,
            variantVersionId: item.variantVersionId,
          }))}
        />
      </div>
    </section>
  );
}
