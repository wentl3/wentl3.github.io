// Tiny DOM builder: text only (textContent), never HTML strings (`02` §7, verify 3l).
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Replace a node's children; skips null／false (Element.append would print "null"). */
export function fill(node, ...children) {
  clear(node);
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

/** Only http(s) links are rendered as anchors (feeds can carry anything). */
export function isHttpUrl(u) {
  return typeof u === "string" && /^https?:\/\//i.test(u);
}

export function link(href, text) {
  return isHttpUrl(href)
    ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text })
    : el("span", { text });
}
