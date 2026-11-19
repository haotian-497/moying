import type { Metadata } from "next";
import { EvalBoard } from "@/components/eval-board";
import { pageDescClass, pageTitleClass } from "@/components/ui";
import { listBatches, listManualCases, listSamples, listWorkCases } from "@/lib/eval-data";
import { listCandidates, listLibrary } from "@/lib/eval-library";
import { getPipelineRun, listPipelineRuns } from "@/lib/eval-pipeline";
import { qualityOverview } from "@/lib/eval-quality";

export const metadata: Metadata = { title: "Eval" };

export default async function AdminEvalPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch } = await searchParams;
  const quality = qualityOverview();
  const pipelineDetail = batch ? getPipelineRun(batch) : null;
  return (
    <section>
      <h1 className={pageTitleClass}>Eval</h1>
      <p className={pageDescClass}>
        产品效果总览、金标库与链路回归在这里。单能力 Prompt 对照与盲选仍在「提示词 A/B」。
      </p>
      <div className="mt-6">
        <EvalBoard
          quality={quality}
          library={listLibrary().map((item) => ({
            id: item.id,
            kind: item.kind,
            path: item.path,
            title: item.title,
            feature: item.feature,
            tags: item.tags,
            platform: item.frozen.draft.platform,
            theme: item.frozen.draft.theme,
            createdAt: item.createdAt,
            sourceType: item.sourceType,
          }))}
          manual={listManualCases()}
          samples={listSamples()}
          works={listWorkCases()}
          batches={listBatches()}
          pipelineRuns={listPipelineRuns()}
          pipelineDetail={pipelineDetail}
          candidates={listCandidates("pending")}
        />
      </div>
    </section>
  );
}
