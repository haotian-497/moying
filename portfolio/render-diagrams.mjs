import sharp from "sharp";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function box(x, y, w, h, label, { round = 8, diamond = false, stadium = false } = {}) {
  const text = esc(label);
  const font = "Microsoft YaHei, PingFang SC, sans-serif";
  if (diamond) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    return `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="#fff" stroke="#171717" stroke-width="2"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="${font}" font-size="13" fill="#171717">${text}</text>`;
  }
  const rx = stadium ? h / 2 : round;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#fff" stroke="#171717" stroke-width="2"/>
  <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${font}" font-size="13" fill="#171717">${text}</text>`;
}

function arrow(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#525252" stroke-width="1.5" marker-end="url(#arrow)"/>`;
}

function label(x, y, t) {
  return `<text x="${x}" y="${y}" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="11" fill="#737373">${esc(t)}</text>`;
}

const nodes = [
  { id: "s", x: 40, y: 170, w: 110, h: 48, t: "开始创作", stadium: true },
  { id: "p", x: 200, y: 155, w: 130, h: 78, t: "人设账号齐全?", diamond: true },
  { id: "setup", x: 200, y: 40, w: 130, h: 48, t: "补全人设账号" },
  { id: "mode", x: 380, y: 155, w: 120, h: 78, t: "选题来源", diamond: true },
  { id: "hot", x: 540, y: 40, w: 140, h: 48, t: "抓取并筛选热点" },
  { id: "pick", x: 720, y: 40, w: 120, h: 48, t: "选用可蹭点" },
  { id: "topic", x: 540, y: 170, w: 120, h: 48, t: "选题材" },
  { id: "dirs", x: 700, y: 170, w: 120, h: 48, t: "生成三方向" },
  { id: "choose", x: 860, y: 170, w: 120, h: 48, t: "选定方向" },
  { id: "draft", x: 1020, y: 170, w: 110, h: 48, t: "流式成稿" },
  { id: "review", x: 1170, y: 170, w: 110, h: 48, t: "终审校对" },
  { id: "edit", x: 1320, y: 170, w: 110, h: 48, t: "编辑改写" },
  { id: "out", x: 1470, y: 155, w: 110, h: 78, t: "发布准备", diamond: true },
  { id: "var", x: 1470, y: 40, w: 120, h: 48, t: "多平台版本" },
  { id: "cue", x: 1470, y: 300, w: 120, h: 48, t: "口播提示" },
  { id: "end", x: 1630, y: 170, w: 110, h: 48, t: "人工发布", stadium: true },
];
const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
const mid = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
const right = (n) => ({ x: n.x + n.w, y: n.y + n.h / 2 });
const left = (n) => ({ x: n.x, y: n.y + n.h / 2 });
const top = (n) => ({ x: n.x + n.w / 2, y: n.y });
const bot = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h });

