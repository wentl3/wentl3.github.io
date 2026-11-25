// Panel states (`07` §4): loading, empty, error+retry, offline
import { clear, el } from "./dom.js";

export function showLoading(node, what) {
  clear(node).appendChild(el("p", { class: "state loading", text: `載入${what}…` }));
}

export function showEmpty(node, hint) {
  clear(node).appendChild(el("p", { class: "state empty", text: hint }));
}

export function showError(node, err, retry) {
  const offline = err && err.kind === "offline";
  clear(node).appendChild(el("div", { class: `state ${offline ? "offline" : "error"}`, role: "alert" },
    el("span", { text: offline ? "無法連線到 Pipeline API" : `讀取失敗：${(err && err.message) || "未知錯誤"}` }),
    retry ? el("button", { type: "button", class: "chip", onclick: retry, text: "重試" }) : null));
}
