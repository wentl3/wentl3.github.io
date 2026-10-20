#!/usr/bin/env python3
"""PR 預覽用的檔案調整（只改預覽副本，不改匯出目錄 / 原稿）。

    python3 preview_prep.py --dir <預覽副本目錄> --pr <PR 號>

  1. 每個 HTML 的 <head> 加 <meta name="robots" content="noindex">（預覽不讓搜尋引擎收）
  2. 根目錄絕對路徑 href="/x"、src="/x"、action="/x"（HTML）與 url(/x)（CSS）改成 /preview/<PR 號>/x
     （`//cdn...` 與相對路徑不動），否則預覽頁的樣式 / 連結會跳回 main 的根目錄
"""
import argparse
import os
import re
import sys

NOINDEX = '<meta name="robots" content="noindex">'


def rewrite(text, prefix, html):
    if html:
        text = re.sub(r'(?i)(\b(?:href|src|action)\s*=\s*["\'])/(?!/)', lambda m: m.group(1) + prefix, text)
        if NOINDEX not in text:
            text, n = re.subn(r'(?i)(<head\b[^>]*>)', lambda m: m.group(1) + NOINDEX, text, count=1)
            if n == 0:
                text = NOINDEX + text
    text = re.sub(r'(?i)(url\(\s*["\']?)/(?!/)', lambda m: m.group(1) + prefix, text)
    return text


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', required=True)
    ap.add_argument('--pr', required=True)
    a = ap.parse_args(argv)
    if not a.pr.isdigit():
        print('PR 號必須是數字')
        return 2
    prefix = f'/preview/{a.pr}/'
    n = 0
    for d, _, fs in os.walk(a.dir):
        for f in fs:
            ext = os.path.splitext(f)[1].lower()
            if ext not in ('.html', '.htm', '.css'):
                continue
            p = os.path.join(d, f)
            with open(p, encoding='utf-8', errors='replace') as fh:
                old = fh.read()
            new = rewrite(old, prefix, ext != '.css')
            if new != old:
                with open(p, 'w', encoding='utf-8') as fh:
                    fh.write(new)
                n += 1
    print(f'preview_prep: {n} 檔已調整 -> {prefix}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
