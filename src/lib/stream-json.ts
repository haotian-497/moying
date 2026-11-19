function readJsonStringAt(text: string, start: number) {
  if (text[start] !== '"') return { value: "", end: start, done: false };
  let index = start + 1;
  let out = "";
  while (index < text.length) {
    const ch = text[index];
    if (ch === '"') return { value: out, end: index + 1, done: true };
    if (ch === "\\") {
      if (index + 1 >= text.length) return { value: out, end: index, done: false };
      const next = text[index + 1];
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "r") out += "\r";
      else if (next === '"' || next === "\\" || next === "/") out += next;
      else if (next === "u" && index + 5 < text.length && /^[0-9a-fA-F]{4}$/.test(text.slice(index + 2, index + 6))) {
        out += String.fromCharCode(Number.parseInt(text.slice(index + 2, index + 6), 16));
        index += 6;
        continue;
      } else out += next;
      index += 2;
      continue;
    }
    out += ch;
    index += 1;
  }
  return { value: out, end: index, done: false };
}

function skipSpace(text: string, index: number) {
  while (index < text.length && /\s/.test(text[index] || "")) index += 1;
  return index;
}

/** 从尚未写完的 JSON 文本里，尽量读出某个字符串字段的当前内容。 */
export function peekJsonString(text: string, key: string) {
  const marker = `"${key}"`;
  const found = text.indexOf(marker);
  if (found < 0) return "";
  let index = skipSpace(text, found + marker.length);
  if (text[index] !== ":") return "";
  index = skipSpace(text, index + 1);
  return readJsonStringAt(text, index).value;
}

/** 从尚未写完的 JSON 里，读 titles 数组的第一项。 */
export function peekJsonFirstTitle(text: string) {
  const marker = `"titles"`;
  const found = text.indexOf(marker);
  if (found < 0) return "";
  let index = skipSpace(text, found + marker.length);
  if (text[index] !== ":") return "";
  index = skipSpace(text, index + 1);
  if (text[index] !== "[") return "";
  index = skipSpace(text, index + 1);
  return readJsonStringAt(text, index).value;
}
