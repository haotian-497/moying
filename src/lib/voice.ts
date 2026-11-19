import { listVoiceSamples, saveStyleDigest } from "@/lib/db";
import { generateStyleDigest } from "@/lib/llm";
import type { VoiceCue } from "@/lib/types";

export async function rebuildVoice(userId: number, accountId: number) {
  const samples = listVoiceSamples(userId, accountId).slice(0, 6);
  const digest = samples.length ? await generateStyleDigest(samples) : "";
  saveStyleDigest(userId, accountId, digest);
  return digest;
}

export async function voiceCue(userId: number, accountId: number | null, digest: string): Promise<VoiceCue> {
  if (!accountId) return { digest: "", excerpts: [] };
  const samples = listVoiceSamples(userId, accountId);
  let text = digest.trim();
  if (!text && samples.length > 0) {
    try {
      text = await rebuildVoice(userId, accountId);
    } catch (error) {
      console.error(error);
    }
  }
  return {
    digest: text,
    excerpts: samples.slice(0, 2).map((item) => item.text),
  };
}
