import { Banner } from "@/components/ui";
import type { LlmStatus } from "@/lib/types";

export function LlmNote({ llm }: { llm: LlmStatus }) {
  if (llm.mode === "live") {
    return <Banner tone="ok">已连接模型 {llm.model}。方向和成稿都会调用这个接口。</Banner>;
  }
  if (llm.mode === "mock") {
    return (
      <Banner tone="warn">
        现在是演示模式，三个方向和成稿是本地示例，不会调用模型。在 .env.local 填写 LLM_API_KEY，把 LLM_MOCK 设为 0，重启后改为真实生成。
      </Banner>
    );
  }
  return (
    <Banner tone="bad">
      还没有配置模型。在项目根目录的 .env.local 填写 LLM_API_KEY 后重启。想先看流程，可以把 LLM_MOCK 设为 1。
    </Banner>
  );
}
