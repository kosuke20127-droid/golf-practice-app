"""ゴルフ練習ノート (パソコン版) のサーバー。

このパソコンで動かしておき、スマホからは Tailscale 経由でブラウザで開く。
起動: python server.py  (Windows は start.bat をダブルクリック)
"""

import json
import mimetypes
import os
import re
import shutil
import sys
import threading
import time
import traceback
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import updater
import video

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
CONFIG_PATH = APP_DIR / "config.json"
VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".3gp"}
# 画面 (static/app.js) と同じ番号にする。違うと画面に「start.bat を起動し直して」と出る
APP_VERSION = 32
RESTART_CODE = 3  # launcher.py がこの番号で終わったのを見て、起動し直す
MAX_AI_IMAGES = 20  # 1回の分析で送る画像の上限 (1球あたり3枚)

CLUB_NAMES = {"1W": "ドライバー"}

# 弾道のラベル (画面の FLIGHTS と同じ)
FLIGHTS = {"straight": "ストレート", "fade": "フェード", "draw": "ドロー", "slice": "スライス", "hook": "フック",
           "push": "プッシュ（右へまっすぐ）", "pull": "引っかけ（左へまっすぐ）", "fat": "ダフリ", "thin": "トップ", "sky": "テンプラ"}


# ---------- 設定 ----------

def load_config():
    cfg = {"port": 8765, "host": "127.0.0.1", "data_dir": str(APP_DIR / "data"),
           "inbox_dir": "", "gemini_api_key": "", "gemini_model": "",
           "claude_cmd": "claude", "claude_model": "sonnet",
           "height_cm": 170, "lefty": False, "github_token": ""}
    if CONFIG_PATH.exists():
        try:
            saved = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            saved.setdefault("setup_done", True)  # 前から使っている人には、はじめての設定を出さない
            cfg.update(saved)
        except (OSError, ValueError):
            print("config.json を読み込めなかったので、初期設定で起動します。")
    return cfg


def save_config(cfg):
    tmp = CONFIG_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CONFIG_PATH)


CONFIG = load_config()
DATA_DIR = Path(CONFIG["data_dir"]).expanduser()
MEDIA_DIR = DATA_DIR / "media"
JOBS_DIR = DATA_DIR / "jobs"
UPLOAD_DIR = DATA_DIR / "uploads"


def gemini_key():
    return CONFIG.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""


def inbox_dir():
    return Path(CONFIG.get("inbox_dir") or DATA_DIR / "inbox").expanduser()


# ---------- 記録の保存 (data/db.json) ----------

class Store:
    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.state = {"bag": None, "active": None, "sessions": [], "drillResults": [], "swings": [], "notes": [], "coach": None, "feels": []}
        if path.exists():
            self.state.update(json.loads(path.read_text(encoding="utf-8")))

    def _write(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.state, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)

    def snapshot(self):
        with self.lock:
            return json.loads(json.dumps(self.state))

    def _upsert(self, key, item, sort_field):
        lst = [x for x in self.state[key] if str(x.get("id")) != str(item.get("id"))]
        lst.append(item)
        lst.sort(key=lambda x: x.get(sort_field) or 0, reverse=True)
        self.state[key] = lst

    def apply(self, kind, item):
        with self.lock:
            if kind == "profile":
                self.state["bag"] = item.get("bag")
                self.state["active"] = item.get("active")
                self.state["theme"] = item.get("theme")
                self.state["focus"] = item.get("focus")
                self.state["scoring"] = item.get("scoring")
            elif kind == "session":
                self._upsert("sessions", item, "startedAt")
            elif kind == "deleteSession":
                self.state["sessions"] = [x for x in self.state["sessions"] if str(x.get("id")) != str(item)]
            elif kind == "drill":
                self._upsert("drillResults", item, "at")
            elif kind == "swing":
                old = self.find_swing(item.get("id"))
                if old is None:
                    raise ValueError("その記録はありません")
                # 画像や動画の場所はサーバーが決めたものを使う
                for k in ("memo", "concern", "text", "analyzedAt", "club", "angle"):
                    if k in item:
                        old[k] = item[k]
            elif kind == "swingMark":
                rec = self.find_swing(item.get("id"))
                idx = int(item.get("idx", -1))
                if rec is None or not 0 <= idx < len(rec["swings"]):
                    raise ValueError("その記録はありません")
                mark = item.get("mark")
                rec["swings"][idx]["mark"] = mark if mark in ("good", "bad") else None
            elif kind == "swingFlight":
                rec = self.find_swing(item.get("id"))
                i = self.find_swing_item(rec, item.get("clip")) if rec else -1
                if i < 0:
                    raise ValueError("その球は見つかりません")
                flight = item.get("flight")
                rec["swings"][i]["flight"] = flight if flight in FLIGHTS else None
            elif kind == "swingTime":
                rec = self.find_swing(item.get("id"))
                if rec is None:
                    raise ValueError("その記録はありません")
                shot_at = int(item["shotAt"])
                rec["shotAt"] = shot_at
                rec["shotAtSource"] = "manual"
                for sw in rec["swings"]:
                    sw["shotAt"] = shot_at + int(float(sw.get("t") or 0) * 1000)
            elif kind == "note":
                old = next((x for x in self.state["notes"] if str(x.get("id")) == str(item.get("id"))), None)
                note = {"id": str(item["id"]), "day": str(item.get("day") or ""), "memo": str(item.get("memo") or ""),
                        "at": int(item.get("at") or time.time() * 1000)}
                if old and old.get("memo") == note["memo"] and old.get("day") == note["day"]:
                    note.update({k: old[k] for k in ("text", "organizedAt") if k in old})
                self._upsert("notes", note, "day")
            elif kind == "feel":
                feel = {"id": str(item["id"]), "phrase": str(item.get("phrase") or "").strip()[:80],
                        "fixes": str(item.get("fixes") or "").strip()[:120], "club": str(item.get("club") or "")[:20],
                        "day": str(item.get("day") or ""), "source": item.get("source") or "manual",
                        "at": int(item.get("at") or time.time() * 1000)}
                if not feel["phrase"]:
                    raise ValueError("感覚を入力してください")
                self.state.setdefault("feels", [])
                self._upsert("feels", feel, "at")
            elif kind == "deleteFeel":
                self.state["feels"] = [x for x in self.state.get("feels", []) if str(x.get("id")) != str(item)]
            elif kind == "deleteNote":
                self.state["notes"] = [x for x in self.state["notes"] if str(x.get("id")) != str(item)]
            elif kind == "deleteSwingItem":
                rec = self.find_swing(item.get("id"))
                i = self.find_swing_item(rec, item.get("clip")) if rec else -1
                if i < 0:
                    raise ValueError("その球は見つかりません")
                if ANALYSES.get(str(rec["id"]), {}).get("status") == "running":
                    raise ValueError("AI 分析が終わってから削除してください")
                sw = rec["swings"].pop(i)
                for k in ("sprite", "trail", "clip"):
                    if sw.get(k):
                        (DATA_DIR / sw[k]).unlink(missing_ok=True)
                for k in ("image", "linesClip", "linesSprite", "faceImage", "trailMasked"):
                    f = (sw.get("pose") or {}).get(k)
                    if f:
                        (DATA_DIR / f.split("?")[0]).unlink(missing_ok=True)
                if not rec["swings"]:
                    self.state["swings"] = [x for x in self.state["swings"] if x is not rec]
                    shutil.rmtree(MEDIA_DIR / str(rec["id"]), ignore_errors=True)
                else:
                    self._average(rec)
            elif kind == "deleteSwing":
                self.state["swings"] = [x for x in self.state["swings"] if str(x.get("id")) != str(item)]
                shutil.rmtree(MEDIA_DIR / str(item), ignore_errors=True)
            else:
                raise ValueError(f"unknown kind: {kind}")
            self._write()

    def add_swing(self, rec):
        with self.lock:
            self._upsert("swings", rec, "at")
            self._write()

    def update_swing(self, rec_id, **fields):
        with self.lock:
            rec = self.find_swing(rec_id)
            if rec is not None:
                rec.update(fields)
                self._write()

    def set_pose(self, rec_id, idx, result):
        with self.lock:
            rec = self.find_swing(rec_id)
            if rec is not None and 0 <= idx < len(rec["swings"]):
                rec["swings"][idx]["pose"] = result
                self._write()

    @staticmethod
    def _apply_score(sw, sc):
        score = sc.get("score") if isinstance(sc, dict) else None
        if isinstance(score, (int, float)):
            score = int(max(0, min(100, round(score))))
            sw["score"] = score
            sw["verdict"] = "good" if score >= 75 else "ok" if score >= 50 else "bad"
            sw["aiNote"] = str(sc.get("note") or "")[:40]
        else:
            sw["score"], sw["verdict"], sw["aiNote"] = None, None, ""

    @staticmethod
    def _average(rec):
        scored = [sw["score"] for sw in rec["swings"] if sw.get("score") is not None]
        rec["score"] = round(sum(scored) / len(scored)) if scored else None

    def set_scores(self, rec_id, scores):
        """AI の点数を1球ずつ書き込み、記録全体の平均点を出す。"""
        with self.lock:
            rec = self.find_swing(rec_id)
            if rec is None:
                return
            for sw, sc in zip(rec["swings"], scores):
                self._apply_score(sw, sc)
            self._average(rec)
            self._write()

    def find_swing_item(self, rec, clip):
        """1球を、切り出し動画の場所で探す (削除で番号がずれても取り違えないように)。"""
        return next((i for i, sw in enumerate(rec["swings"]) if sw.get("clip") == clip), -1)

    def set_swing_analysis(self, rec_id, clip, text, score):
        with self.lock:
            rec = self.find_swing(rec_id)
            i = self.find_swing_item(rec, clip) if rec else -1
            if i < 0:
                return
            sw = rec["swings"][i]
            sw["aiText"] = text
            sw["analyzedAt"] = int(time.time() * 1000)
            if score is not None:
                self._apply_score(sw, score)
                self._average(rec)
            self._write()

    def find_swing(self, rec_id):
        return next((x for x in self.state["swings"] if str(x.get("id")) == str(rec_id)), None)

    def replace(self, new_state):
        """バックアップからの復元・全削除。動画のない (claude.ai 版の) スイング記録は持ち込まない。"""
        with self.lock:
            keep_ids = set()
            swings = []
            for rec in new_state.get("swings") or []:
                if rec.get("swings") and all("sprite" in s for s in rec["swings"]) and \
                        (MEDIA_DIR / str(rec.get("id"))).exists():
                    swings.append(rec)
                    keep_ids.add(str(rec["id"]))
            for d in MEDIA_DIR.iterdir() if MEDIA_DIR.exists() else []:
                if d.is_dir() and d.name not in keep_ids:
                    shutil.rmtree(d, ignore_errors=True)
            self.state = {
                "bag": new_state.get("bag"),
                "active": new_state.get("active"),
                "sessions": new_state.get("sessions") or [],
                "drillResults": new_state.get("drillResults") or [],
                "swings": swings,
            }
            self._write()


