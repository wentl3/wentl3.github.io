// P-05 來源與授權頁腳 (`07` §2)
import { fill, el, link } from "../lib/dom.js";

const LIBS = [
  ["d3-geo 3.1.1", "ISC", "vendor/LICENSE-d3-geo"],
  ["d3-array 3.2.4", "ISC", "vendor/LICENSE-d3-array"],
  ["topojson-client 3.1.0", "ISC", "vendor/LICENSE-topojson-client"],
  ["world-atlas countries-110m（Natural Earth 資料）", "ISC／公有領域", "vendor/LICENSE-world-atlas"],
  ["i18n-iso-countries 國碼表", "MIT", "vendor/LICENSE-iso-codes"],
];

export function renderFooter(node, { meta, datasets }) {
  fill(node, 
    el("div", {}, el("strong", { text: "來源與授權" }),
      el("span", { class: "mono muted", text: meta ? ` · Pipeline API ${meta.version} · ${String(meta.code_commit || "").slice(0, 7)}` : " · 無法連線到 Pipeline API" })),
    el("p", { class: "muted", text: "每則情報為 AI 抽取並附原文逐字引文與連結；只顯示摘要、短引文、原始標題與原文連結，不轉載全文。未抽取標題只附原文連結。查不到的寫「未取得＋原因」。" }),
    el("ul", { class: "licenses" },
      ...(datasets || []).map((d) => el("li", {}, link(d.source_url, d.dataset), el("span", { text: ` · ${d.license} · ${d.as_of}` }))),
      ...LIBS.map(([n, lic, file]) => el("li", {}, el("a", { href: file, target: "_blank", text: n }), el("span", { text: ` · ${lic}` })))));
}
