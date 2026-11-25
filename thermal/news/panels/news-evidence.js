// N-09 證據層部署、單櫃 kW、TDP、熱回收補貼表 (`07` D-037): AI 抽取・附原文引文；固定近 365 天（部署）／全期（kW）
import { fill, el, link } from "../../lib/dom.js";
import { countryZh } from "../../lib/format.js";
import { showError, showLoading } from "../../lib/states.js";
import { EVIDENCE_FILTERS, arr, text } from "../common.js";

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
const num = (v) => (Number.isFinite(v) ? v : null);
const table = (heads, rows) => el("div", { class: "tbl-wrap" }, el("table", {},
  el("thead", {}, el("tr", {}, ...heads.map((h) => el("th", { text: h })))), el("tbody", {}, ...rows)));
const quote = (q) => el("td", { class: "small", text: text(q) ? `「${text(q)}」` : "—" });
const day = (d) => el("td", { class: "mono", text: text(d).slice(0, 10) || "日期不明" });
const cool = (r) => arr(r.cooling_types).join("、");

export function renderEvidence(node, { data, loading, error, retry, tab, filter, onTab, onFilter }) {
  const box = el("div", { class: "list" });
  fill(node, box);
  if (error) return showError(box, error, retry);
  if (loading || !data) return showLoading(box, "證據層表");
  const ev = data.evidence_tables && typeof data.evidence_tables === "object" ? data.evidence_tables : {};
  const dep = arr(ev.deployments), kw = arr(ev.rack_kw), tdp = arr(ev.tdp), sub = arr(ev.heat_subsidy), isKw = tab === "kw";
  const isTdp = tab === "tdp", isSub = tab === "subsidy", other = isKw || isTdp || isSub;
  const f = EVIDENCE_FILTERS.some(([v]) => v === filter) ? filter : "";
  const depShown = dep.filter((r) => (f === "neocloud" ? /neocloud/i.test(text(r.operator_type)) : f === "mdc" ? r.mdc === true : true));
  const seg = (items, cur, pick, name) => el("div", { class: "seg", role: "group", "aria-label": name },
    ...items.map(([v, zh]) => el("button", { type: "button", "aria-pressed": String(v === cur), "data-value": v, onclick: () => pick(v), text: zh })));
  box.append(el("div", { class: "ctl" }, el("span", { class: "ctl-label", text: "證據層表" }),
    seg([["deploy", "部署"], ["kw", "單櫃 kW"], ["tdp", "TDP"], ["subsidy", "熱回收補貼"]], other ? tab : "deploy", onTab, "分頁"),
    other ? null : seg(EVIDENCE_FILTERS, f, onFilter, "部署篩選")),
  el("p", { class: "note", text: `AI 抽取・附原文引文・${other ? "不限時間" : "固定近 365 天"}（不跟時間窗）` }));
  const lnk = (r) => el("td", {}, link(r.url, text(r.title) || "原文"));
  const unk = (v) => el("td", { text: text(v) || "未註明" });
  if (isTdp) {
    box.append(tdp.length ? table(["日期", "業者", "機型", "平台", "TDP W", "來源", "原文引文", "連結"], tdp.map((r) => el("tr", { class: "trow-tdp" }, day(r.date),
      el("td", { text: dash(r.vendor) }), el("td", { text: dash(r.model) }), unk(r.platform), el("td", { class: "mono", text: dash(num(r.tdp_w)) }),
      el("td", { text: r.source_kind === "vendor" ? "原廠公布" : "報導引述" }), quote(r.quote), lnk(r))))
      : el("p", { class: "state empty", text: "證據層尚無 TDP（t-0.3 抽取）" }));
    return;
  }
  if (isSub) {
    box.append(sub.length ? table(["日期", "國家", "補貼", "主體", "狀態", "原文引文", "連結"], sub.map((r) => el("tr", { class: "trow-sub" }, day(r.date),
      el("td", { text: dash(arr(r.countries).map((c) => countryZh(c) || c).join("、")) }),
      el("td", { class: "mono", text: dash([num(r.value), text(r.unit)].filter((x) => x !== null && x !== "").join(" ")) }),
      unk(r.entity), el("td", { text: dash(r.status) }), quote(r.quote), lnk(r))))
      : el("p", { class: "state empty", text: "證據層尚無熱回收補貼金額（e-0.5 抽取）" }));
    return;
  }
  if (isKw) {
    box.append(kw.length ? table(["日期", "平台", "kW", "原文引文", "連結"], kw.map((r) => el("tr", { class: "krow" }, day(r.date),
      el("td", { text: text(r.platform) || "未註明" }), el("td", { class: "mono", text: dash(num(r.kw)) }), quote(r.quote), el("td", {}, link(r.url, text(r.title) || "原文")))))
      : el("p", { class: "state empty", text: "證據層沒有單櫃 kW 數字" }));
    return;
  }
  box.append(!dep.length ? el("p", { class: "state empty", text: "近 365 天證據層沒有帶容量的部署" })
    : !depShown.length ? el("p", { class: "state empty", text: `近 365 天證據層沒有符合「${(EVIDENCE_FILTERS.find(([v]) => v === f) || [])[1]}」的部署` })
      : table(["日期", "國家／城市", "業者", "容量 MW", "散熱方式", "業者類型", "原文引文", "連結"], depShown.map((r) => el("tr", { class: "drow" }, day(r.date),
        el("td", { text: dash([arr(r.countries).map((c) => countryZh(c) || c).join("、"), text(r.site)].filter(Boolean).join("／")) }),
        el("td", { text: dash(r.entity) }), el("td", { class: "mono", text: dash(num(r.capacity_mw)) }), el("td", { text: dash(cool(r)) }),
        el("td", { text: dash(r.operator_type) }), quote(r.quote), el("td", {}, link(r.url, text(r.title) || "原文"))))));
}