# ---------- 同じ動画の見分け ----------

FP_CHUNK = 1 << 20


def fingerprint(path):
    """ファイルの大きさと先頭・末尾 1MB から作る目印。ブラウザ側 (fingerprint) と同じ計算。"""
    import hashlib
    size = path.stat().st_size
    h = hashlib.sha256(str(size).encode())
    with open(path, "rb") as f:
        h.update(f.read(FP_CHUNK))
        f.seek(max(0, size - FP_CHUNK))
        h.update(f.read(FP_CHUNK))
    return h.hexdigest()[:32]


def find_duplicate(fp=None, shot_at=None, duration=None):
    """同じ動画から作った記録を探す。目印が同じか、撮影日時と長さがほぼ同じなら同じ動画とみなす。"""
    for rec in STORE.snapshot()["swings"]:
        same_fp = fp and rec.get("fileFp") == fp
        same_meta = (shot_at and rec.get("shotAtSource") == "meta" and rec.get("shotAt")
                     and abs(rec["shotAt"] - shot_at) < 2000
                     and abs((rec.get("duration") or 0) - (duration or 0)) < 1.0)
        if same_fp or same_meta:
            return {"id": rec["id"], "shotAt": rec.get("shotAt") or rec.get("at"),
                    "club": rec.get("club"), "count": len(rec.get("swings") or [])}
    return None


# ---------- 動画の処理 (ジョブ) ----------

class Job:
    def __init__(self, src, name, uploaded, file_time=None):
        self.id = uuid.uuid4().hex[:12]
        self.file_time = file_time  # ファイルの更新日時 (ミリ秒)。撮影日時が読めないときに使う
        self.shot_at = None
        self.club_guess = None
        self.fp = None
        self.shot_from_meta = False
        self.shot_source = None
        self.duplicate_of = None
        self.club_guessing = False
        self.src = Path(src)
        self.name = name
        self.uploaded = uploaded
        self.dir = JOBS_DIR / self.id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.status = "detecting"  # detecting → ready → saving → saved / error
        self.message = "インパクト音を探しています…"
        self.duration = 0.0
        self.candidates = []
        self.proxy = False
        self.proxy_src = None  # 元の動画をそのまま再生に使うとき
        self.rec_id = None
        self.created = time.time()

    def public(self):
        return {
            "id": self.id, "name": self.name, "status": self.status, "message": self.message,
            "shotAt": self.shot_at, "shotSource": self.shot_source,
            "clubGuess": self.club_guess, "clubGuessing": self.club_guessing,
            "duplicateOf": self.duplicate_of,
            "duration": self.duration, "candidates": self.candidates, "recId": self.rec_id,
            "proxy": f"jobs/{self.id}/proxy.mp4" if self.proxy else None,
        }


JOBS = {}


def thumb_for(job, t):
    name = f"thumb_{int(round(t * 1000))}.jpg"
    path = job.dir / name
    if not path.exists():
        video.save_thumb(job.src, t, path)
    return f"jobs/{job.id}/{name}"


def verify_candidates(job, impacts):
    """音で見つけた候補を、骨格 (なければ映像の動き) で本当にスイングか確かめる。"""
    if not impacts:
        return []

    def progress(k, n):
        job.message = f"スイングかどうか確かめています…（{k + 1} / {n}）"
    try:
        if not pose_problem():
            import pose
            checks = pose.verify_swings(job.src, impacts, job.duration, DATA_DIR / "models", progress)
        else:
            job.message = "スイングかどうか確かめています…"
            checks = video.check_swings(job.src, impacts, job.duration)
    except Exception:  # noqa: BLE001 - 確かめられなくても、候補は全部出す
        traceback.print_exc()
        return [{"ok": None, "reason": ""} for _ in impacts]
    # 1つもスイングと判定できなかったときは、判定のほうが外れている (撮り方が合わないなど) かもしれないので、
    # はっきりした理由 (人がいない・動画の端・同じスイング) のもの以外はチェックを付けたまま残す
    if len(impacts) >= 3 and not any(c["ok"] for c in checks):
        sure = ("人が写っていません", "動画の最初", "動画の端", "同じスイングの続き")
        for c in checks:
            if c["ok"] is False and not c["reason"].startswith(sure):
                c.update(ok=None, reason="スイングか自信をもって判定できませんでした。見て確かめてください")
    return checks


