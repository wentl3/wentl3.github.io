#!/usr/bin/env python3
"""PR 留言產生器（WO-PS5 追加）：預覽網址 + 本章宣稱清單。純標準庫。

    python3 claims.py --site DIR --evidence JSON [--only a.html --only b/c.html]
                      [--claims-registry JSON] [--preview-url URL | --preview-pr N [--preview-base https://wentl3.github.io]] [--require-preview-url] [--out comment.md]

清單內容（markdown）：
  - 每個 `N<!--R:KEY-->` / `<x data-r="KEY">N</x>`：位置、數字、KEY、等級、來源網址、擷取日
  - 每個 `<!--C:宣稱ID-->`：宣稱 ID（有 --claims-registry 時，不在登記簿的 ID 算缺項）
缺項（任一筆 -> exit 1，且缺項列在留言裡）：
  - 帶單位數字 / 表格裸數字沒綁 R:KEY（同 gate.py 的 UNBOUND-NUMBER）、KEY 不在登記簿 / 無 tier / 數字不符
  - 登記簿該 KEY 沒有 source_url 或 captured
  - 經歷句（class="exp" 或 data-exp）沒有 `<!--C:ID-->`；宣稱 ID 不在登記簿
  - 要求預覽網址卻沒有，或不是 https://<網域>/preview/<PR 號>/ 的形式（--require-preview-url）
假設（待接線）：證據紀錄欄位叫 source_url / captured；宣稱標記為 `<!--C:ID-->`；經歷句以 class="exp" 標示。
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gate  # noqa: E402

CLAIM_RE = re.compile(r'<!--C:([A-Za-z0-9._-]+)-->')
EXP_RE = re.compile(r'<(\w+)\b[^>]*(?:\bclass="[^"]*\bexp\b[^"]*"|\bdata-exp\b)[^>]*>(.*?)</\1>', re.S)
GAP_RULES = {'CLAIM-ID', 'UNBOUND-NUMBER', 'R-VALUE', 'NO-TIER', 'R-MARKER', 'INTERNAL-TIER'}
MARKER = '<!-- site-gate-report -->'
PREVIEW_RE = re.compile(r'^https://[^/\s]+/preview/\d+/$')


def cell(x):
    return str(x if x not in (None, '') else '—').replace('|', '\\|').replace('\n', ' ')


def page_section(rel, raw, ev, registry, internal):
    rows, ids, gaps = [], [], []
    for m in gate.MARK_RE.finditer(raw):
        num, key = m.group(1), m.group(2)
        rows.append((gate.line_of(raw, m.start()), num, key))
    for m in gate.DATA_R_RE.finditer(raw):
        inner = re.sub(r'<[^>]+>', '', m.group(3)).strip()
        rows.append((gate.line_of(raw, m.start()), inner, m.group(2)))
    rows.sort()
    out = [f'### `{rel}`', '']
    if rows:
        out += ['| 行 | 數字 | R:KEY | 等級 | 來源網址 | 擷取日 |', '|---|---|---|---|---|---|']
        for ln, num, key in rows:
            r = ev.get(key) or {}
            if not r.get('source_url'):
                gaps.append((rel, ln, f'{key} 登記簿沒有 source_url（無來源網址）'))
            if not r.get('captured'):
                gaps.append((rel, ln, f'{key} 登記簿沒有 captured（擷取日）'))
            out.append(f'| {ln} | {cell(num)} | `{key}` | {cell(r.get("tier"))} | {cell(r.get("source_url"))} | {cell(r.get("captured"))} |')
        out.append('')
    for m in CLAIM_RE.finditer(raw):
        ids.append((gate.line_of(raw, m.start()), m.group(1)))
        if registry is not None and m.group(1) not in registry:
            gaps.append((rel, ids[-1][0], f'宣稱 ID {m.group(1)} 不在宣稱登記簿'))
    for m in EXP_RE.finditer(raw):
        if not CLAIM_RE.search(m.group(2)):
            gaps.append((rel, gate.line_of(raw, m.start()), '經歷句沒有 <!--C:宣稱ID-->'))
    if ids:
        out += ['宣稱 ID：' + '、'.join(f'`{i}`（行 {ln}）' for ln, i in ids), '']
    if not rows and not ids:
        out += ['本頁沒有登記簿數字與宣稱。', '']
    F = []
    cfg = {'terms': [], 'evidence': ev, 'internal': internal, 'units': gate.DEFAULT_UNITS, 'internal_keys': [],
           'claims': registry}
    gate.scan_text(rel, raw, cfg, F)
    for rule, f, ln, msg in F:
        if rule in GAP_RULES:
            gaps.append((rel, ln, f'{rule}：{msg}'))
    return out, gaps


def build(site, evidence, only=None, registry_path=None, preview_url=None, require_preview=False):
    """回傳 (markdown, gaps)。"""
    ev = gate.load_evidence(evidence)
    registry = None
    if registry_path:
        registry = gate.load_claim_ids(registry_path)
    pages = only or [r for r in gate.list_files(site)
                     if r.lower().endswith(('.html', '.htm')) and not r.startswith(gate.GATE_DIRS)]
    gaps, body = [], []
    if require_preview and not (preview_url and PREVIEW_RE.match(preview_url)):
        gaps.append(('(preview)', 0, '缺預覽網址（需 https://<網域>/preview/<PR 號>/）'))
    for rel in sorted(pages):
        p = os.path.join(site, rel)
        if not os.path.isfile(p):
            gaps.append((rel, 0, '指定頁面不存在'))
            continue
        with open(p, encoding='utf-8', errors='replace') as f:
            sec, g = page_section(rel, f.read(), ev, registry, gate.DEFAULT_INTERNAL)
        body += sec
        gaps += g
    if not pages:
        body += ['本次沒有變更的 HTML 頁面。', '']
    md = [MARKER, '## 站上預覽', '', f'預覽：{preview_url}' if preview_url else '預覽：（無）', '',
          '## 本次變更頁面的宣稱清單', ''] + body
    md += [f'## 缺項（{len(gaps)}）', ''] + ([f'- `{r}:{ln}` {msg}' for r, ln, msg in gaps] or ['無。']) + ['']
    md.append('結論：' + ('FAIL' if gaps else 'PASS'))
    return '\n'.join(md) + '\n', gaps


def main(argv=None):
    ap = argparse.ArgumentParser(description='PR 留言（預覽網址 + 宣稱清單）')
    ap.add_argument('--site', required=True)
    ap.add_argument('--evidence', required=True)
    ap.add_argument('--only', action='append', help='只列這些頁面（相對 --site）；省略 = 全部 HTML')
    ap.add_argument('--claims-registry')
    ap.add_argument('--preview-url', help='完整預覽網址，必須長得像 https://<網域>/preview/<PR 號>/')
    ap.add_argument('--preview-pr', help='PR 號；與 --preview-base 組成預覽網址')
    ap.add_argument('--preview-base', default='https://wentl3.github.io')
    ap.add_argument('--require-preview-url', action='store_true')
    ap.add_argument('--out')
    a = ap.parse_args(argv)
    url = a.preview_url or (f'{a.preview_base.rstrip("/")}/preview/{a.preview_pr}/' if a.preview_pr else None)
    md, gaps = build(a.site, a.evidence, a.only, a.claims_registry, url, a.require_preview_url)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write(md)
    else:
        sys.stdout.write(md)
    print(f'CLAIMS {"FAILED" if gaps else "PASSED"} ({len(gaps)} gaps)', file=sys.stderr)
    return 1 if gaps else 0


if __name__ == '__main__':
    sys.exit(main())
