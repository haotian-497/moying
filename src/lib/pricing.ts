export type ModelPrice = {
  model: string;
  inputPerMillion: number;
  outputPerMillion: number;
};

const BUILTIN: ModelPrice[] = [
  { model: "deepseek-chat", inputPerMillion: 2, outputPerMillion: 8 },
  { model: "deepseek-reasoner", inputPerMillion: 4, outputPerMillion: 16 },
  { model: "gpt-4o-mini", inputPerMillion: 1.1, outputPerMillion: 4.4 },
  { model: "claude-sonnet-4-5", inputPerMillion: 22, outputPerMillion: 110 },
];

function loadPrices() {
  const prices = new Map(BUILTIN.map((item) => [item.model, { ...item }]));
  const raw = process.env.PRICING_JSON;
  if (!raw) return prices;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return prices;
    for (const [model, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const row = value as { inputPerMillion?: unknown; outputPerMillion?: unknown };
      const input = Number(row.inputPerMillion);
      const output = Number(row.outputPerMillion);
      if (!model.trim() || !Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) continue;
      prices.set(model.trim(), { model: model.trim(), inputPerMillion: input, outputPerMillion: output });
    }
  } catch (error) {
    console.error(error);
  }
  return prices;
}

export function listPrices() {
  return [...loadPrices().values()];
}

export function priceOf(model: string) {
  return loadPrices().get(model) ?? null;
}

export function estimateYuan(model: string, inputTokens: number, outputTokens: number) {
  const price = priceOf(model);
  if (!price) return null;
  if (inputTokens + outputTokens <= 0) return null;
  return (inputTokens / 1_000_000) * price.inputPerMillion + (outputTokens / 1_000_000) * price.outputPerMillion;
}

export function formatYuan(value: number) {
  if (value < 0.01) return `${value.toFixed(4)} 元`;
  return `${value.toFixed(2)} 元`;
}
