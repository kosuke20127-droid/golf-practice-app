"""GitHub から新しい版を取ってきて、このフォルダに上書きする (data と config.json はそのまま)。

リポジトリは非公開なので、読み取り専用のトークン (Fine-grained personal access token、Contents: Read-only) を使う。
"""

import io
import json
import re
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

# 配布版には update.json があり、公開リポジトリから取る (トークンは要らない)
_UPD = Path(__file__).resolve().parent / "update.json"
try:
    _CFG = json.loads(_UPD.read_text(encoding="utf-8")) if _UPD.exists() else {}
except (OSError, ValueError):
    _CFG = {}
REPO = _CFG.get("repo") or "kosuke20127-droid/golf"
BRANCH = _CFG.get("branch") or "claude/nice-ride-bvxakw"
PUBLIC = bool(_CFG.get("public"))
API = f"https://api.github.com/repos/{REPO}"
KEEP = {"data", "config.json", "__pycache__", "update.json"}  # 上書きしない
NO_TOUCH_WHILE_RUNNING = {"start.bat"}  # 動いている最中に書き換えると、終わるときに変な動きをする


class UpdateError(Exception):
    """画面にそのまま出せる日本語のメッセージを持つ例外。"""


def _get(url, token, accept="application/vnd.github+json", timeout=60):
    headers = {"Accept": accept, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "golf-practice-app"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise UpdateError("GitHub のトークンが使えません。期限切れか、golf リポジトリの読み取り権限がないかもしれません（設定タブで入れ直してください）。") from e
        if e.code == 404:
            raise UpdateError("更新が見つかりません。トークンで golf リポジトリが選ばれているか確認してください。") from e
        raise UpdateError(f"GitHub から取得できませんでした（{e.code}）") from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise UpdateError(f"GitHub につながりませんでした（{e}）") from e


def latest_version(token):
    """GitHub にある新しい版の番号 (server.py の APP_VERSION)。"""
    raw = _get(f"{API}/contents/pc/server.py?ref={BRANCH}", token, accept="application/vnd.github.raw", timeout=20)
    m = re.search(rb"^APP_VERSION = (\d+)", raw, re.M)
    if not m:
        raise UpdateError("新しい版の番号を読み取れませんでした。")
    return int(m.group(1))


def apply(token, app_dir):
    """新しい版の pc フォルダの中身を app_dir に上書きする。戻り値は書き換えたファイルの数と注意。"""
    data = _get(f"{API}/zipball/{BRANCH}", token, timeout=180)
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as e:
        raise UpdateError("ダウンロードしたファイルが壊れていました。もう一度お試しください。") from e
    names = zf.namelist()
    if not names:
        raise UpdateError("ダウンロードしたファイルが空でした。")
    root = names[0].split("/")[0] + "/pc/"
    files = [n for n in names if n.startswith(root) and not n.endswith("/")]
    if not any(n == root + "server.py" for n in files):
        raise UpdateError("ダウンロードした中に server.py がありませんでした。")
    app_dir = Path(app_dir)
    written, notes = 0, []
    for n in files:
        rel = n[len(root):]
        if rel.split("/")[0] in KEEP:
            continue
        dst = app_dir / rel
        body = zf.read(n)
        if dst.exists() and dst.read_bytes() == body:
            continue
        if rel in NO_TOUCH_WHILE_RUNNING:
            dst.with_name(dst.name + ".new").write_bytes(body)
            notes.append(f"{rel} が変わりました。次に自分で起動し直すときに {rel}.new の名前を {rel} に変えてください。")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        tmp = dst.with_name(dst.name + ".tmp")
        tmp.write_bytes(body)
        tmp.replace(dst)
        written += 1
    return {"written": written, "notes": notes}


if __name__ == "__main__":  # 手で試すとき: python updater.py <トークン>
    import sys
    print(json.dumps({"latest": latest_version(sys.argv[1])}))
