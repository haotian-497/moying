import type { CopyReview } from "@/lib/types";

export function reviewMessage(review: CopyReview) {
  if (review.summary) return "";
  if (review.failed && review.issues.length === 0) return "这次没检查成。稿子照常可以复制。";
  if (review.failed) return "有的地方这次没查完。下面是已经查到的。稿子照常可以复制。";
  if (review.issues.length === 0) return "这版可以发出去。";
  return "";
}