def run_detect(job):
    try:
        job.duration, has_audio, created = video.probe(job.src)
        job.shot_at, job.shot_source = video.choose_shot_time(created, job.name, job.file_time, int(time.time() * 1000))
        job.shot_from_meta = job.shot_source == "meta"
        created = job.shot_at if job.shot_from_meta else None
        job.fp = fingerprint(job.src)
        job.duplicate_of = find_duplicate(job.fp, created, job.duration)
        if job.duration <= 0:
            raise RuntimeError("動画を読み取れませんでした。別の形式で書き出した動画をお試しください。")
        impacts = []
        if has_audio:
            samples = video.read_audio(job.src)
            # 候補の間隔は短め (1.5 秒) にして、インパクト音のすぐあとの大きな音 (ボールを置いた音など) があっても
            # 本当のインパクトを落とさないようにする。どれがスイングかは、あとで骨格で確かめる
            impacts = video.find_impacts(samples, min_gap=1.5) if samples is not None else []
        checks = verify_candidates(job, impacts)
        job.candidates = [{"t": c.get("t", t), "thumb": thumb_for(job, c.get("t", t)), "on": c["ok"] is not False,
                           "warn": c["reason"]} for t, c in zip(impacts, checks)]
        swings = [c["t"] for c in job.candidates if c["on"]]
        if swings and gemini_key():
            job.club_guessing = True
            threading.Thread(target=run_club_guess, args=(job, swings[:2]), daemon=True).start()
        job.status = "ready"
        skipped = len(impacts) - len(swings)
        job.message = (f"音で見つけた{len(impacts)}か所のうち、{skipped}か所はスイングではなさそうなのでチェックを外しました。"
                       "理由を見て、違っていたらチェックを入れてください。" if impacts and skipped else "") if impacts else (
            "インパクト音が見つかりませんでした。再生してインパクトの瞬間で止め、「今の位置を追加」を押してください。"
            if has_audio else "この動画には音声がありません。インパクトの瞬間で止めて「今の位置を追加」を押してください。")
        if video.browser_playable(job.src):
            job.proxy_src = job.src  # そのまま再生できるので、再生用の動画は作らない (長い動画ほど時間の節約になる)
        else:
            video.make_proxy(job.src, job.dir / "proxy.mp4")
        job.proxy = True
    except Exception as e:  # noqa: BLE001 - 画面にメッセージを出すため
        traceback.print_exc()
        if job.status == "detecting":
            job.status = "error"
            job.message = str(e) or "動画の処理に失敗しました。"


ALL_CLUB_NAMES = {
    "1W": "ドライバー", "3W": "3番ウッド", "5W": "5番ウッド", "UT": "ユーティリティ",
    "4I": "4番アイアン", "5I": "5番アイアン", "6I": "6番アイアン", "7I": "7番アイアン",
    "8I": "8番アイアン", "9I": "9番アイアン", "PW": "ピッチングウェッジ", "AW": "アプローチウェッジ",
    "SW": "サンドウェッジ", "LW": "ロブウェッジ",
}


def run_club_guess(job, impacts):
    """記録画面のクラブの初期値にするため、アドレスとインパクトのコマからクラブを推定する。"""
    import io

    try:
        import ai

        bag = STORE.snapshot().get("bag") or list(ALL_CLUB_NAMES)
        choices = [(c, ALL_CLUB_NAMES.get(c, c)) for c in bag]
        images = []
        for t in impacts:
            for dt in (-2.0, 0.0):
                buf = io.BytesIO()
                video.frame_at(job.src, max(0.0, t + dt), 480).save(buf, "JPEG", quality=85)
                images.append(buf.getvalue())
        job.club_guess = ai.guess_club(gemini_key(), CONFIG.get("gemini_model"), images, choices)
    except Exception:  # noqa: BLE001 - 推定できなくても記録はできる
        traceback.print_exc()
    finally:
        job.club_guessing = False


# ---------- 姿勢の計測 (MediaPipe) ----------

POSES = {}  # 記録ID → {status, message}


def pose_problem():
    """姿勢の計測が使えないときの理由。使えるなら空文字。"""
    try:
        import mediapipe  # noqa: F401
        from mediapipe.tasks.python import vision  # noqa: F401
    except Exception as e:  # noqa: BLE001
        return (f"mediapipe を読み込めません（{e.__class__.__name__}: {e}）。"
                f"このパソコンの Python は {sys.version.split()[0]} です。"
                "start.bat を実行し直しても直らないときは、Python 3.12 を入れてください。")
    return ""


def measure_swing(rec_id, idx, sw, angle, club=None):
    """1球ぶんの切り出し動画から姿勢を測る。失敗しても記録は残し、理由を書いておく。"""
    problem = pose_problem()
    if problem:
        return {"error": problem}
    try:
        import pose
        dst = MEDIA_DIR / str(rec_id) / f"{Path(sw['clip']).stem}_pose.jpg"
        stem = Path(sw["clip"]).stem
        lines_clip = MEDIA_DIR / str(rec_id) / f"{stem}_lines.mp4"
        result = pose.analyze_clip(DATA_DIR / sw["clip"], float(sw.get("clipOffset") or 2.5), angle,
                                   DATA_DIR / "models", dst, float(CONFIG.get("height_cm") or 170),
                                   bool(CONFIG.get("lefty")), club, lines_clip)
        result.pop("frames", None)
        norm_full, refs_full = result.pop("_norm_full"), result.pop("_refs_full")
        # アドレスの腰・手・足首の位置 (元の動画に対する割合)。弾道の推定でボールの場所を探すのに使う
        try:
            p = norm_full[int(round((float(sw.get("clipOffset") or 2.5) + result["events"]["start"]) * video.FPS))]
            x0, y0, x1, y1 = sw.get("crop") or (0.0, 0.0, 1.0, 1.0)
            fx = lambda x: x0 + float(x) * (x1 - x0)  # noqa: E731
            fy = lambda y: y0 + float(y) * (y1 - y0)  # noqa: E731
            result["ballHint"] = {"hip_x": fx((p[pose.L_HIP, 0] + p[pose.R_HIP, 0]) / 2),
                                  "hands_x": fx((p[pose.L_WRIST, 0] + p[pose.R_WRIST, 0]) / 2),
                                  "foot_y": fy(max(p[pose.L_ANKLE, 1], p[pose.R_ANKLE, 1]))}
        except (KeyError, IndexError, TypeError, ValueError):
            pass
        v = int(time.time())
        result["linesClip"] = f"media/{rec_id}/{lines_clip.name}?v={v}"
        trail2 = MEDIA_DIR / str(rec_id) / f"{stem}_trail_body.jpg"
        try:
            pose.retrail(DATA_DIR / sw["clip"], float(sw.get("clipOffset") or 2.5), norm_full, trail2,
                         result.get("events"))
            result["trailMasked"] = f"media/{rec_id}/{trail2.name}?v={v}"
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        face = MEDIA_DIR / str(rec_id) / f"{stem}_face.jpg"
        try:
            if pose.face_zoom(DATA_DIR / sw["clip"], result, norm_full, float(sw.get("clipOffset") or 2.5), face):
                result["faceImage"] = f"media/{rec_id}/{face.name}?v={v}"
        except Exception:  # noqa: BLE001
            traceback.print_exc()
        if sw.get("v") == video.PHASE_VERSION and sw.get("sprite"):
            lines_sprite = MEDIA_DIR / str(rec_id) / f"{stem}_lines.jpg"
            try:
                pose.draw_lines_sprite(DATA_DIR / sw["sprite"], [dt for dt, _ in video.PHASES],
                                       float(sw.get("clipOffset") or 2.5), norm_full, refs_full, lines_sprite)
                result["linesSprite"] = f"media/{rec_id}/{lines_sprite.name}?v={v}"
            except Exception:  # noqa: BLE001
                traceback.print_exc()
        result["image"] = f"media/{rec_id}/{dst.name}?v={int(time.time())}"  # 測り直したら新しい画像を出す
        return result
    except Exception as e:  # noqa: BLE001
        if e.__class__.__name__ == "NotSwingError":
            return {"error": str(e), "notSwing": True}
        if e.__class__.__name__ != "PoseError":
            traceback.print_exc()
            return {"error": f"姿勢を測れませんでした（{e.__class__.__name__}: {e}）。"}
        return {"error": str(e)}


