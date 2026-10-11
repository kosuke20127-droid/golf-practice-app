"""start.bat から起動する。必要なパッケージを入れてから server.py を動かし、
画面の「更新する」で新しい版を入れたときは、自動で起動し直す (終了コード 3)。"""

import os
import subprocess
import sys
from pathlib import Path

RESTART = 3
HERE = Path(__file__).resolve().parent


def pip_install():
    if os.environ.get("GOLF_SKIP_PIP"):
        return
    pip = [sys.executable, "-m", "pip", "install", "-q", "--disable-pip-version-check"]
    subprocess.call(pip + ["google-genai", "numpy", "pillow"])
    # 姿勢の計測 (mediapipe) は入らなくてもアプリは起動する
    if subprocess.call(pip + ["mediapipe"]) != 0:
        print("[!] mediapipe を入れられませんでした。姿勢の計測は使えません（Python 3.12 がおすすめです）。")


def main():
    os.chdir(HERE)
    env = dict(os.environ, GOLF_LAUNCHER="1")
    first = True
    while True:
        pip_install()
        if not first:
            env["GOLF_NO_BROWSER"] = "1"  # 更新のあとはブラウザを開き直さない (今の画面が自動で読み直す)
        first = False
        code = subprocess.call([sys.executable, "server.py"], env=env)
        if code != RESTART:
            return code
        print("\n起動し直します…\n")


if __name__ == "__main__":
    sys.exit(main())
