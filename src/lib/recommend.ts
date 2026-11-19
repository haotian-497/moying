import { sameTopic, type AccountIdea, type HotTopic } from "@/lib/types";

export function recommendTopics(hot: HotTopic[], ideas: AccountIdea[]): HotTopic[] {
  const picked: HotTopic[] = [];
  for (const kind of ["tight", "bridge"] as const) {
    const found = hot.find((item) => item.kind === kind);
    if (found) picked.push(found);
  }
  for (const topic of hot) {
    if (picked.length >= 2) break;
    if (topic.kind === "regular" || topic.kind === "own") continue;
    if (picked.some((item) => sameTopic(item.title, topic.title))) continue;
    picked.push(topic);
  }
  const room = Math.max(1, 3 - picked.length);
  const regulars: HotTopic[] = ideas.slice(0, room).map((idea) => ({
    title: idea.title,
    kind: "regular",
    basedOn: "",
    why: idea.why,
  }));
  return [...picked.slice(0, 2), ...regulars].slice(0, 3);
}