const fw = 1780;
const fh = 420;
const flowParts = [];
flowParts.push(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#525252"/></marker></defs>`);
flowParts.push(`<rect width="${fw}" height="${fh}" fill="#FAFAFA"/>`);
flowParts.push(`<text x="40" y="28" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="18" font-weight="700" fill="#171717">墨引 · 执行流程图</text>`);

flowParts.push(arrow(right(by.s).x, right(by.s).y, left(by.p).x, left(by.p).y));
flowParts.push(arrow(mid(by.p).x, top(by.p).y, bot(by.setup).x, bot(by.setup).y));
flowParts.push(label(250, 120, "否"));
flowParts.push(`<path d="M${left(by.setup).x} ${mid(by.setup).y} L160 ${mid(by.setup).y} L160 ${mid(by.p).y} L${left(by.p).x} ${mid(by.p).y}" fill="none" stroke="#525252" stroke-width="1.5" marker-end="url(#arrow)"/>`);
flowParts.push(arrow(right(by.p).x, mid(by.p).y, left(by.mode).x, mid(by.mode).y));
flowParts.push(label(350, 145, "是"));
flowParts.push(arrow(mid(by.mode).x, top(by.mode).y, bot(by.hot).x, bot(by.hot).y));
flowParts.push(label(440, 120, "热点"));
flowParts.push(arrow(right(by.hot).x, mid(by.hot).y, left(by.pick).x, mid(by.pick).y));
flowParts.push(`<path d="M${bot(by.pick).x} ${bot(by.pick).y} L${bot(by.pick).x} 140 L${mid(by.topic).x} 140 L${mid(by.topic).x} ${top(by.topic).y}" fill="none" stroke="#525252" stroke-width="1.5" marker-end="url(#arrow)"/>`);
flowParts.push(arrow(right(by.mode).x, mid(by.mode).y, left(by.topic).x, mid(by.topic).y));
flowParts.push(label(490, 160, "手输"));
const chain = ["topic", "dirs", "choose", "draft", "review", "edit", "out"];
for (let i = 0; i < chain.length - 1; i += 1) {
  const A = by[chain[i]];
  const B = by[chain[i + 1]];
  flowParts.push(arrow(right(A).x, mid(A).y, left(B).x, mid(B).y));
}
flowParts.push(arrow(mid(by.out).x, top(by.out).y, bot(by.var).x, bot(by.var).y));
flowParts.push(label(1525, 120, "多平台"));
flowParts.push(arrow(mid(by.out).x, bot(by.out).y, top(by.cue).x, top(by.cue).y));
flowParts.push(label(1525, 280, "口播"));
flowParts.push(`<path d="M${right(by.var).x} ${mid(by.var).y} L1610 ${mid(by.var).y} L1610 ${mid(by.end).y} L${left(by.end).x} ${mid(by.end).y}" fill="none" stroke="#525252" stroke-width="1.5" marker-end="url(#arrow)"/>`);
flowParts.push(`<path d="M${right(by.cue).x} ${mid(by.cue).y} L1610 ${mid(by.cue).y} L1610 ${mid(by.end).y}" fill="none" stroke="#525252" stroke-width="1.5"/>`);
flowParts.push(arrow(right(by.out).x, mid(by.out).y, left(by.end).x, mid(by.end).y));
flowParts.push(label(1585, 158, "复制"));

for (const n of nodes) {
  flowParts.push(box(n.x, n.y, n.w, n.h, n.t, { diamond: n.diamond, stadium: n.stadium }));
}

const flowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="${fh}" viewBox="0 0 ${fw} ${fh}">${flowParts.join("\n")}</svg>`;
writeFileSync(path.join(dir, "moyin-flow.svg"), flowSvg);
await sharp(Buffer.from(flowSvg)).png().toFile(path.join(dir, "moyin-flow.png"));

const mw = 1400;
const mh = 720;
const groups = [
  { title: "身份与资产", items: ["个人人设", "账号设定", "栏目 / 语气 / 选题池 / 稿库"] },
  { title: "创作流水线", items: ["选题材", "三个方向", "流式成稿", "局部改写"] },
  { title: "热点借势", items: ["六源热榜", "按账号匹配", "推荐题材"] },
  { title: "成稿后处理", items: ["终审校对", "多平台版本", "口播提示"] },
  { title: "平台与质量", items: ["登录与游客", "Admin / Eval", "模型与降级"] },
];
const gw = 240;
const gap = 28;
const startX = 40;
const mod = [];
mod.push(`<rect width="${mw}" height="${mh}" fill="#FAFAFA"/>`);
mod.push(`<text x="40" y="36" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="18" font-weight="700" fill="#171717">墨引 · 功能模块图</text>`);
mod.push(box(mw / 2 - 150, 60, 300, 56, "墨引 · AI自媒体文案工作台", { round: 10 }));
const gy = 200;
groups.forEach((g, i) => {
  const x = startX + i * (gw + gap);
  mod.push(`<line x1="${mw / 2}" y1="116" x2="${x + gw / 2}" y2="${gy}" stroke="#525252" stroke-width="1.5"/>`);
  mod.push(box(x, gy, gw, 52, g.title, { round: 10 }));
  g.items.forEach((item, j) => {
    const iy = gy + 90 + j * 70;
    mod.push(`<line x1="${x + gw / 2}" y1="${gy + 52}" x2="${x + gw / 2}" y2="${iy}" stroke="#A3A3A3" stroke-width="1.25"/>`);
    mod.push(box(x + 10, iy, gw - 20, 48, item, { round: 8 }));
  });
});
const modSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}" viewBox="0 0 ${mw} ${mh}">${mod.join("\n")}</svg>`;
writeFileSync(path.join(dir, "moyin-modules.svg"), modSvg);
await sharp(Buffer.from(modSvg)).png().toFile(path.join(dir, "moyin-modules.png"));
console.log("PNG ready");