def run_pose(rec_id):
    entry = POSES[rec_id]
    try:
        rec = STORE.find_swing(rec_id)
        swings = list(rec["swings"]) if rec else []
        for i, sw in enumerate(swings):
            entry["message"] = f"{i + 1} / {len(swings)} 球目の姿勢を測っています…"
            STORE.set_pose(rec_id, i, measure_swing(rec_id, i, sw, rec.get("angle"), rec.get("club")))
        rec = STORE.find_swing(rec_id) or {"swings": []}
        errs = [sw.get("pose", {}).get("error") for sw in rec["swings"] if (sw.get("pose") or {}).get("error")]
        ok = len(rec["swings"]) - len(errs)
        if not errs:
            entry.update(status="done", message=f"{ok}球すべて測れました。")
        else:
            entry.update(status="done" if ok else "error",
                         message=f"{len(rec['swings'])}球中{ok}球測れました。測れなかった理由: {errs[0]}")
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        entry.update(status="error", message=f"測れませんでした: {e}")


def run_pose_all(retry_failed=False, everything=False):
    """まだ姿勢を測っていない記録を、古いものからまとめて測る。

    retry_failed なら、測れなかった球と補助線がまだない球も測り直す。everything なら全部の球を測り直す
    (スイングしていない球を探すとき。前の版では、スイングしていない球にも点数が付いていた)。
    """
    entry = POSES["_all"]

    def todo(sw):
        p = sw.get("pose") or {}
        if everything:
            return True
        return "pose" not in sw or (retry_failed and (p.get("error") or not p.get("linesClip")))
    try:
        targets = [r["id"] for r in STORE.snapshot()["swings"]
                   if any(todo(sw) for sw in r.get("swings") or [])]
        for n, rec_id in enumerate(reversed(targets)):
            rec = STORE.find_swing(rec_id)
            if not rec:
                continue
            swings = list(rec["swings"])
            for i, sw in enumerate(swings):
                if not todo(sw):
                    continue
                entry["message"] = f"{n + 1} / {len(targets)} 件目（{i + 1} / {len(swings)} 球目）の姿勢を測っています…"
                STORE.set_pose(rec_id, i, measure_swing(rec_id, i, sw, rec.get("angle"), rec.get("club")))
        failed = [sw["pose"]["error"] for r in STORE.snapshot()["swings"] if r["id"] in targets
                  for sw in r.get("swings") or [] if (sw.get("pose") or {}).get("error")]
        msg = f"{len(targets)}件の記録を測りました。" if targets else "測っていない記録はありません。"
        not_swing = sum(1 for r in STORE.snapshot()["swings"] for sw in r.get("swings") or []
                        if (sw.get("pose") or {}).get("notSwing"))
        if not_swing:
            msg += f" スイングしていない球が{not_swing}球見つかりました。"
        if failed:
            msg += f" 測れなかった球が{len(failed)}球あります（{failed[0]}）"
        entry.update(status="done", message=msg)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        entry.update(status="error", message=f"測れませんでした: {e}")


def swing_crop(job, t):
    """人が小さく写っている動画なら、人のまわりの範囲を返す。測れないときは切り抜かない。"""
    if pose_problem():
        return None
    try:
        import pose
        return pose.person_crop(job.src, t, job.duration, DATA_DIR / "models")
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        return None


