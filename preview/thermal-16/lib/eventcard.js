// Event card (`07` P-03／E-03); missing enrichment → original title
import { el, link } from "./dom.js";
import { ageText, dateChip } from "./cards.js";
import { CONSTRAINT_ZH, SCENARIO_ZH, countryZh, eventDateText, shortDate } from "./format.js";

export const STATUS_ZH = { proposed: "審議中", consultation: "徵詢中", passed: "已通過", signed: "已簽署", in_force: "已生效",
  rejected: "遭否決", announced: "已宣布", under_construction: "興建中", operational: "已啟用" };
export const GROUP_ZH = { reg: "法規標準", deploy: "部署案例", product: "產品", other: "其他" };
export const SIGNAL_ZH = { rumour: "風聲", confirmed: "確認" }; // K1 (H-012): never dropped
export const GEO_ZH = { site: "廠址", hub: "樞紐", country: "國家中心（近似）" };

const s = (v) => (v === null || v === undefined ? "" : String(v));

function tag(cls, text, patch, onPick) {
  return onPick
    ? el("button", { type: "button", class: `tag pick ${cls}`, title: "點選：全頁篩選", onclick: () => onPick(patch), text })
    : el("span", { class: `tag ${cls}`, text });
}

export function factText(f) {
  return `${s(f.value)}${f.unit ? ` ${f.unit}` : ""}`;
}

function fact(f) { // value first, English label muted
  return el("span", { class: "fact-num" }, el("b", { text: factText(f) }), el("span", { class: "muted", text: ` ${s(f.label).replace(/_/g, " ")}` }));
}

export function geoText(ev) {
  return ev.geo_precision === "country" || !ev.city ? `位置：${GEO_ZH.country}` : `${GEO_ZH[ev.geo_precision] || "位置"}：${ev.city}`;
}

export function eventCard(ev, { compact = false, onPick = null } = {}) {
  const sources = ev.sources || [];
  const head = sources[0] || {};
  const country = ev.country && !["XX", "ZZ"].includes(ev.country) ? ev.country : "";
  const headline = s(ev.headline) || s(head.title) || "（無標題）";
  const span = eventDateText(sources);
  const meta = el("div", { class: "meta" },
    span ? el("span", { class: "mono", text: span }) : dateChip(head.published_at, head.date_source),  // D-019
    ageText(head.published_at) ? el("span", { class: "tag muted age", text: ageText(head.published_at) }) : null,
    STATUS_ZH[ev.status] ? el("span", { class: "tag stamp", "data-status": ev.status, text: STATUS_ZH[ev.status] }) : null,
    SIGNAL_ZH[ev.signal] ? el("span", { class: `tag sig ${ev.signal}`, "data-signal": ev.signal, text: SIGNAL_ZH[ev.signal] }) : null,
    ev.effective_date ? el("span", { class: "tag ok", text: `生效 ${ev.effective_date}` }) : null,
    el("span", { class: "tag", text: GROUP_ZH[ev.doc_group] || GROUP_ZH.other }),
    country === "EU" ? el("span", { class: "tag geo", text: "歐盟層級（近似）" })
      : country ? tag("geo", countryZh(country), { country, hub: "" }, onPick) : null,
    ...(ev.scenarios || []).map((x) => tag("scen", SCENARIO_ZH[x] || x, { scenario: x }, onPick)),
    ...(ev.vendors || []).map((v) => tag("vend", v, { vendor: v }, onPick)),
    ...(ev.constraints || []).map((c) => el("span", { class: "tag warn", text: CONSTRAINT_ZH[c] || c })),
    el("span", { class: "tag geo", "data-geo": ev.geo_precision || "country", text: geoText(ev) }));
  const facts = (ev.key_facts || []).slice(0, compact ? 3 : 6);
  const card = el("article", { class: "item event", "data-event": s(ev.id) },
    el("h3", { "data-zh": String(!!ev.headline_is_zh) }, link(head.url, headline)),
    meta,
    !compact && ev.summary_zh ? el("p", { text: ev.summary_zh }) : null,
    facts.length ? el("div", { class: "facts" }, ...facts.map(fact)) : null);
  if ((ev.conflict || []).length) {
    card.append(el("div", { class: "conflict" }, el("span", { class: "tag warn", text: "有矛盾" }),
      ...ev.conflict.map((c) => el("span", { class: "small", text: `${s(c.label).replace(/_/g, " ")}：${(c.claims || [])
        .map((x) => `${s(x.value)}${x.unit ? ` ${x.unit}` : ""}（${(sources.find((y) => y.item_id === x.item_id) || {}).domain || "來源"}）`).join(" ／ ")}` }))));
  }
  card.append(el("details", {}, el("summary", { text: `來源 ${sources.length} 個` }),
    el("ul", { class: "quotes" }, ...sources.map((x) => el("li", {},
      el("span", { class: "mono", text: `${shortDate(x.published_at)} ${s(x.domain)} ` }), link(x.url, s(x.title) || s(x.domain)),
      ...(x.quotes || []).slice(0, 3).map((q) => el("div", {}, el("q", { text: q }))))))));
  return card;
}
