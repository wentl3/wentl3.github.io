#!/usr/bin/env python3
"""公開閘門 v0（WO-PS5；台帳 B12 / REQ-SITE-006）。純標準庫，不呼叫任何模型。

同一支腳本兩處跑：
  1. CoW 匯出時（ops/publish/export.py 對暫存目錄呼叫，terms 檔在本機私有路徑）
  2. 公開 repo 的 GitHub Actions（.gate/gate.py；terms 由 repo secret 寫成暫存檔）

檢查（全部「上限 0」，任一命中 → exit 1）：
  PRIVACY-TERM   隱私詞表命中（純字串不分大小寫，或 `re:` 開頭的正規式）；內建再擋未遮 IPv4
  INTERNAL-TIER  出現 tier = 內部 類字樣；或標記引用的鍵等級為內部
  INTERNAL-KEY   內部等級鍵的鍵名出現在輸出內容
  NO-TIER        標記引用的鍵無 tier / 登記簿查無此鍵
  R-MARKER/R-VALUE  標記壞掉、前面沒數字、數字與登記簿 display 不同
  UNBOUND-NUMBER 帶單位的數字或表格裸數字沒有綁 `N<!--R:KEY-->`（白名單優先；`<select>` / `<option>` 內文字不查）
  CLAIM-ID       宣稱數字 `N<!--C:ID-->`（經歷軸線等非量測值，台帳 B3 / B12）視同已綁、不要網址，
                 但 ID 必須在宣稱登記簿（--claims-registry）；沒給登記簿 = 一律不算綁（fail closed）
  MANIFEST-*     匯出清單（export-manifest.json）缺檔 / 雜湊不符 / 清單外檔案
  RENDER-CHECK   （可選）render.mjs --check 非 0；node 或 render.mjs 不在 → SKIP，不算失敗
輸出不回顯命中的隱私詞本身（公開 repo 的 Actions log 是公開的），只印規則、檔、行、詞表行號。
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time

TEXT_EXT = {'.html', '.htm', '.css', '.js', '.mjs', '.json', '.svg', '.xml', '.txt', '.md', '.webmanifest'}
SKIP_DIRS = {'.git'}                    # 不掃、不入清單
GATE_DIRS = ('.gate/', '.github/')      # 只驗雜湊，不做內容掃描（規則字面本身會命中自己）
MANIFEST = 'export-manifest.json'
DEFAULT_INTERNAL = ['內部', '雇主內部', 'internal']
DEFAULT_UNITS = ['kW', 'MW', 'W', 'kg', 'GPU', 'PUE', 'TUE', 'L/min', 'LPM', 'Gbps', 'GB', 'TB', 'CFM',
                 'kPa', 'Pa', 'bar', 'm³/h', 'm3/h', '°C', '℃', '%', 'RU']
MARK_RE = re.compile(r'(-?\d+(?:\.\d+)?)?<!--R:([A-Za-z0-9._-]+)-->')
DATA_R_RE = re.compile(r'<(\w+)\b[^>]*\bdata-r="([A-Za-z0-9._-]+)"[^>]*>(.*?)</\1>', re.S)
CLAIM_MARK = r'<!--C:([A-Za-z0-9._-]+)-->'
IPV4_RE = re.compile(r'(?<![\w.])((?:\d{1,3}\.){3}\d{1,3})(?!\w|\.\d)')
# 版本字串不是 IP（WO-PS16，與 ops/privacy/privacy_rules.py 同一組字樣）：Firmware / v / 版本 後接四段數字
VERSION_PREFIX_RE = re.compile(r'(?:(?<![A-Za-z])(?:version|ver|firmware|fw|bios|bmc|driver|release|rev|build|v)'
                               r'|版本|韌體|固件|驅動)\.?\s*[:：=]?\s*$', re.I)


def line_of(text, idx):
    return text.count('\n', 0, idx) + 1


def blank(text, s, e):
    """把 [s,e) 換成空白但保留換行，行號不變。"""
    return text[:s] + re.sub(r'[^\n]', ' ', text[s:e]) + text[e:]


def load_terms(path):
    """回傳 [(行號, compiled_regex)]。純字串用 re.escape，不分大小寫。"""
    out = []
    with open(path, encoding='utf-8') as f:
        for n, raw in enumerate(f, 1):
            s = raw.strip()
            if not s or s.startswith('#'):
                continue
            out.append((n, re.compile(s[3:] if s.startswith('re:') else re.escape(s), re.I)))
    return out


def load_evidence(path):
    with open(path, encoding='utf-8') as f:
        j = json.load(f)
    keys = j.get('keys', j)
    if not isinstance(keys, dict):
        raise SystemExit(f'evidence {path}: 需要 {{"keys": {{KEY: {{tier, display}}}}}}')
    return keys


def load_claim_ids(path):
    """宣稱登記簿：[ID...]、{"ids": [...]} 或 {"claims": {ID: {...}}}。回傳 set。"""
    with open(path, encoding='utf-8') as f:
        j = json.load(f)
    if isinstance(j, dict):
        j = j['claims'].keys() if 'claims' in j else j['ids']
    return set(j)


def is_internal(rec, internal):
    return (rec.get('tier') or '').strip().lower() in [x.strip().lower() for x in internal]


def list_files(root):
    out = []
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
        for f in sorted(files):
            rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
            if rel != MANIFEST:
                out.append(rel)
    return out


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(65536), b''):
            h.update(b)
    return h.hexdigest()


def scan_text(rel, raw, cfg, F):
    # --- 隱私詞 + IPv4
    for n, rx in cfg['terms']:
        for m in rx.finditer(raw):
            F.append(('PRIVACY-TERM', rel, line_of(raw, m.start()), f'詞表第 {n} 行命中'))
    for m in IPV4_RE.finditer(raw):
        if all(int(o) <= 255 for o in m.group(1).split('.')) and \
                not VERSION_PREFIX_RE.search(raw[max(0, m.start() - 12):m.start()]):
            F.append(('PRIVACY-TERM', rel, line_of(raw, m.start()), '未遮 IPv4'))
    # --- tier = 內部 字樣
    lab = '|'.join(re.escape(x) for x in cfg['internal'])
    for m in re.finditer(r'tier["\'\]]*\s*[:=]\s*["\']?\s*(?:' + lab + r')', raw, re.I):
        F.append(('INTERNAL-TIER', rel, line_of(raw, m.start()), 'tier = 內部等級字樣'))
    # --- 內部鍵名
    for k in cfg['internal_keys']:
        for m in re.finditer(r'(?<![A-Za-z0-9._-])' + re.escape(k) + r'(?![A-Za-z0-9._-])', raw):
            F.append(('INTERNAL-KEY', rel, line_of(raw, m.start()), '內部等級鍵名出現在輸出'))
    if not rel.lower().endswith(('.html', '.htm')):
        return
    # --- 標記 vs 登記簿
    ev = cfg['evidence']
    mark_spans = []
    for m in MARK_RE.finditer(raw):
        mark_spans.append((m.start(), m.end()))
        num, key = m.group(1), m.group(2)
        ln = line_of(raw, m.start())
        r = ev.get(key)
        if r is None:
            F.append(('NO-TIER', rel, ln, f'標記鍵 {key} 不在登記簿'))
            continue
        if not (r.get('tier') or '').strip():
            F.append(('NO-TIER', rel, ln, f'標記鍵 {key} 無 tier'))
        elif is_internal(r, cfg['internal']):
            F.append(('INTERNAL-TIER', rel, ln, '標記引用內部等級鍵'))
        if num is None:
            F.append(('R-VALUE', rel, ln, f'{key} 標記前沒有數字'))
        elif 'display' in r and num != str(r['display']):
            F.append(('R-VALUE', rel, ln, f'{key} 頁面 {num} ≠ 登記簿 {r["display"]}'))
    for m in re.finditer(r'<!--R:', raw):
        if not any(s <= m.start() < e for s, e in mark_spans):
            F.append(('R-MARKER', rel, line_of(raw, m.start()), '標記不完整（需 <!--R:KEY-->）'))
    spans = list(mark_spans)
    for m in DATA_R_RE.finditer(raw):
        spans.append((m.start(), m.end()))
        r = ev.get(m.group(2))
        if r is None or not (r.get('tier') or '').strip():
            F.append(('NO-TIER', rel, line_of(raw, m.start()), f'data-r 鍵 {m.group(2)} 不在登記簿或無 tier'))
        elif is_internal(r, cfg['internal']):
            F.append(('INTERNAL-TIER', rel, line_of(raw, m.start()), 'data-r 引用內部等級鍵'))
    # --- 宣稱數字：N[單位]<!--C:ID-->，ID 在登記簿才算綁
    unit_alt = '|'.join(re.escape(u) for u in sorted(cfg['units'], key=len, reverse=True))
    reg = cfg.get('claims')
    for m in re.finditer(r'(?<![\w.])\d[\d,]*(?:\.\d+)?(?:[ \t]*(?:' + unit_alt + r'))?' + CLAIM_MARK, raw):
        ln = line_of(raw, m.start())
        if reg is None:
            F.append(('CLAIM-ID', rel, ln, f'宣稱數字 {m.group(1)} 需要 --claims-registry'))
        elif m.group(1) not in reg:
            F.append(('CLAIM-ID', rel, ln, f'宣稱 ID {m.group(1)} 不在宣稱登記簿'))
        else:
            spans.append((m.start(), m.end()))
    # --- 無等級數字（白名單優先）
    t = raw
    for m in re.finditer(r'<(script|style)\b.*?</\1>', raw, re.S | re.I):
        t = blank(t, m.start(), m.end())
    # 輸入選項不是對外宣稱數字：<select> / <option> 內文字不查 UNBOUND-NUMBER（Wen 10-21 第 2 輪第 7 項；隱私詞仍掃 raw）
    for m in re.finditer(r'<select\b.*?</select>|<option\b.*?</option>', t, re.S | re.I):
        t = blank(t, m.start(), m.end())
    for m in re.finditer(r'<t[dh]\b[^>]*>\s*-?\d[\d.,]*\s*</t[dh]>', t, re.I):
        F.append(('UNBOUND-NUMBER', rel, line_of(raw, m.start()), '表格裸數字未綁 <!--R:KEY-->'))
    for m in re.finditer(r'<!--.*?-->|<[^>]+>', t, re.S):
        t = blank(t, m.start(), m.end())
    for m in re.finditer(r'(?<![A-Za-z])(?:PUE|TUE)\s*[:=約≈~]?\s*(\d+(?:\.\d+)?)', t):
        if not any(s <= m.start(1) < e for s, e in spans):
            F.append(('UNBOUND-NUMBER', rel, line_of(raw, m.start()), 'PUE/TUE 數字未綁 <!--R:KEY-->'))
    for m in re.finditer(r'(?<![\w.])\d[\d,]*(?:\.\d+)?[ \t]*(?:' + unit_alt + r')(?![A-Za-z])', t):
        if not any(s <= m.start() < e for s, e in spans):
            F.append(('UNBOUND-NUMBER', rel, line_of(raw, m.start()), '帶單位數字未綁 <!--R:KEY-->'))


def check_manifest(root, files, F):
    mp = os.path.join(root, MANIFEST)
    if not os.path.exists(mp):
        F.append(('MANIFEST-MISSING-FILE', MANIFEST, 0, '缺 export-manifest.json'))
        return
    with open(mp, encoding='utf-8') as f:
        man = json.load(f).get('files', {})
    for rel, h in man.items():
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            F.append(('MANIFEST-MISSING-FILE', rel, 0, '清單有、目錄沒有'))
        elif sha256(p) != h:
            F.append(('MANIFEST-HASH', rel, 0, '雜湊與匯出清單不符'))
    for rel in files:
        if rel not in man:
            F.append(('MANIFEST-EXTRA', rel, 0, '非匯出檔（清單外）'))


def run_render(cfg, F, notes):
    if not cfg.get('render_mjs'):
        notes.append('render --check: 未要求')
        return
    node = shutil.which('node')
    if not node or not os.path.exists(cfg['render_mjs']):
        msg = 'render --check: SKIP（node 或 render.mjs 不在）'
        if cfg.get('require_render'):
            F.append(('RENDER-CHECK', 'render.mjs', 0, msg))
        notes.append(msg)
        return
    cmd = [node, cfg['render_mjs'], '--check']
    if cfg.get('render_data'):
        cmd += ['--data', cfg['render_data']]
    cmd += cfg.get('render_files') or []
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=50)
    except subprocess.TimeoutExpired:
        F.append(('RENDER-CHECK', 'render.mjs', 0, '逾時 50 秒'))
        return
    tail = (r.stdout.strip().splitlines() or [''])[-1]
    notes.append(f'render --check: exit {r.returncode} {tail}')
    if r.returncode != 0:
        F.append(('RENDER-CHECK', 'render.mjs', 0, f'exit {r.returncode}：{tail}'))


def run_gate(site, terms, evidence, internal=None, units=None, require_manifest=False, claims=None, **render):
    """回傳 (findings, notes, nfiles)。terms / evidence / claims（宣稱登記簿，可省）為檔案路徑。"""
    t0 = time.time()
    internal = internal or DEFAULT_INTERNAL
    ev = load_evidence(evidence)
    cfg = {'terms': load_terms(terms), 'evidence': ev, 'internal': internal, 'units': units or DEFAULT_UNITS,
           'internal_keys': [k for k, v in ev.items() if isinstance(v, dict) and is_internal(v, internal)],
           'claims': load_claim_ids(claims) if claims else None, **render}
    F, notes = [], []
    files = list_files(site)
    if require_manifest:
        check_manifest(site, files, F)
    for rel in files:
        if rel.startswith(GATE_DIRS) or os.path.splitext(rel)[1].lower() not in TEXT_EXT:
            continue
        with open(os.path.join(site, rel), encoding='utf-8', errors='replace') as f:
            scan_text(rel, f.read(), cfg, F)
    run_render(cfg, F, notes)
    notes.append(f'{len(files)} files, {time.time() - t0:.2f}s')
    return F, notes, len(files)


def main(argv=None):
    ap = argparse.ArgumentParser(description='公開閘門 v0')
    ap.add_argument('--site', required=True)
    ap.add_argument('--terms', required=True, help='隱私詞表（每行一詞；re: 開頭為正規式；# 註解）。缺檔即失敗')
    ap.add_argument('--evidence', required=True, help='JSON：{"keys": {KEY: {"tier": ..., "display": ...}}}')
    ap.add_argument('--internal-tiers', default=','.join(DEFAULT_INTERNAL))
    ap.add_argument('--units', default=','.join(DEFAULT_UNITS))
    ap.add_argument('--require-manifest', action='store_true')
    ap.add_argument('--claims-registry', help='宣稱登記簿 JSON；`N<!--C:ID-->` 的 ID 必須在內')
    ap.add_argument('--render-mjs')
    ap.add_argument('--render-data')
    ap.add_argument('--render-file', action='append', default=[])
    ap.add_argument('--require-render', action='store_true')
    a = ap.parse_args(argv)
    if not os.path.isdir(a.site):
        print(f'GATE FAILED: 找不到 --site {a.site}')
        return 1
    for p in (a.terms, a.evidence) + ((a.claims_registry,) if a.claims_registry else ()):
        if not os.path.isfile(p):
            print(f'GATE FAILED: 找不到 {p}（fail closed）')
            return 1
    F, notes, _ = run_gate(a.site, a.terms, a.evidence, a.internal_tiers.split(','), a.units.split(','),
                           a.require_manifest, a.claims_registry, render_mjs=a.render_mjs, render_data=a.render_data,
                           render_files=a.render_file, require_render=a.require_render)
    for rule, f, ln, msg in F:
        print(f'{f}:{ln} {rule} {msg}')
    for x in notes:
        print(x)
    print(f'GATE {"FAILED" if F else "PASSED"} ({len(F)} findings)')
    return 1 if F else 0


if __name__ == '__main__':
    sys.exit(main())