def run_save(job, form):
    try:
        rec_id = str(int(time.time() * 1000))
        out = MEDIA_DIR / rec_id
        out.mkdir(parents=True, exist_ok=True)
        impacts = sorted(float(t) for t in form["impacts"])
        shot_at = int(form.get("shotAt") or job.shot_at or time.time() * 1000)
        done = [0]
        lock = threading.Lock()

        def one(i, t):
            """1球ぶん: 切り出し → 姿勢の計測 → (ずれていれば作り直し) → 弾道。球ごとに並行して動かす。"""
            crop = swing_crop(job, t)
            media = video.make_swing_media(job.src, t, job.duration, out, f"s{i + 1:02d}", crop)
            sw = {
                "crop": crop,
                "t": t, "v": video.PHASE_VERSION, "aspect": media["aspect"],
                "sprite": f"media/{rec_id}/{media['sprite']}",
                "trail": f"media/{rec_id}/{media['trail']}",
                "clip": f"media/{rec_id}/{media['clip']}",
                "clipOffset": media["clipOffset"],
                "shotAt": shot_at + int(t * 1000),
                "score": None, "verdict": None, "aiNote": "", "mark": None,
            }
            sw["pose"] = measure_swing(rec_id, i, sw, form.get("angle"), form.get("club"))
            shift = sw["pose"].get("impactShift") or 0
            if abs(shift) >= 0.05:
                # 体の動きから見たインパクトに合わせて、コマ・軌道画像・切り出し動画を作り直す
                t = sw["t"] + shift
                media = video.make_swing_media(job.src, t, job.duration, out, f"s{i + 1:02d}", crop)
                sw.update(t=t, clipOffset=media["clipOffset"], shotAt=shot_at + int(t * 1000), aspect=media["aspect"])
                sw["pose"] = measure_swing(rec_id, i, sw, form.get("angle"), form.get("club"))
            # 弾道の推定 (試験版): 後方から撮った動画で、骨格からボールの置いてあった場所がわかったときだけ
            hint = sw["pose"].get("ballHint")
            if form.get("angle") != "正面" and hint:
                try:
                    sw["ballAuto"] = video.track_ball(job.src, sw["t"], job.duration, bool(CONFIG.get("lefty")), hint)
                except Exception:  # noqa: BLE001
                    traceback.print_exc()
            with lock:
                done[0] += 1
                job.message = f"{done[0]} / {len(impacts)} 球を保存しました…（数球ずつ同時に処理しています）"
            return sw

        job.message = f"0 / {len(impacts)} 球を保存しています…"
        from concurrent.futures import ThreadPoolExecutor
        workers = max(1, min(3, (os.cpu_count() or 2) // 2, len(impacts)))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            swings = list(pool.map(lambda a: one(*a), enumerate(impacts)))
        rec = {
            "id": rec_id, "at": int(time.time() * 1000), "club": form.get("club"),
            "angle": form.get("angle"), "concern": form.get("concern", ""), "memo": form.get("memo", ""),
            "fileName": job.name, "swings": swings, "text": "", "shotAt": shot_at, "score": None,
            "fileFp": job.fp, "duration": job.duration,
            "shotAtSource": "manual" if form.get("shotAt") and int(form["shotAt"]) != job.shot_at else job.shot_source,
        }
        STORE.add_swing(rec)
        job.rec_id = rec_id
        job.status = "saved"
        job.message = f"{len(swings)}球を記録しました"
        cleanup_job(job)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        job.status = "ready"
        job.message = f"保存できませんでした: {e}"


def cleanup_job(job):
    shutil.rmtree(job.dir, ignore_errors=True)
    if job.uploaded:
        job.src.unlink(missing_ok=True)


def cleanup_old_jobs():
    """前回の起動で残った作業用ファイルを消す。"""
    for d in (JOBS_DIR, UPLOAD_DIR):
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True, exist_ok=True)


# ---------- AI 分析 ----------

ANALYSES = {}  # 記録ID → {status, text, message, cancel}


def run_analysis(rec_id, only_clip=None):
    """記録の球をまとめて分析する。only_clip を渡すと、その1球だけを分析して、その球に書き込む。"""
    import ai  # google-genai が入っていなくても他の機能は動くように、使うときに読み込む

    entry = ANALYSES[rec_id]
    try:
        rec = STORE.find_swing(rec_id)
        if not rec:
            raise ai.AnalysisError("記録が見つかりません。")
        swings = rec["swings"]
        if only_clip:
            swings = [sw for sw in rec["swings"] if sw.get("clip") == only_clip]
            if not swings:
                raise ai.AnalysisError("その球は見つかりません。")
        labels = [label for _, label in video.PHASES]
        images, used, per_swing = [], 0, []
        for sw in swings:
            grids = video.grid_images(DATA_DIR / sw["sprite"], labels)
            set_ = grids + [video.trail_image(DATA_DIR / sw["trail"])]  # プロンプトの説明 (青→赤) と合う元の軌道画像
            face = (sw.get("pose") or {}).get("faceImage")
            if face and (DATA_DIR / face.split("?")[0]).exists():
                set_.append((DATA_DIR / face.split("?")[0]).read_bytes())
            if len(images) + len(set_) > MAX_AI_IMAGES:
                break
            images += set_
            used += 1
            if used == 1:
                per_swing = [f"コマ画像（{g * 8 + 1}〜{min(len(labels), g * 8 + 8)}コマ目）" for g in range(len(grids))]
                per_swing.append("クラブ軌道画像")
                if len(set_) > len(grids) + 1:
                    per_swing.append("手元の拡大画像（テークバックの3コマ。フェースの向きを見る用）")
        measurements = []
        for i, sw in enumerate(swings[:used]):
            items = (sw.get("pose") or {}).get("items") or []
            parts = [f"{it['label']} {it['display']}{it.get('grade') or ''}" for it in items]
            if sw.get("flight") in FLIGHTS:
                parts.insert(0, f"本人が記録した弾道: {FLIGHTS[sw['flight']]}")
            elif (sw.get("ballAuto") or {}).get("label") in FLIGHTS:
                parts.insert(0, f"動画から自動で読んだ弾道（目安）: {FLIGHTS[sw['ballAuto']['label']]}")
            if parts:
                measurements.append(f"{i + 1}球目: " + "、".join(parts))
        prompt = ai.build_prompt(rec, used, per_swing, labels, video.TRAIL_FROM, video.TRAIL_TO,
                                 CLUB_NAMES.get(rec.get("club"), rec.get("club")), measurements, coach_summary(), focus_text(), scoring_text())
        entry["message"] = f"AIが{used}球を分析しています…（30秒〜1分ほど）"

        def on_text(text):
            entry["text"] = ai.split_scores(text)[0]  # 点数の JSON は画面に出さない
            entry["message"] = ""

        text, truncated = ai.analyze(gemini_key(), CONFIG.get("gemini_model") or ai.DEFAULT_MODEL,
                                     prompt, images, on_text, lambda: entry["cancel"])
        if entry["cancel"]:
            entry.update(status="cancelled", message="中止しました。")
            return
        text, scores = ai.split_scores(text)
        if not only_clip:
            STORE.update_swing(rec_id, text=text, analyzedAt=int(time.time() * 1000))
        if not scores and not truncated:
            entry["message"] = "点数を付けています…"
            try:
                scores = ai.scores_from_text(gemini_key(), CONFIG.get("gemini_model") or ai.DEFAULT_MODEL,
                                             text, used, measurements)
            except ai.AnalysisError:
                scores = None
        if only_clip:
            STORE.set_swing_analysis(rec_id, only_clip, text, scores[0] if scores else None)
            entry.update(status="done", text=text, message="途中で切れています。" if truncated else "")
            return
        if scores:
            STORE.set_scores(rec_id, scores)
        note = "途中で切れています。" if truncated else (
            f"画像の上限のため、最初の{used}球を分析しました。" if used < len(rec["swings"]) else "")
        entry.update(status="done", text=text, message=note)
    except Exception as e:  # noqa: BLE001
        if e.__class__.__name__ != "AnalysisError":
            traceback.print_exc()
        entry.update(status="error", message=str(e) or "うまく分析できませんでした。")


# ---------- 記録から学習 (Claude Code) ----------

COACH = {"status": "none", "message": ""}


def coach_engine():
    """コーチのメモを作るのに使う AI。Claude Code が入っていればそれ、なければ Gemini。"""
    import coach
    if coach.has_cli(CONFIG.get("claude_cmd") or "claude"):
        return "claude"
    return "gemini" if gemini_key() else ""


def run_learn():
    import coach
    try:
        engine = coach_engine()
        if engine == "claude":
            res = coach.learn(STORE.snapshot(), CLUB_NAMES, CONFIG.get("claude_cmd") or "claude",
                              CONFIG.get("claude_model") or coach.DEFAULT_MODEL)
        elif engine == "gemini":
            res = coach.learn_gemini(STORE.snapshot(), CLUB_NAMES, gemini_key(), CONFIG.get("gemini_model") or "")
        else:
            raise coach.CoachError("学習するには、Gemini の API キー（設定タブ）か、Claude Code が必要です。")
        with STORE.lock:
            STORE.state["coach"] = {**res, "updatedAt": int(time.time() * 1000)}
            STORE._write()
        COACH.update(status="done", message=f"{res['swings']}球の記録から、コーチのメモを書き直しました。")
    except Exception as e:  # noqa: BLE001
        if e.__class__.__name__ != "CoachError":
            traceback.print_exc()
        COACH.update(status="error", message=str(e) or "学習できませんでした。")


# 本人が選んだ苦手 (pc/static/app.js の FOCUS_OPTIONS と同じ)
FOCUS_LABELS = {"rise": "体が起きる", "hip": "お尻が前に出る", "head": "頭が動く", "arm": "左腕が曲がる",
                "tempo": "打ち急ぐ（テンポ）", "setup": "アドレスの前傾が浅い・深い", "finish": "フィニッシュで体重が残る"}


def focus_text(st=None):
    f = ((st or (STORE.snapshot() if STORE else {})).get("focus")) or {}
    parts = [FOCUS_LABELS[i] for i in f.get("ids") or [] if i in FOCUS_LABELS]
    if f.get("text"):
        parts.append(str(f["text"])[:200])
    return "、".join(parts)


def scoring_text(st=None):
    """本人の印 (お手本・悪い例・弾道) に合わせて学習した、項目ごとの重み。AI に伝える。"""
    sc = ((st or (STORE.snapshot() if STORE else {})).get("scoring")) or {}
    w = sc.get("weights") or {}
    labels = sc.get("labels") or {}
    up = [labels.get(k, k) for k, v in sorted(w.items(), key=lambda x: -x[1]) if v > 1]
    down = [labels.get(k, k) for k, v in w.items() if v < 1]
    parts = []
    if up:
        parts.append("本人の評価と合いやすい（重視する）項目: " + "、".join(up))
    if down:
        parts.append("本人の評価とあまり関係ない項目: " + "、".join(down))
    return "。".join(parts)


def coach_summary():
    return ((STORE.snapshot().get("coach") or {}).get("summary") or "") if STORE else ""


def view_crop(rec_id, clip):
    """コマ送りで大きく見るための、人のまわりの範囲 (切り出し動画に対する割合)。一度調べたら記録に残す。

    新しい記録は切り出し動画がもう人のまわりなので None。前の記録で人が小さく写っているときだけ範囲を返す。
    """
    rec = STORE.find_swing(rec_id)
    i = STORE.find_swing_item(rec, clip) if rec else -1
    if i < 0:
        raise ValueError("その球は見つかりません")
    sw = rec["swings"][i]
    if sw.get("crop") or "viewCrop" in sw:
        return sw.get("viewCrop")
    crop = None
    if not pose_problem():
        try:
            import pose
            duration, _, _ = video.probe(DATA_DIR / clip)
            crop = pose.person_crop(DATA_DIR / clip, float(sw.get("clipOffset") or 2.5), duration, DATA_DIR / "models")
        except Exception:  # noqa: BLE001
            traceback.print_exc()
            return None  # 次に開いたときにもう一度調べる
    with STORE.lock:
        sw["viewCrop"] = list(crop) if crop else None
        STORE._write()
    return sw["viewCrop"]


def pose_lines(sw):
    items = (sw.get("pose") or {}).get("items") or []
    return "、".join(f"{it['label']} {it['display']}" for it in items)


def score_record(rec_id):
    """分析の文章はあるのに点数がない記録に、文章から点数を付ける。"""
    import ai
    rec = STORE.find_swing(rec_id)
    if not rec:
        raise ValueError("記録が見つかりません")
    if not rec.get("text"):
        raise ValueError("先に AI 分析をしてください")
    if not gemini_key():
        raise ValueError("Gemini の API キーが必要です。設定タブで入力してください。")
    measurements = [f"{i + 1}球目: {pose_lines(sw)}" for i, sw in enumerate(rec["swings"]) if pose_lines(sw)]
    try:
        scores = ai.scores_from_text(gemini_key(), CONFIG.get("gemini_model") or ai.DEFAULT_MODEL,
                                     rec["text"], len(rec["swings"]), measurements)
    except ai.AnalysisError as e:
        raise ValueError(str(e)) from e
    if not scores:
        raise ValueError("点数を読み取れませんでした。もう一度お試しください。")
    STORE.set_scores(rec_id, scores)
    return {"ok": True}


def day_of(ms):
    return time.strftime("%Y-%m-%d", time.localtime(ms / 1000))


def swing_lines_for_day(day):
    lines = []
    recs = sorted((r for r in STORE.snapshot()["swings"] if day_of(r.get("shotAt") or r.get("at") or 0) == day),
                  key=lambda r: r.get("shotAt") or r.get("at") or 0)
    for rec in recs:
        head = time.strftime("%H:%M", time.localtime((rec.get("shotAt") or rec.get("at")) / 1000))
        club = CLUB_NAMES.get(rec.get("club"), rec.get("club"))
        lines.append(f"■ {head} {club}（{rec.get('angle') or '向き不明'}・{len(rec.get('swings') or [])}球）"
                     + (f" 意識したこと: {rec['concern']}" if rec.get("concern") else ""))
        for i, sw in enumerate(rec.get("swings") or []):
            parts = [f"{i + 1}球目"]
            if sw.get("score") is not None:
                parts.append(f"{sw['score']}点")
            if sw.get("aiNote"):
                parts.append(sw["aiNote"])
            if sw.get("mark") == "good":
                parts.append("本人がお手本に指定")
            elif sw.get("mark") == "bad":
                parts.append("本人が悪い例に指定")
            if sw.get("flight") in FLIGHTS:
                parts.append(f"弾道: {FLIGHTS[sw['flight']]}")
            if pose_lines(sw):
                parts.append(f"計測: {pose_lines(sw)}")
            lines.append("- " + " / ".join(parts))
        if rec.get("text"):
            lines.append("  分析の要点: " + re.sub(r"\s+", " ", rec["text"])[:600])
    return lines


def organize_note(note_id, tendency=()):
    import ai
    st = STORE.snapshot()
    note = next((x for x in st["notes"] if str(x.get("id")) == str(note_id)), None)
    if not note:
        raise ValueError("ノートが見つかりません")
    if not gemini_key():
        raise ValueError("AI で整理するには Gemini の API キーが必要です。設定タブで入力してください。")
    y, mo, d = (int(x) for x in note["day"].split("-"))
    try:
        text = ai.organize_note(gemini_key(), CONFIG.get("gemini_model") or ai.DEFAULT_MODEL, note.get("memo") or "",
                                f"{y}年{mo}月{d}日", swing_lines_for_day(note["day"]),
                                [str(x)[:200] for x in tendency][:8] + ([f"コーチのメモ（これまでの記録から）: {coach_summary()}"] if coach_summary() else []),
                                (st.get("theme") or {}).get("text"))
    except ai.AnalysisError as e:
        raise ValueError(str(e)) from e
    text, feels = ai.split_feels(text)
    added = 0
    with STORE.lock:
        for x in STORE.state["notes"]:
            if str(x.get("id")) == str(note_id):
                x["text"] = text
                x["organizedAt"] = int(time.time() * 1000)
        # メモから拾った「つかんだ感覚」を感覚ノートに足す (同じ言葉は足さない)
        have = {re.sub(r"\s", "", f.get("phrase", "")) for f in STORE.state.setdefault("feels", [])}
        for i, f in enumerate(feels):
            key = re.sub(r"\s", "", f["phrase"])
            if key in have:
                continue
            have.add(key)
            STORE.state["feels"].insert(0, {**f, "id": f"f{int(time.time() * 1000)}{i}", "day": note["day"],
                                            "source": "note", "at": int(time.time() * 1000)})
            added += 1
        STORE._write()
    return {"ok": True, "text": text, "feelsAdded": added}


# ---------- HTTP ----------

def safe_join(base, rel):
    """base の外に出るパスを拒む。"""
    target = (base / rel).resolve()
    if base.resolve() not in target.parents and target != base.resolve():
        raise PermissionError(rel)
    return target


class Handler(BaseHTTPRequestHandler):
    server_version = "GolfNote/1.0"

    def log_message(self, fmt, *args):  # アクセスログは出さない
        pass

    # --- 返信 ---
    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json({"error": message}, status)

    def send_file(self, path, cache="no-cache"):
        if not path.is_file():
            return self.send_error_json(404, "見つかりません")
        size = path.stat().st_size
        ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if path.suffix == ".webmanifest":
            ctype = "application/manifest+json"
        start, end = 0, size - 1
        rng = self.headers.get("Range")
        status = 200
        if rng:
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                    if m.group(2):
                        end = min(int(m.group(2)), size - 1)
                elif m.group(2):
                    start = max(0, size - int(m.group(2)))
                if start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return None
                status = 206
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", cache)
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = f.read(min(1 << 20, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return None
                remaining -= len(chunk)
        return None

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length) or b"{}")

    # --- 振り分け ---
    def do_GET(self):
        self.handle_safely(self.route_get)

    def do_POST(self):
        self.handle_safely(self.route_post)

    def do_PUT(self):
        self.handle_safely(self.route_put)

    def handle_safely(self, fn):
        try:
            fn(urlparse(self.path))
        except PermissionError:
            self.send_error_json(403, "そのファイルは開けません")
        except (ValueError, KeyError) as e:
            self.send_error_json(400, str(e))
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            self.send_error_json(500, f"サーバーでエラーが起きました: {e}")

    def route_get(self, url):
        path = unquote(url.path)
        if path == "/api/state":
            st = STORE.snapshot()
            st["config"] = {
                "hasApiKey": bool(gemini_key()),
                "model": CONFIG.get("gemini_model") or "",
                "inboxDir": str(inbox_dir()),
                "dataDir": str(DATA_DIR),
                "heightCm": CONFIG.get("height_cm") or 170,
                "lefty": bool(CONFIG.get("lefty")),
                "poseProblem": POSE_PROBLEM,
                "claudeCmd": CONFIG.get("claude_cmd") or "claude",
                "claudeModel": CONFIG.get("claude_model") or "sonnet",
                "version": APP_VERSION,
                "hasGithubToken": update_token_ok(),
                "publicUpdates": updater.PUBLIC,
                "coachEngine": coach_engine(),
                "setupDone": bool(CONFIG.get("setup_done")),
                "lanUrl": lan_url(),
                "lanAccess": CONFIG.get("host") == "0.0.0.0",
                "launcher": bool(os.environ.get("GOLF_LAUNCHER")),
            }
            return self.send_json(st)
        if path == "/api/update":
            if not update_token_ok():
                return self.send_json({"current": APP_VERSION, "latest": None})
            try:
                return self.send_json({"current": APP_VERSION, "latest": updater.latest_version(CONFIG["github_token"])})
            except updater.UpdateError as e:
                return self.send_error_json(400, str(e))
        if path == "/api/coach":
            return self.send_json(COACH)
        if path == "/api/check":
            fp = (parse_qs(url.query).get("fp") or [""])[0]
            return self.send_json({"duplicate": find_duplicate(fp=fp) if fp else None})
        if path == "/api/inbox":
            return self.send_json({"dir": str(inbox_dir()), "files": list_inbox()})
        m = re.fullmatch(r"/api/jobs/(\w+)", path)
        if m:
            job = JOBS.get(m.group(1))
            return self.send_json(job.public()) if job else self.send_error_json(404, "処理が見つかりません")
        m = re.fullmatch(r"/api/swings/(\w+)/pose", path)
        if m:
            e = POSES.get(m.group(1))
            return self.send_json(e if e else {"status": "none", "message": ""})
        m = re.fullmatch(r"/api/swings/(\w+)/analysis", path)
        if m:
            e = ANALYSES.get(m.group(1))
            if not e:
                return self.send_json({"status": "none"})
            return self.send_json({k: e.get(k) for k in ("status", "text", "message", "only")})
        if path.startswith("/media/"):
            return self.send_file(safe_join(MEDIA_DIR, path[len("/media/"):]), cache="max-age=31536000, immutable")
        m = re.fullmatch(r"/jobs/(\w+)/([\w.]+)", path)
        if m:
            job = JOBS.get(m.group(1))
            if not job:
                return self.send_error_json(404, "見つかりません")
            if m.group(2) == "proxy.mp4" and job.proxy_src:
                return self.send_file(job.proxy_src)
            return self.send_file(safe_join(job.dir, m.group(2)))
        rel = "index.html" if path in ("/", "") else path.lstrip("/")
        return self.send_file(safe_join(STATIC_DIR, rel))

    def route_put(self, url):
        if url.path != "/api/upload":
            return self.send_error_json(404, "見つかりません")
        query = parse_qs(url.query)
        name = (query.get("name") or ["video.mp4"])[0]
        try:
            last_modified = int(query.get("lastModified", ["0"])[0]) or None
        except ValueError:
            last_modified = None
        ext = Path(name).suffix.lower()
        if ext not in VIDEO_EXTS:
            return self.send_error_json(400, "動画ファイルを選んでください")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return self.send_error_json(400, "ファイルが空です")
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        dst = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
        remaining = length
        with open(dst, "wb") as f:
            while remaining > 0:
                chunk = self.rfile.read(min(1 << 20, remaining))
                if not chunk:
                    break
                f.write(chunk)
                remaining -= len(chunk)
        if remaining > 0:
            dst.unlink(missing_ok=True)
            return self.send_error_json(400, "アップロードが途中で切れました。もう一度お試しください。")
        return self.send_json(start_job(dst, Path(name).name, uploaded=True, file_time=last_modified))

    def route_post(self, url):
        path = url.path
        body = self.read_json()
        if path == "/api/save":
            STORE.apply(body["kind"], body.get("item"))
            return self.send_json({"ok": True})
        if path == "/api/replace":
            STORE.replace(body["state"])
            return self.send_json({"ok": True})
        if path == "/api/config":
            if "apiKey" in body:
                CONFIG["gemini_api_key"] = body["apiKey"].strip()
            if "heightCm" in body:
                h = float(body["heightCm"])
                if not 100 <= h <= 230:
                    return self.send_error_json(400, "身長は 100〜230cm で入力してください")
                CONFIG["height_cm"] = h
            if "lefty" in body:
                CONFIG["lefty"] = bool(body["lefty"])
            if "model" in body:
                CONFIG["gemini_model"] = body["model"].strip()
            if "claudeCmd" in body:
                CONFIG["claude_cmd"] = body["claudeCmd"].strip() or "claude"
            if "claudeModel" in body:
                CONFIG["claude_model"] = body["claudeModel"].strip() or "sonnet"
            if "setupDone" in body:
                CONFIG["setup_done"] = bool(body["setupDone"])
            restart = False
            if "lanAccess" in body:
                host = "0.0.0.0" if body["lanAccess"] else "127.0.0.1"
                restart = host != CONFIG.get("host")
                CONFIG["host"] = host
            if "githubToken" in body:
                CONFIG["github_token"] = body["githubToken"].strip()
            if "inboxDir" in body:
                d = body["inboxDir"].strip()
                if d and not Path(d).expanduser().is_dir():
                    return self.send_error_json(400, "そのフォルダは見つかりません")
                CONFIG["inbox_dir"] = d
            save_config(CONFIG)
            if restart and os.environ.get("GOLF_LAUNCHER"):
                self.send_json({"ok": True, "restart": True})
                threading.Timer(1.0, lambda: os._exit(RESTART_CODE)).start()
                return None
            return self.send_json({"ok": True, "restart": restart})
        if path == "/api/update":
            if not update_token_ok():
                return self.send_error_json(400, "先に設定タブで GitHub のトークンを入れてください。")
            if not os.environ.get("GOLF_LAUNCHER"):
                return self.send_error_json(400, "この起動のしかたでは自動で起動し直せません。一度だけ、新しい start.bat で起動し直してください。")
            busy = [j for j in list(ANALYSES.values()) + list(POSES.values()) if j.get("status") == "running"]
            if busy or any(j.status in ("detecting", "saving") for j in JOBS.values()):
                return self.send_error_json(400, "分析・計測・動画の読み込みの途中です。終わってから更新してください。")
            try:
                res = updater.apply(CONFIG["github_token"], APP_DIR)
            except updater.UpdateError as e:
                return self.send_error_json(400, str(e))
            print(f"新しい版を入れました（{res['written']} 個のファイル）。起動し直します…")
            self.send_json({"ok": True, **res})
            threading.Timer(1.0, lambda: os._exit(RESTART_CODE)).start()
            return None
        if path == "/api/inbox/open":
            src = safe_join(inbox_dir(), body["name"])
            if not src.is_file():
                return self.send_error_json(404, "ファイルが見つかりません")
            return self.send_json(start_job(src, src.name, uploaded=False,
                                            file_time=int(src.stat().st_mtime * 1000)))
        m = re.fullmatch(r"/api/jobs/(\w+)/(thumb|save|discard)", path)
        if m:
            job = JOBS.get(m.group(1))
            if not job:
                return self.send_error_json(404, "処理が見つかりません。動画を選び直してください。")
            if m.group(2) == "thumb":
                t = min(max(0.0, float(body["t"])), max(0.0, job.duration - 0.05))
                return self.send_json({"t": t, "thumb": thumb_for(job, t)})
            if m.group(2) == "discard":
                JOBS.pop(job.id, None)
                cleanup_job(job)
                return self.send_json({"ok": True})
            if job.status not in ("ready",):
                return self.send_error_json(409, "まだ準備中です")
            if not body.get("impacts"):
                return self.send_error_json(400, "記録するスイングを選んでください")
            job.status = "saving"
            job.message = "保存を始めます…"
            threading.Thread(target=run_save, args=(job, body), daemon=True).start()
            return self.send_json(job.public())
        if path == "/api/coach/learn":
            if COACH.get("status") != "running":
                name = {"claude": "Claude", "gemini": "Gemini"}.get(coach_engine(), "AI")
                COACH.update(status="running", message=f"{name} が記録を読んでいます…（1〜3分ほど）")
                threading.Thread(target=run_learn, daemon=True).start()
            return self.send_json({"ok": True})
        m = re.fullmatch(r"/api/swings/(\w+)/viewcrop", path)
        if m:
            return self.send_json({"crop": view_crop(m.group(1), body.get("clip"))})
        m = re.fullmatch(r"/api/swings/(\w+)/score", path)
        if m:
            return self.send_json(score_record(m.group(1)))
        m = re.fullmatch(r"/api/notes/(\w+)/organize", path)
        if m:
            return self.send_json(organize_note(m.group(1), body.get("tendency") or []))
        m = re.fullmatch(r"/api/swings/(\w+)/pose", path)
        if m:
            rec_id = m.group(1)
            if POSES.get(rec_id, {}).get("status") != "running":
                POSES[rec_id] = {"status": "running", "message": "姿勢を測る準備をしています…"}
                if rec_id == "_all":
                    threading.Thread(target=run_pose_all, args=(bool(body.get("retry")), bool(body.get("all"))),
                                     daemon=True).start()
                else:
                    threading.Thread(target=run_pose, args=(rec_id,), daemon=True).start()
            return self.send_json({"ok": True})
        m = re.fullmatch(r"/api/swings/(\w+)/(analyze|cancel)", path)
        if m:
            rec_id = m.group(1)
            if m.group(2) == "cancel":
                if rec_id in ANALYSES:
                    ANALYSES[rec_id]["cancel"] = True
                return self.send_json({"ok": True})
            if ANALYSES.get(rec_id, {}).get("status") == "running":
                return self.send_json({"ok": True})
            if not gemini_key():
                return self.send_error_json(400, "AI 分析には Gemini の API キーが必要です。設定タブで入力してください。")
            only = body.get("clip") or None
            ANALYSES[rec_id] = {"status": "running", "text": "", "message": "コマを準備しています…", "cancel": False,
                                "only": only}
            threading.Thread(target=run_analysis, args=(rec_id, only), daemon=True).start()
            return self.send_json({"ok": True})
        return self.send_error_json(404, "見つかりません")


def start_job(src, name, uploaded, file_time=None):
    job = Job(src, name, uploaded, file_time)
    JOBS[job.id] = job
    threading.Thread(target=run_detect, args=(job,), daemon=True).start()
    return job.public()


def list_inbox():
    d = inbox_dir()
    if not d.is_dir():
        return []
    done = {rec.get("fileName") for rec in STORE.snapshot()["swings"]}
    files = []
    for f in d.iterdir():
        if f.is_file() and f.suffix.lower() in VIDEO_EXTS:
            st = f.stat()
            files.append({"name": f.name, "size": st.st_size, "mtime": int(st.st_mtime * 1000),
                          "done": f.name in done})
    return sorted(files, key=lambda x: -x["mtime"])


def update_token_ok():
    """更新を確かめられるか (配布版は公開リポジトリなのでトークンは要らない)。"""
    return updater.PUBLIC or bool(CONFIG.get("github_token"))


def lan_ip():
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("192.168.0.1", 9))  # 実際には送らない。外向きに使う IP を知るため
            return s.getsockname()[0]
    except OSError:
        return ""


