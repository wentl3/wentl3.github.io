#!/usr/bin/env bash
# 發佈到公開 repo 的 gh-pages 分支（Pages Source = Deploy from a branch: gh-pages）。
#   pages_publish.sh <remote-url> main    <src-dir>          # main deploy：換掉根目錄，但保留 preview/
#   pages_publish.sh <remote-url> preview <src-dir> <pr號>   # PR 預覽：只換 preview/<pr號>/，不碰根目錄與其他 PR
# 共存規則：main 只動「根目錄、不含 preview/」；preview 只動「preview/<自己的 PR 號>/」。
# push 衝突（同時有人發佈）重試 3 次；無變更不產生 commit。
set -euo pipefail
url=${1:?remote url}; mode=${2:?main|preview}; src=${3:?src dir}; pr=${4:-}
[ -d "$src" ] || { echo "src 不存在：$src" >&2; exit 2; }
case "$mode" in
  main) ;;
  preview) [[ "$pr" =~ ^[0-9]+$ ]] || { echo "preview 需要數字 PR 號" >&2; exit 2; } ;;
  *) echo "mode 只能是 main 或 preview" >&2; exit 2 ;;
esac
git_id=(-c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com")

for attempt in 1 2 3; do
  work=$(mktemp -d); dst="$work/pages"
  if git ls-remote --exit-code --heads "$url" gh-pages >/dev/null 2>&1; then
    git clone -q --depth 1 --branch gh-pages "$url" "$dst"
  else
    git init -q -b gh-pages "$dst"; git -C "$dst" remote add origin "$url"
  fi
  if [ "$mode" = main ]; then
    rsync -a --checksum --delete --exclude='/.git' --exclude='/preview' "$src"/ "$dst"/
    touch "$dst/.nojekyll"
  else
    mkdir -p "$dst/preview/$pr"
    rsync -a --checksum --delete "$src"/ "$dst/preview/$pr"/
    touch "$dst/.nojekyll"
  fi
  git -C "$dst" add -A
  if git -C "$dst" diff --cached --quiet; then echo "無變更（${mode}）"; rm -rf "$work"; exit 0; fi
  git -C "$dst" "${git_id[@]}" commit -q -m "pages: $mode${pr:+ #$pr}"
  if git -C "$dst" push -q origin gh-pages; then echo "已發佈（${mode}${pr:+ #$pr}）"; rm -rf "$work"; exit 0; fi
  echo "push 衝突，重試 $attempt/3" >&2; rm -rf "$work"
done
echo "發佈失敗" >&2; exit 1
