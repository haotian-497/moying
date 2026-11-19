export const FEATURES = [
  { id: "directions", label: "三个方向" },
  { id: "content", label: "成稿" },
  { id: "hot", label: "热点" },
  { id: "ideas", label: "常规题" },
  { id: "digest", label: "语气档案" },
  { id: "revise", label: "改写" },
  { id: "cues", label: "口播" },
  { id: "review", label: "校对" },
  { id: "relation", label: "跨段校对" },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];

export function isFeatureId(value: string): value is FeatureId {
  return FEATURES.some((item) => item.id === value);
}

export function featureLabel(id: string) {
  if (id === "eval") return "Eval 对比";
  return FEATURES.find((item) => item.id === id)?.label ?? id;
}
