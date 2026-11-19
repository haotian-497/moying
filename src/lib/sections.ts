import type { SectionField, WorkSection } from "@/lib/types";

export const SECTION_PRESETS: { name: string; purpose: string; guide: string; fields: SectionField[] }[] = [
  {
    name: "来时路",
    purpose: "讲清楚这个号是怎么来的、为什么是我在做",
    guide: "用具体的时间点和转折推进，不喊口号。把「为什么是我」落在真实经历上。",
    fields: [
      { label: "你的背景经历", hint: "做过什么、在哪待过", required: true },
      { label: "为什么开始做这个号", hint: "触发你开始的那件事", required: true },
      { label: "和同类账号的不一样", hint: "别人做不到或不愿意做的", required: false },
    ],
  },
  {
    name: "生活日常",
    purpose: "记录和账号定位有关的真实片段",
    guide: "从一个具体时刻切进去。可以没有结论，不要写成流水账。",
    fields: [
      { label: "具体是哪天、什么场景", hint: "时间、地点、当时在干嘛", required: true },
      { label: "发生了什么", hint: "按顺序说", required: true },
      { label: "你当时的感受", hint: "不用升华", required: false },
    ],
  },
  {
    name: "干货教程",
    purpose: "把一件事拆成读者今天就能照着做的步骤",
    guide: "先说清能解决什么。步骤要能被验证，并标出常见的坑。",
    fields: [
      { label: "要教会读者做什么", hint: "做完能得到什么", required: true },
      { label: "你自己的实操经验", hint: "怎么做的、用了什么、花了多久", required: true },
      { label: "常见的坑", hint: "别人在哪一步翻车", required: false },
    ],
  },
  {
    name: "行业观察",
    purpose: "从正在发生的变化里讲出一个有用的判断",
    guide: "先给结论再拆原因。用亲历或可核查的事实，承认判断的边界。",
    fields: [
      { label: "你观察到的变化", hint: "什么在变", required: true },
      { label: "你的判断", hint: "这意味着什么", required: true },
      { label: "支撑判断的事实或案例", hint: "亲历的或可核查的，没有就留空", required: false },
    ],
  },
  {
    name: "答读者问",
    purpose: "一次说透一个读者反复问的问题",
    guide: "先复述问题和处境，再给直接答案。不同处境可以有不同做法。",
    fields: [
      { label: "读者的原问题", hint: "尽量用原话", required: true },
      { label: "提问者的处境", hint: "什么阶段、卡在哪", required: false },
      { label: "你的答案要点", hint: "先说结论", required: true },
    ],
  },
  {
    name: "避坑指南",
    purpose: "把踩过的坑讲清楚，让读者少走弯路",
    guide: "写清当时怎么想、实际发生了什么、代价是什么、现在会怎么做。",
    fields: [
      { label: "踩过的坑", hint: "具体说", required: true },
      { label: "当时是怎么想的", hint: "为什么当时觉得那样做是对的", required: false },
      { label: "实际代价", hint: "钱、时间或机会", required: true },
      { label: "现在你会怎么做", hint: "可复用的做法", required: false },
    ],
  },
  {
    name: "幕后故事",
    purpose: "把做这件事的过程讲出来，包括不体面的部分",
    guide: "有时间线。写出犹豫、返工和放弃掉的方案。允许结果平淡。",
    fields: [
      { label: "时间线", hint: "什么时候开始、经过哪几个阶段", required: true },
      { label: "关键决定", hint: "岔路口上你选了什么", required: true },
      { label: "返工或放弃掉的方案", hint: "试过但没成的", required: false },
      { label: "结果", hint: "如实说", required: false },
    ],
  },
];

export function sectionBlock(section: WorkSection | null | undefined, inputs: Record<string, string> | null | undefined) {
  if (!section?.name) return "";
  const lines = [
    `栏目名：${section.name}`,
    section.purpose ? `这个栏目讲什么：${section.purpose}` : "",
    section.guide ? `这个栏目的写作要点：${section.guide}` : "",
  ].filter(Boolean);
  const head = [
    "本篇所属栏目：",
    lines.join("\n"),
    "本篇必须是这个栏目该有的样子。栏目要点和通用的平台写法冲突时，以栏目要点为准。",
  ].join("\n");
  const fields = section.fields ?? [];
  const filled = fields
    .map((field) => ({ label: field.label, value: String(inputs?.[field.label] ?? "").trim() }))
    .filter((field) => field.value);
  if (filled.length === 0) return head;
  const missing = fields.filter((field) => !String(inputs?.[field.label] ?? "").trim()).map((field) => field.label);
  const materials = [
    "作者为这个栏目提供的素材：",
    filled.map((field) => `【${field.label}】${field.value}`).join("\n"),
    "这些是作者本人提供的真实信息，是这篇里唯一可信的事实来源。",
    "优先把它们展开成有细节的段落，不要原样复述一遍。",
    "不要编造它们之外的个人经历、时间、地点、数字、职位或人物关系。",
    missing.length ? `作者没有填「${missing.join("」「")}」。不要脑补，绕开或用不涉及具体事实的方式处理。` : "",
  ].filter(Boolean);
  return `${head}\n${materials.join("\n")}`;
}
