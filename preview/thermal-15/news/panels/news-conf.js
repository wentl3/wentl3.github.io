// N-07 展會 (`07` D-037): API conferences 每場一塊；沒有重疊的展會 → 整塊不顯示（節點留字樣但 cell 隱藏）
import { fill, el } from "../../lib/dom.js";
import { showError, showLoading } from "../../lib/states.js";
import { CONF_CAP, arr, text } from "../common.js";
import { listBlock } from "./news-channels.js";

const hide = (node, v) => { node.hidden = v; if (node.parentNode) node.parentNode.hidden = v; };

export function renderConf(node, { data, loading, error, retry, expanded, onExpand }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  hide(node, false);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "展會");
  const confs = arr(data.conferences);
  if (!confs.length) {
    box.append(el("p", { class: "state empty", text: "時間窗內沒有展會" }));
    return hide(node, true);
  }
  box.append(...confs.map((c) => {
    const items = arr(c.items), n = Number.isFinite(c.count) ? c.count : items.length, key = `conf:${text(c.id)}`;
    return el("section", { class: "vgroup", "data-conf": text(c.id) },
      el("h3", { text: `${text(c.name) || text(c.id)}｜${text(c.start).slice(0, 10)}～${text(c.end).slice(5, 10)}｜${text(c.place) || "地點未註明"}｜${n} 則` }),
      n === 0 ? el("p", { class: "state empty", text: "時間窗內沒有命中此展會的標題" })
        : el("div", {}, ...listBlock({ items, n, key, open: expanded.has(key), cap: CONF_CAP, labels: new Map(), onExpand, label: `看全部（${n}）` })));
  }));
}
