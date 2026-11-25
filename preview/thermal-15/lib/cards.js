// Shared item card; AI extractions carry quotes; tags are buttons when `onPick` is given (`07` §1)
import { el, link } from "./dom.js";
import { CONSTRAINT_ZH, DOC_ZH, FORM_ZH, SCENARIO_ZH, countryZh, dateParts } from "./format.js";

function tag(cls, text, patch, onPick) {
  return onPick
    ? el("button", { type: "button", class: `tag pick ${cls}`, title: "點選：全頁篩選", onclick: () => onPick(patch), text })
    : el("span", { class: `tag ${cls}`, text });
}

export function dateChip(iso, dateSource) {
  const d = dateParts(iso, dateSource);
  return el("span", { class: "mono", "data-date-source": dateSource || "unknown" },
    d.approx ? el("span", { class: "muted", title: "日期來自來源 feed，非原頁宣告", text: "約" }) : null, d.text);
}

export function ageText(iso, now = Date.now()) {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN;
  const years = Math.floor((now - t) / (365 * 86400000));
  return Number.isFinite(t) && years >= 1 ? `${years} 年前` : null;
}

const ageTag = (iso) => (ageText(iso) ? el("span", { class: "tag muted age", text: ageText(iso) }) : null);

export function itemCard(it, { compact = false, onPick = null } = {}) {
  const ex = it.extraction || {};
  const countries = (ex.countries || []).filter((c) => c !== "ZZ");
  const quotes = [...(ex.specs || []).map((s) => s.quote), ...(ex.scenarios || []).map((s) => s.quote),
    ...(ex.constraints || []).map((c) => c.quote), ex.deployment_form_quote].filter(Boolean);
  const meta = el("div", { class: "meta" },
    dateChip(it.published_at, it.date_source),
    ageTag(it.published_at),
    el("span", { text: it.source?.domain || "" }),
    ex.doc_type ? el("span", { class: "tag", text: DOC_ZH[ex.doc_type] || ex.doc_type }) : null,
    ...countries.map((c) => (c === "EU" ? el("span", { class: "tag geo", text: "歐盟層級（近似）" })
      : tag("geo", countryZh(c), { country: c, hub: "" }, onPick))),
    ...(ex.scenarios || []).map((s) => tag("scen", SCENARIO_ZH[s.scenario] || s.scenario, { scenario: s.scenario }, onPick)),
    ...(ex.vendors || []).map((v) => tag("vend", v, { vendor: v }, onPick)),
    ...(ex.constraints || []).map((c) => el("span", { class: "tag warn", text: CONSTRAINT_ZH[c.type] || c.type })),
    ex.deployment_form ? el("span", { class: "tag tech", text: FORM_ZH[ex.deployment_form] || ex.deployment_form }) : null,
    ...(ex.cooling_types || []).map((t) => el("span", { class: "tag tech", text: t })),
    it.unverified ? el("span", { class: "tag warn", text: "未驗證" }) : el("span", { class: "tag ok", text: "AI 抽取・附原文引文" }));
  const card = el("article", { class: "item" },
    el("h3", {}, link(it.source?.url, it.title)),
    meta,
    !compact && ex.summary_zh ? el("p", { text: ex.summary_zh }) : null);
  if (!compact && quotes.length) {
    card.append(el("details", {}, el("summary", { text: `原文引文 ${quotes.length} 則` }),
      el("ul", { class: "quotes" }, ...quotes.map((q) => el("li", {}, el("q", { text: q }))))));
  }
  return card;
}

export function headlineRow(h) {
  return el("article", { class: "item" },
    el("h3", {}, link(h.url, h.title)),
    el("div", { class: "meta" },
      dateChip(h.published_at, h.date_source),
      el("span", { text: h.domain }),
      h.extracted ? el("span", { class: "tag ok", text: "已抽取" }) : el("span", { class: "tag muted", text: "未抽取" })));
}

export function capped(rows, n, expanded, onToggle, render) {
  const shown = expanded ? rows : rows.slice(0, n);
  const out = [el("div", { class: "list" }, ...shown.map(render))];
  if (rows.length > n) {
    out.push(el("button", { type: "button", class: "chip more", onclick: onToggle,
      text: expanded ? "收合" : `看全部（${rows.length}）` }));
  }
  return out;
}

export function appendUntagged(list, u, build) {
  if (!u || !u.n) return;
  const rows = u.open && u.data ? build(u.data) : [];
  list.append(el("div", { class: "untagged" },
    el("button", { type: "button", class: "chip more", "data-untagged": "1", onclick: u.toggle, text: u.open ? "收合未標場景" : `另有 ${u.n} 筆未標場景（展開）` }),
    u.open && !u.data ? el("p", { class: "state loading", text: "載入未標場景…" }) : null,
    ...rows.map((c) => el("div", {}, el("span", { class: "tag warn", text: "未標場景" }), c))));
}
