import type { ReactNode } from "react";

type Block = {
  kind: "h" | "p" | "li" | "quote" | "hr";
  level: number;
  ordered: boolean;
  text: string;
  at: number;
};

function blocksOf(text: string): Block[] {
  const lines = text.split("\n");
  let offset = 0;
  const blocks: Block[] = [];
  for (const line of lines) {
    const start = offset;
    offset += line.length + 1;
    const trimmed = line.trimEnd();
    if (!trimmed.trim()) continue;
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const title = heading[2];
      blocks.push({ kind: "h", level: heading[1].length, ordered: false, text: title, at: start + trimmed.indexOf(title) });
      continue;
    }
    const numbered = trimmed.match(/^([一二三四五六七八九十]+、)\s*(.{1,24})$/);
    if (numbered && trimmed.length <= 28) {
      blocks.push({ kind: "h", level: 2, ordered: false, text: trimmed.trim(), at: start + line.indexOf(trimmed.trim()) });
      continue;
    }
    if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
      blocks.push({ kind: "hr", level: 0, ordered: false, text: "", at: start });
      continue;
    }
    const bullet = trimmed.match(/^\s*(?:[-*+]|·)\s+(.*)$/);
    if (bullet) {
      const item = bullet[1];
      blocks.push({ kind: "li", level: 0, ordered: false, text: item, at: start + trimmed.indexOf(item) });
      continue;
    }
    const ordered = trimmed.match(/^\s*\d+[.、)]\s+(.*)$/);
    if (ordered) {
      const item = ordered[1];
      blocks.push({ kind: "li", level: 0, ordered: true, text: item, at: start + trimmed.indexOf(item) });
      continue;
    }
    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      const item = quote[1];
      blocks.push({ kind: "quote", level: 0, ordered: false, text: item, at: start + trimmed.indexOf(item) });
      continue;
    }
    const plain = trimmed.trim();
    blocks.push({ kind: "p", level: 0, ordered: false, text: plain, at: start + line.indexOf(plain) });
  }
  return blocks;
}

function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-paper-deep px-1 text-[13px]">{part.slice(1, -1)}</code>;
    return <span key={index}>{part}</span>;
  });
}

function Marked({
  text,
  at,
  quoteStart,
  quoteEnd,
  markId,
}: {
  text: string;
  at: number;
  quoteStart: number;
  quoteEnd: number;
  markId?: string;
}) {
  if (quoteStart < 0) return <>{inline(text)}</>;
  const start = Math.max(0, quoteStart - at);
  const end = Math.min(text.length, quoteEnd - at);
  if (end <= start) return <>{inline(text)}</>;
  return (
    <>
      {inline(text.slice(0, start))}
      <mark id={markId} className="scroll-mt-28 rounded bg-cinnabar-soft px-0.5 text-inherit">
        {text.slice(start, end)}
      </mark>
      {inline(text.slice(end))}
    </>
  );
}

export function ArticleBody({ text, quote = "", markId }: { text: string; quote?: string; markId?: string }) {
  const blocks = blocksOf(text);
  const quoteStart = quote ? text.indexOf(quote) : -1;
  const quoteEnd = quoteStart >= 0 ? quoteStart + quote.length : -1;
  let marked = false;
  const nodes: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.kind === "li") {
      const ordered = block.ordered;
      const items = [block];
      while (index + 1 < blocks.length && blocks[index + 1].kind === "li" && blocks[index + 1].ordered === ordered) {
        index += 1;
        items.push(blocks[index]);
      }
      const List = ordered ? "ol" : "ul";
      nodes.push(
        <List key={`list-${block.at}`} className={`mb-3.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item) => {
            const hit = !marked && quoteEnd > item.at && quoteStart < item.at + item.text.length;
            if (hit) marked = true;
            return (
              <li key={item.at} className="mb-1">
                <Marked text={item.text} at={item.at} quoteStart={quoteStart} quoteEnd={quoteEnd} markId={hit ? markId : undefined} />
              </li>
            );
          })}
        </List>,
      );
      continue;
    }
    const hit = !marked && block.kind !== "hr" && quoteEnd > block.at && quoteStart < block.at + block.text.length;
    if (hit) marked = true;
    const id = hit ? markId : undefined;
    if (block.kind === "hr") {
      nodes.push(<hr key={block.at} className="my-5 border-0 border-t border-line" />);
      continue;
    }
    if (block.kind === "h") {
      const Tag = block.level <= 2 ? "h2" : "h3";
      nodes.push(
        <Tag key={block.at} className={block.level <= 2 ? "mt-6 mb-2.5 text-[16.5px] font-semibold leading-snug" : "mt-5 mb-2 text-[15px] font-semibold leading-snug"}>
          <Marked text={block.text} at={block.at} quoteStart={quoteStart} quoteEnd={quoteEnd} markId={id} />
        </Tag>,
      );
      continue;
    }
    if (block.kind === "quote") {
      nodes.push(
        <blockquote key={block.at} className="mb-3.5 border-l-[3px] border-blue bg-paper-deep px-3.5 py-2 text-muted">
          <Marked text={block.text} at={block.at} quoteStart={quoteStart} quoteEnd={quoteEnd} markId={id} />
        </blockquote>,
      );
      continue;
    }
    nodes.push(
      <p key={block.at} className="mb-3.5">
        <Marked text={block.text} at={block.at} quoteStart={quoteStart} quoteEnd={quoteEnd} markId={id} />
      </p>,
    );
  }
  if (quoteStart >= 0 && !marked) {
    nodes.push(<mark key="pin" id={markId} className="sr-only">{quote}</mark>);
  }
  return <div className="mt-4 text-[15.5px] leading-[1.85] break-words">{nodes}</div>;
}