def lan_url():
    """同じ Wi-Fi のスマホから開く URL (スマホから使う設定のときだけ)。"""
    if CONFIG.get("host") != "0.0.0.0":
        return ""
    ip = lan_ip()
    return f"http://{ip}:{CONFIG['port']}/" if ip else ""


def main():
    global STORE, POSE_PROBLEM
    if not video.setup_ffmpeg():
        print("ffmpeg が見つかりません。コマンドプロンプトで  winget install Gyan.FFmpeg  を実行し、")
        print("パソコンを再起動してからもう一度起動してください。")
        input("Enter キーで終了します")
        return
    if not CONFIG_PATH.exists():
        save_config(CONFIG)
    for d in (DATA_DIR, MEDIA_DIR):
        d.mkdir(parents=True, exist_ok=True)
    inbox_dir().mkdir(parents=True, exist_ok=True)
    cleanup_old_jobs()
    STORE = Store(DATA_DIR / "db.json")
    POSE_PROBLEM = pose_problem()
    # まだ姿勢を測っていない記録があれば、起動したら裏で測っておく (AIは使わない)
    if not POSE_PROBLEM and any(any("pose" not in sw for sw in r.get("swings") or [])
                                for r in STORE.snapshot()["swings"]):
        POSES["_all"] = {"status": "running", "message": "まだ測っていない記録の姿勢を測っています…"}
        threading.Thread(target=run_pose_all, daemon=True).start()
    host, port = CONFIG["host"], int(CONFIG["port"])
    httpd = ThreadingHTTPServer((host, port), Handler)
    httpd.daemon_threads = True
    url = f"http://localhost:{port}/"
    print("ゴルフ練習ノートを起動しました。")
    print(f"  このパソコンから: {url}")
    if lan_url():
        print(f"  スマホから（同じ Wi-Fi）: {lan_url()}")
    else:
        print(f"  スマホから: 設定タブの「スマホから使う」をオンにするか、Tailscale を使ってください (詳しくは README)")
    print(f"  データの保存先: {DATA_DIR}")
    print(f"  取り込みフォルダ: {inbox_dir()}")
    print("  姿勢の計測: " + ("使えます" if not POSE_PROBLEM else POSE_PROBLEM))
    print("止めるときは、この画面を閉じてください。")
    if CONFIG.get("open_browser", True) and not os.environ.get("GOLF_NO_BROWSER"):
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


STORE = None
POSE_PROBLEM = ""

if __name__ == "__main__":
    main()
