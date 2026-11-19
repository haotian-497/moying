"use client";

import { Check } from "lucide-react";

export type WorkStep = "topic" | "direction" | "draft";

const STEPS: { id: WorkStep; label: string; sublabel: string }[] = [
  { id: "topic", label: "选题材", sublabel: "主题/话题" },
  { id: "direction", label: "选方向", sublabel: "3 个角度" },
  { id: "draft", label: "成稿", sublabel: "编辑" },
];

function stepIndex(step: WorkStep) {
  return STEPS.findIndex((item) => item.id === step);
}

export function Stepper({
  current,
  onStep,
}: {
  current: WorkStep;
  onStep?: (step: WorkStep) => void;
}) {
  const currentIdx = stepIndex(current);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-2.5 sm:gap-[1.125rem]" role="tablist" aria-label="写作步骤">
      {STEPS.map((step, index) => {
        const isCurrent = current === step.id;
        const isComplete = currentIdx > index;
        const clickable = Boolean(onStep);

        return (
          <div key={step.id} className="flex min-w-0 items-center gap-2.5 sm:gap-[1.125rem]">
            <button
              type="button"
              role="tab"
              aria-selected={isCurrent}
              disabled={!clickable}
              onClick={() => onStep?.(step.id)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition sm:gap-2.5 sm:px-3 ${
                clickable ? "cursor-pointer hover:bg-paper-deep" : "cursor-default"
              } ${isCurrent ? "bg-paper-deep" : ""}`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition ${
                  isComplete || isCurrent ? "bg-ink text-white" : "bg-paper-deep text-muted"
                } ${isCurrent ? "ring-4 ring-ink/10" : ""}`}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="text-left">
                <span className={`block text-sm font-medium leading-tight ${isCurrent ? "text-ink" : "text-muted"}`}>{step.label}</span>
                <span className="block text-[10px] tracking-wide text-muted/70">{step.sublabel}</span>
              </span>
            </button>
            {index < STEPS.length - 1 ? (
              <span className={`hidden h-px w-[3.375rem] sm:block sm:w-[5.625rem] ${currentIdx > index ? "bg-ink" : "bg-line"}`} aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
