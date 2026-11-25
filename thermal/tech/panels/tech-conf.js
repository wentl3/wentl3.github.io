// H-06 協會動態 (`07` D-030／D-033): 選了展會＝展會名・日期・地點＋API headlines；未選＝OCP 演講（API talks，不套時間窗）。無資料時整塊不在 DOM
import { fill, el, link } from "../../lib/dom.js";
import { shortDate } from "../../lib/format.js";
import { showError, showLoading } from "../../lib/states.js";

export function renderConf(host, { data, conf, loading, error, retry }) {
  const tk = data && data.talks;
  if (!conf && !tk) {
    if (host.confSec) host.removeChild(host.confSec);
    host.confSec = null;
    return;
  }
  if (!host.confSec) host.append(host.confSec = el("section", { class: "cell", id: "tech-conf-cell" }, el("h2", { text: "協會動態" }), el("div", { "data-panel": "tech-conf" })));
  const box = el("div", { class: "list" }), c = data && data.conference, pane = host.confSec.children[1];
  pane.id = conf ? "tech-conf" : "tech-talks"; // smoke.js tells the two views apart by id
  fill(pane, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "協會動態");
  if (!conf) {
    box.append(el("p", { class: "note", text: `OCP 演講（共 ${tk.total} 場）` }));
    const mt = (data.meetings && data.meetings.items) || [];
    box.append(...(tk.items.length ? tk.items.map((t) => el("article", { class: "item talk", "data-extracted": String(!!t.headline_zh) },
      el("div", { class: "ttl", text: t.headline_zh || t.title }),
      el("div", { class: "meta" }, el("span", { class: "mono", text: shortDate(t.date) }), el("span", { text: [t.event, t.track].filter(Boolean).join("／") }),
        t.headline_zh ? null : el("span", { class: "tag muted", text: "未抽取" }),
        t.video_url ? link(t.video_url, "影片") : null, t.slides_url ? link(t.slides_url, "簡報") : null))) : [el("p", { class: "state empty", text: "還沒有收錄的演講" })]));
    if (mt.length) box.append(el("p", { class: "note", text: "近期小組會議" }), ...mt.map((m) => el("div", { class: "meta mtg" },
      el("span", { class: "mono", text: shortDate(m.date) }), el("span", { text: m.subproject }), link(m.url, m.title))));
    const dc = (data.docs && data.docs.items) || [];
    if (dc.length) box.append(el("p", { class: "note", text: "新文件" }), ...dc.map((d) => el("div", { class: "meta mtg" },
      el("span", { class: "mono", text: shortDate(d.date) }), el("span", { text: d.subproject }), link(d.url, d.headline_zh || d.title),
      d.headline_zh ? null : el("span", { class: "tag muted", text: "未抽取" }))));
    return;
  }
  const hs = data.headlines || [];
  box.append(el("p", { class: "note", text: c ? `${c.name}・${c.start}～${c.end}・${c.place}` : conf }));
  if (!hs.length) return box.append(el("p", { class: "state empty", text: "展會期間沒有命中的報導" }));
  box.append(...hs.map((h) => el("article", { class: "item hl", "data-extracted": String(!!h.extracted) },
    el("div", { class: "ttl" }, link(h.url, h.headline_zh || h.title || h.url)),
    el("div", { class: "meta" }, el("span", { class: "mono", text: shortDate(h.date) }), el("span", { text: h.domain || "—" }),
      h.extracted ? null : el("span", { class: "tag muted", text: "未抽取" })))));
}
