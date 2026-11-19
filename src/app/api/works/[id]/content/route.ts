import { getCurrentUser } from "@/lib/current-user";
import { peekJsonFirstTitle, peekJsonString } from "@/lib/stream-json";
import { parseId, validateDirectionIndex } from "@/lib/validators";
import { streamWriteContent } from "@/lib/works";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function sseEncode(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "找不到这篇稿" }, { status: 404 });
  const id = parseId((await context.params).id);
  if (!id) return Response.json({ error: "找不到这篇稿" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请选择一个方向" }, { status: 400 });
  }
  const parsed = validateDirectionIndex(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };
      let raw = "";
      try {
        send("start", { index: parsed.index });
        const work = await streamWriteContent(
          user.id,
          id,
          parsed.index,
          (text) => {
            raw += text;
            send("delta", {
              text,
              body: peekJsonString(raw, "body"),
              title: peekJsonFirstTitle(raw),
              coverText: peekJsonString(raw, "coverText"),
            });
          },
          (generated) => {
            send("reviewing", { work: generated });
          },
        );
        if (!work) {
          send("error", { message: "找不到这篇稿" });
          return;
        }
        if (work.error && !work.content) {
          send("error", { message: work.error });
          return;
        }
        send("done", { work });
      } catch (error) {
        console.error(error);
        send("error", { message: error instanceof Error && error.message ? error.message : "生成失败" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
