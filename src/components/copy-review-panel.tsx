"use client";

import { Check, Crosshair, X } from "lucide-react";
import { primaryButton, secondaryButton } from "@/components/ui";
import { reviewMessage } from "@/lib/review-message";
import { COPY_ISSUE_LABEL, COPY_ISSUE_WHERE, REVIEW_VERDICT_LABEL, type CopyReview } from "@/lib/types";

function ignoredLine(review: CopyReview) {
  const notes = [review.dropped ? `${review.dropped} 条在原文里对不上` : "", review.padded ? `${review.padded} 条凑数提示` : ""].filter(Boolean);
  return notes.length > 0 ? `已忽略：${notes.join("、")}` : "";
}

export function CopyReviewPanel({
  review,
  pending,
  onSettle,
  onApplyAll,
  onLocate,
  anchor = "copy-review",
}: {
  review: CopyReview | undefined;
  pending: boolean;
  onSettle?: (index: number, action: "apply" | "dismiss") => void;
  onApplyAll?: () => void;
  onLocate?: (quote: string) => void;
  anchor?: string;
}) {
  if (!review && !pending) return null;
  const message = review ? reviewMessage(review) : "";
  const flags = review?.flags ?? [];
  const applicable = Boolean(onApplyAll) && (review?.issues.length ?? 0) >= 2;
  return (
    <section id={anchor || undefined} className="mt-6 scroll-mt-24 rounded-2xl bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm">总评</h3>
        {applicable ? (
          <button type="button" className={primaryButton} disabled={pending} onClick={onApplyAll}>
            <Check className="h-3.5 w-3.5" />
            全部采纳
          </button>
        ) : null}
      </div>
      {pending ? <p className="mt-2 text-sm leading-6 text-muted">正在通读全文…</p> : null}
      {review?.verdict ? <p className="mt-2 text-sm leading-6">{REVIEW_VERDICT_LABEL[review.verdict]}</p> : null}
      {review?.risk && review.risk !== "无" ? <p className="mt-1 text-sm leading-6 text-cinnabar">风险 {review.risk}</p> : null}
      {review?.summary ? <p className="mt-2 text-sm leading-6">{review.summary}</p> : null}
      {review && ignoredLine(review) ? <p className="mt-1 text-sm leading-6 text-muted">{ignoredLine(review)}</p> : null}
      {message ? <p className="mt-2 text-sm leading-6">{message}</p> : null}
      {flags.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {flags.map((flag, index) => (
            <li key={`${flag.dimension}-${flag.quote}-${index}`} className="rounded-2xl border border-line bg-card px-3 py-3 text-sm leading-6">
              <p className="text-xs text-muted">
                {flag.dimension} · {flag.level}
              </p>
              <p className="mt-1">{flag.what}</p>
              {flag.quote ? (
                <p className="mt-1 text-cinnabar">
                  {flag.quote}
                  {flag.locatable === false ? <span className="text-muted">（原文里没精确匹配到，位置仅供参考）</span> : null}
                </p>
              ) : null}
              {flag.suggestion ? <p className="mt-1 text-moss">{flag.suggestion}</p> : null}
              {onLocate && flag.quote && flag.locatable !== false ? (
                <div className="mt-2">
                  <button type="button" className={secondaryButton} disabled={pending} onClick={() => onLocate(flag.quote)}>
                    <Crosshair className="h-3 w-3" />
                    定位
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {review && review.issues.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {review.issues.map((issue, index) => (
            <li key={`${issue.where}-${issue.quote}-${index}`} className="rounded-2xl border border-line bg-card px-3 py-3 text-sm leading-6">
              <p className="text-xs text-muted">
                {COPY_ISSUE_LABEL[issue.kind]} · {COPY_ISSUE_WHERE[issue.where]}
              </p>
              <p className="mt-1 text-cinnabar">{issue.quote}</p>
              {issue.kind === "flow" && !issue.suggestion ? <p className="mt-1 text-moss">删掉这句</p> : null}
              {issue.count && issue.count > 1 ? <p className="mt-1 text-muted">原文出现 {issue.count} 次，只改第一处</p> : null}
              {issue.suggestion ? <p className="mt-1 text-moss">{issue.suggestion}</p> : null}
              {issue.note ? <p className="mt-1 text-cinnabar-deep">{issue.note}</p> : null}
              {onSettle || onLocate ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {onLocate && issue.quote ? (
                    <button type="button" className={secondaryButton} disabled={pending} onClick={() => onLocate(issue.quote)}>
                      <Crosshair className="h-3 w-3" />
                      定位
                    </button>
                  ) : null}
                  {onSettle && (issue.suggestion || (issue.kind === "flow" && !issue.suggestion)) ? (
                    <button type="button" className={primaryButton} disabled={pending} onClick={() => onSettle(index, "apply")}>
                      <Check className="h-3 w-3" />
                      采纳
                    </button>
                  ) : null}
                  {onSettle ? (
                    <button type="button" className={secondaryButton} disabled={pending} onClick={() => onSettle(index, "dismiss")}>
                      <X className="h-3 w-3" />
                      忽略
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
