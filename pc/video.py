"""動画まわりの処理: インパクト検出、コマ画像、クラブ軌道画像、切り出し。

ffmpeg / ffprobe を外部コマンドとして呼び出し、画素の計算は numpy、
画像の組み立ては Pillow で行う。
"""

import io
import os
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# インパクトを0秒としたときの切り出し位置(秒)と、だいたいの局面 (アプリの PHASE_SETS[2] と同じ)
PHASES = [
    (-2.0, "アドレス"),
    (-1.6, "始動"),
    (-1.3, "テイクバック"),
    (-1.0, "バックスイング"),
    (-0.75, "トップ手前"),
    (-0.55, "トップ付近"),
    (-0.4, "切り返し"),
    (-0.27, "ダウン前半"),
    (-0.15, "ダウン後半"),
    (-0.07, "インパクト直前"),
    (0.0, "インパクト"),
    (0.07, "インパクト直後"),
    (0.2, "フォロー"),
    (0.4, "フォロースルー"),
    (0.7, "フィニッシュ手前"),
    (1.1, "フィニッシュ"),
]
PHASE_VERSION = 2
TRAIL_FROM = -0.6  # クラブ軌道画像に重ねる範囲 (インパクトからの秒)
TRAIL_TO = 0.4
CLIP_BEFORE = 2.5  # 1球ぶんの動画として残す範囲
CLIP_AFTER = 1.5
FPS = 30
SPRITE_HEIGHT = 640
AUDIO_RATE = 16000

NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)  # Windows で黒い窓を出さない


# ---------- ffmpeg ----------

def setup_ffmpeg():
    """ffmpeg を探す。winget で入れた直後は PATH に載っていないことがあるので、その場所も見る。"""
    if shutil.which("ffmpeg") and shutil.which("ffprobe"):
        return True
    candidates = []
    local = os.environ.get("LOCALAPPDATA")
    if local:
        winget = Path(local) / "Microsoft" / "WinGet"
        candidates.append(winget / "Links")
        candidates += sorted((winget / "Packages").glob("*FFmpeg*/*/bin"), reverse=True)
    for base in (os.environ.get("ProgramFiles"), "C:/ffmpeg"):
        if base:
            candidates += [Path(base) / "ffmpeg" / "bin", Path(base) / "bin"]
    for d in candidates:
        if (d / "ffmpeg.exe").exists() and (d / "ffprobe.exe").exists():
            os.environ["PATH"] = str(d) + os.pathsep + os.environ.get("PATH", "")
            return True
    return bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def _run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, check=False, creationflags=NO_WINDOW, **kw)


def _parse_time(value):
    """動画に書かれた撮影日時 (ISO 形式) をミリ秒に。読めなければ None。"""
    from datetime import datetime, timezone
    value = value.strip()
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:  # タイムゾーンの書かれていないものは UTC として扱う (Android の creation_time など)
        dt = dt.replace(tzinfo=timezone.utc)
    if dt.year < 2005:  # 時計が未設定の機器は 1904 年や 1970 年になる
        return None
    return int(dt.timestamp() * 1000)


def probe(path):
    """長さ(秒)・音声の有無・撮影開始日時(ミリ秒, 分からなければ None)を返す。"""
    out = _run(["ffprobe", "-v", "error", "-show_entries",
                "format=duration:stream=codec_type:format_tags=creation_time,com.apple.quicktime.creationdate"
                ":stream_tags=creation_time",
                "-of", "default=noprint_wrappers=1", str(path)], text=True).stdout
    duration = 0.0
    audio = False
    created = {}
    for line in out.splitlines():
        key, _, value = line.partition("=")
        if key == "duration":
            try:
                duration = float(value)
            except ValueError:
                pass
        elif line.strip() == "codec_type=audio":
            audio = True
        elif key.startswith("TAG:"):
            created[key[4:]] = value
    # iPhone の creationdate は撮影開始時刻 (タイムゾーン付き)。creation_time は機種によって終了時刻のことがある
    apple = _parse_time(created.get("com.apple.quicktime.creationdate", ""))
    return duration, audio, {"apple": apple, "creation": _parse_time(created.get("creation_time", ""))}


def time_from_name(name):
    """ファイル名に入っている撮影日時 (PXL_20261010_221930123.mp4, VID_20261010_221930.mp4 など) を読む。

    ファイル名の時刻はそのパソコンの時刻 (日本時間など) として扱う。読めなければ None。
    """
    import re
    from datetime import datetime
    m = re.search(r"(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})[-_ T.]?(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2})", name)
    if not m:
        return None
    try:
        dt = datetime(*map(int, m.groups()))
    except ValueError:
        return None
    return int(dt.timestamp() * 1000)


def choose_shot_time(meta, name, file_time, now_ms):
    """撮影日時の候補から1つ選ぶ。戻り値は (ミリ秒, 出どころ)。

    出どころ: "meta" (動画の情報) / "name" (ファイル名) / "file" (ファイルの日付) / "upload" (取り込んだ時刻)。
    動画の情報の時刻が「今」に近すぎるときは、保存し直したときに書き換わった時刻とみなし、ファイル名を優先する。
    """
    from_name = time_from_name(name or "")
    if meta.get("apple"):
        return meta["apple"], "meta"
    creation = meta.get("creation")
    if creation and not (from_name and abs(now_ms - creation) < 30 * 60 * 1000):
        return creation, "meta"
    if from_name:
        return from_name, "name"
    if file_time and abs(now_ms - file_time) > 30 * 60 * 1000:
        return file_time, "file"
    return file_time or now_ms, "upload"


# ---------- インパクト検出 ----------

def read_audio(path):
    proc = _run(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1",
                 "-ar", str(AUDIO_RATE), "-f", "s16le", "-"])
    if proc.returncode != 0 or not proc.stdout:
        return None
    return np.frombuffer(proc.stdout[: len(proc.stdout) // 2 * 2], dtype="<i2")


def find_impacts(samples, min_gap=3.0):
    """10ms ごとの音量の山のうち、直前より急に大きくなった「パシッ」という音を拾う。

    ブラウザ版 (findImpactTimes) と同じ考え方。
    """
    win = AUDIO_RATE // 100
    n = len(samples) // win
    if n < 40:
        return []
    env = np.abs(samples[: n * win].astype(np.int32)).reshape(n, win).max(axis=1) / 32768.0
    median = float(np.median(env))
    loud = float(np.quantile(env, 0.998))
    thr = max(median * 5, loud * 0.3, 0.02)

    padded = np.pad(env, 10, mode="edge")
    local_max = np.lib.stride_tricks.sliding_window_view(padded, 21).max(axis=1)
    csum = np.concatenate([[0.0], np.cumsum(env)])
    hits = []
    for i in np.nonzero((env >= thr) & (env >= local_max))[0]:
        if i < 25 or i >= n - 10:
            continue
        before = (csum[i - 3] - csum[i - 25]) / 22
        if env[i] < before * 3:
            continue
        hits.append((i / 100.0, float(env[i])))

    picked = []
    for t, _ in sorted(hits, key=lambda h: -h[1]):
        if all(abs(t - p) > min_gap for p in picked):
            picked.append(t)
    return sorted(picked)


# ---------- 本当にスイングしたかを映像で確かめる ----------

MOTION_FPS = 15
MOTION_HEIGHT = 120


def _motion_maps(src, t, duration, crop=None):
    """インパクト候補の 2.4 秒前〜1.2 秒後を小さな白黒の画像で取り出し、コマごとの「動いた画素」を返す。

    夜の照明のちらつきで画面全体が明るさごと変わるので、コマごとの明るさの差は引いてから比べる。
    戻り値は (動いた画素の配列 (コマ数, 縦, 横) の bool, 各コマの時刻 (インパクトからの秒))。
    """
    start = max(0.0, t - 2.4)
    length = min(duration, t + 1.2) - start
    pre = crop_filter(crop) if crop else ""
    proc = _run(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{length:.3f}",
                 "-vf", f"fps={MOTION_FPS},{pre}scale=-2:{MOTION_HEIGHT}", "-f", "rawvideo", "-pix_fmt", "gray", "-"])
    first = frame_at(src, start, MOTION_HEIGHT)
    w = first.size[0] - first.size[0] % 2
    if crop:
        x0, y0, x1, y1 = crop
        w = round(MOTION_HEIGHT * first.size[0] * (x1 - x0) / (first.size[1] * (y1 - y0)))
        w -= w % 2
    size = w * MOTION_HEIGHT
    n = len(proc.stdout) // size if size else 0
    if n < 3:
        return None, None
    f = np.frombuffer(proc.stdout[: n * size], dtype=np.uint8).reshape(n, MOTION_HEIGHT, w).astype(np.float32)
    f -= np.median(f, axis=(1, 2), keepdims=True)  # 明るさのちらつきをならす
    moved = np.abs(np.diff(f, axis=0)) > 20
    times = start + (np.arange(1, n) / MOTION_FPS) - t
    return moved, times


def check_swings(src, times, duration, crop=None):
    """音で見つけたインパクト候補が、本当のスイングかを映像の動きで確かめる。

    戻り値は候補ごとの {"ok": bool, "reason": 理由, "score": 動きの大きさ}。
    - スイングしている人のまわり (どの候補でもいちばんよく動く場所) が、インパクト前後で動いているか
    - 画面全体が動いていないか (スマホを持ち上げた・向きを変えたなど)
    """
    maps = []
    for t in times:
        if t < 1.2:
            maps.append((None, None, "動画の最初すぎて、スイングが写っていません"))
            continue
        try:
            moved, rel = _motion_maps(src, t, duration, crop)
        except Exception:  # noqa: BLE001
            moved, rel = None, None
        maps.append((moved, rel, None if moved is not None else "映像を読み取れませんでした"))
    # スイングしている人のまわり: 候補のインパクト前後でよく動いた場所を足し合わせる
    acc = None
    for moved, rel, _ in maps:
        if moved is None:
            continue
        sel = moved[(rel >= -0.6) & (rel <= 0.4)]
        if not len(sel):
            continue
        m = sel.mean(axis=0)
        if m.mean() > 0.3:
            continue  # カメラが動いた候補は場所の手がかりにしない
        acc = m if acc is None else (acc + m if acc.shape == m.shape else acc)
    roi = None
    if acc is not None and acc.max() > 0:
        ys, xs = np.nonzero(acc >= acc.max() * 0.25)
        if len(xs) >= 10:
            x0, x1 = np.quantile(xs, [0.03, 0.97])
            y0, y1 = np.quantile(ys, [0.03, 0.97])
            px, py = (x1 - x0) * 0.25 + 3, (y1 - y0) * 0.25 + 3
            h, w = acc.shape
            roi = (int(max(0, x0 - px)), int(max(0, y0 - py)), int(min(w, x1 + px + 1)), int(min(h, y1 + py + 1)))
    results = []
    for moved, rel, reason in maps:
        if moved is None:
            results.append({"ok": False, "reason": reason, "score": 0.0})
            continue
        win = (rel >= -0.5) & (rel <= 0.35)
        whole = float(np.median(moved[win].mean(axis=(1, 2)))) if win.any() else 0.0
        if roi and moved.shape[1:] == acc.shape:
            x0, y0, x1, y1 = roi
            part = moved[:, y0:y1, x0:x1]
        else:
            part = moved
        series = part.mean(axis=(1, 2))
        score = float(series[win].max()) if win.any() else 0.0
        results.append({"ok": True, "reason": "", "score": round(score, 4), "whole": round(whole, 4)})
    # 本当のスイングの動きの大きさ (よく動いた候補の真ん中あたり) と比べて、小さすぎるものを外す
    good = sorted((r["score"] for r in results if r["ok"]), reverse=True)
    ref = float(np.median(good[: max(1, (len(good) + 1) // 2)])) if good else 0.0
    for r in results:
        if not r["ok"]:
            continue
        if r["whole"] > 0.3:
            r.update(ok=False, reason="画面全体が動いています（スマホを動かしたときの音かも）")
        elif r["score"] < 0.02 or (ref and r["score"] < ref * 0.25):
            r.update(ok=False, reason="体がほとんど動いていません（隣の打席の音かも）")
    return results


# ---------- 弾道 (試験版) ----------

def _blobs(mask, max_points=4000, max_size=60):
    """小さな白い点のかたまりの中心と大きさ。点が多すぎる (画面が大きく動いた) ときは空。"""
    ys, xs = np.nonzero(mask)
    if len(xs) == 0 or len(xs) > max_points:
        return []
    pts = set(zip(ys.tolist(), xs.tolist()))
    out = []
    while pts:
        stack = [pts.pop()]
        group = []
        while stack:
            y, x = stack.pop()
            group.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    q = (y + dy, x + dx)
                    if q in pts:
                        pts.remove(q)
                        stack.append(q)
        if len(group) <= max_size:
            gy, gx = np.mean(group, axis=0)
            out.append((float(gx), float(gy), len(group)))
    return out


def track_ball(src, t, duration, lefty=False, hint=None):
    """後方から撮った動画で、インパクト後に飛んでいくボールを追いかけて、弾道を推定する (試験版)。

    ボールは小さく明るい点として、コマごとに少しずつ上 (奥) へ動いていく。
    見つかった点を「上へ進み、左右の動きがなめらか」につなぎ、
    最初の向き (右/左へ出たか) と曲がり方 (右/左へ曲がったか) から弾道の名前を付ける。
    hint (アドレスの腰・手・足首の位置。元の動画に対する割合) があれば、ボールの置いてあった場所を
    「腰から見て手の先の側、足もとの高さ」に絞って探す (白い靴などをボールと間違えないように)。
    自信がないときは None。
    """
    start = t + 0.02
    end = min(duration - 0.02, t + 1.6)
    if end - start < 0.4:
        return None
    H = 960  # ボールは遠ざかるとすぐ小さくなるので、細かい画像で追う
    first = frame_at(src, start, H)
    w, h = first.size
    w -= w % 2

    def gray(at, length):
        p = _run(["ffmpeg", "-v", "error", "-ss", f"{max(0.0, at):.3f}", "-i", str(src), "-t", f"{length:.3f}",
                  "-vf", f"fps={FPS},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "gray", "-"])
        m = len(p.stdout) // (w * h)
        a = np.frombuffer(p.stdout[: m * w * h], dtype=np.uint8).reshape(m, h, w).astype(np.float32)
        return a - np.median(a, axis=(1, 2), keepdims=True) if m else a

    f = gray(start, end - start)
    n = len(f)
    if n < 8:
        return None
    # 打つ前にマットの上にあったボール: アドレスのころには白い点があり、打ったあとには消えている場所
    rest = None
    if t > 1.0:
        pre = gray(t - 1.0, 0.25)
        post = gray(t + 0.5, 0.1)
        if len(pre) and len(post):
            gone = (np.median(pre, axis=0) - post[0] > 25) & (np.median(pre, axis=0) > 10)
            spots = [b for b in _blobs(gone, 20000, 150) if 3 <= b[2] <= 120 and b[1] > h * 0.4]  # 1〜2 画素の点はざらつき
            if hint:
                hip_x, hands_x, foot_y = hint["hip_x"] * w, hint["hands_x"] * w, hint["foot_y"] * h
                side = 1 if hands_x >= hip_x else -1
                reach = abs(hands_x - hip_x)
                spots = [b for b in spots if (b[0] - hip_x) * side > reach * 0.8 and abs(b[1] - foot_y) < 0.08 * h]
                if spots:
                    # ボールは手よりさらにクラブの長さぶん先にあるので、いちばん先にある点にする
                    rest = max(spots, key=lambda b: (b[0] - hip_x) * side)
            elif spots:
                rest = max(spots, key=lambda b: b[1])  # いちばん下 (手前の足もと) にある点
            if hint and not rest:
                return None  # ボールの場所がわからないときは推定しない
    per_frame = []
    # ボールの置いてあった場所がわかれば、その上の縦長の範囲だけを調べる (速く、体の動きを拾いにくい)
    rx0, rx1, ry1 = 0, w, h
    if rest:
        rx0, rx1, ry1 = max(0, int(rest[0] - 0.3 * w)), min(w, int(rest[0] + 0.3 * w)), min(h, int(rest[1] + 0.03 * h))
    for k in range(1, n - 1):
        # 前後のコマより明るくなった小さな点 (ボールは背景より白い)。大きなかたまり (体やクラブ) は使わない
        a, p, q = f[k, :ry1, rx0:rx1], f[k - 1, :ry1, rx0:rx1], f[k + 1, :ry1, rx0:rx1]
        moved = (a - p > 20) & (a - q > 20) & (a > 10)
        per_frame.append([(x + rx0, y, sz) for x, y, sz in _blobs(moved, 20000, 150) if sz <= 120])
    # つなぐ: 上 (y が小さくなる方向) へ進む点を、近い順に貪欲につなぐ
    best = []
    for k0 in range(min(6, len(per_frame))):
        for p0 in per_frame[k0]:
            # ボールの置いてあった場所から飛び出した点だけを追う (腕やクラブの動きを追わないように)
            if rest and not (abs(p0[0] - rest[0]) < 0.06 * w and -0.02 * h < rest[1] - p0[1] < 0.3 * h):
                continue
            track = [(k0, p0)]
            for k in range(k0 + 1, len(per_frame)):
                lk, lp = track[-1]
                gap = k - lk
                if gap > 3:
                    break
                cands = [p for p in per_frame[k] if p[1] < lp[1] - 0.5 and abs(p[0] - lp[0]) < 0.06 * w * gap
                         and lp[1] - p[1] < 0.25 * h * gap]
                if len(track) >= 2:
                    (k1, p1), (k2, p2) = track[-2], track[-1]
                    vx, vy = (p2[0] - p1[0]) / (k2 - k1), (p2[1] - p1[1]) / (k2 - k1)
                    pred = (p2[0] + vx * gap, p2[1] + vy * gap)
                    cands = [p for p in cands if np.hypot(p[0] - pred[0], p[1] - pred[1]) < 0.05 * w + 3 * gap]
                    cands.sort(key=lambda p: np.hypot(p[0] - pred[0], p[1] - pred[1]))
                else:
                    cands.sort(key=lambda p: abs(p[0] - lp[0]))
                if cands:
                    track.append((k, cands[0]))
            if len(track) > len(best):
                best = track
    if len(best) < 6:
        return None
    xs = np.array([p[0] for _, p in best]) / w
    ys = np.array([p[1] for _, p in best]) / h
    rise = ys[0] - ys[-1]
    if rise < 0.08:
        return None
    # 高さ (どれだけ上がったか) に対する左右の位置を2次式で近似: 1次 = 出た向き、2次 = 曲がり方
    u = (ys[0] - ys) / rise
    c2, c1, _ = np.polyfit(u, xs - xs[0], 2)
    sign = -1 if lefty else 1   # 右打ちは右へ曲がるのがスライス
    start_dir = c1 * sign       # + なら右へ出た
    curve = c2 * sign           # + なら右へ曲がった
    short = len(best) < 15  # 追えたのが短いと、曲がりはまだ見えない (出だしの向きだけわかる)
    if short:
        label = "push" if start_dir > 0.05 else "pull" if start_dir < -0.05 else "straight"
        return {"label": label, "points": len(best), "start": round(float(start_dir), 3), "curve": None,
                "startOnly": True}
    if abs(start_dir) < 0.03 and abs(curve) < 0.035:
        label = "straight"
    elif curve > 0.07:
        label = "slice"
    elif curve < -0.07:
        label = "hook"
    elif curve > 0.035:
        label = "fade"
    elif curve < -0.035:
        label = "draw"
    elif start_dir > 0.05:
        label = "push"
    elif start_dir < -0.05:
        label = "pull"
    else:
        label = "straight"
    return {"label": label, "points": len(best), "start": round(float(start_dir), 3), "curve": round(float(curve), 3)}


# ---------- コマの取り出し ----------

def frame_at(path, t, height):
    """t 秒のコマを1枚、高さ height の画像で返す (回転情報は ffmpeg が反映する)。"""
    proc = _run(["ffmpeg", "-v", "error", "-ss", f"{max(0.0, t):.3f}", "-i", str(path),
                 "-frames:v", "1", "-vf", f"scale=-2:{height}", "-f", "image2pipe",
                 "-c:v", "png", "-"])
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError("コマを取り出せませんでした")
    return Image.open(io.BytesIO(proc.stdout)).convert("RGB")


def save_thumb(path, t, dst, height=200):
    frame_at(path, t, height).save(dst, "JPEG", quality=80)


def crop_filter(crop):
    """crop は元の動画に対する割合 (x0, y0, x1, y1)。ffmpeg の crop フィルタにする。"""
    x0, y0, x1, y1 = crop
    return f"crop=trunc(iw*{x1 - x0:.4f}/2)*2:trunc(ih*{y1 - y0:.4f}/2)*2:iw*{x0:.4f}:ih*{y0:.4f},"


def decode_range(path, start, duration, w, h, crop=None):
    """start 秒から duration 秒ぶんを 30fps の RGB 配列 (コマ数, h, w, 3) で返す。"""
    pre = crop_filter(crop) if crop else ""
    proc = _run(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-i", str(path),
                 "-t", f"{duration:.3f}", "-vf", f"fps={FPS},{pre}scale={w}:{h}",
                 "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
    size = w * h * 3
    count = len(proc.stdout) // size
    if count == 0:
        raise RuntimeError("動画を読み取れませんでした")
    return np.frombuffer(proc.stdout[: count * size], dtype=np.uint8).reshape(count, h, w, 3)


# ---------- 動画の書き出し ----------

def browser_playable(path):
    """ブラウザでそのまま再生できる動画か (MP4 の H.264・8bit・フルHDまで)。それなら再生用の動画を作らずに済む。"""
    if Path(path).suffix.lower() not in (".mp4", ".m4v"):
        return False
    out = _run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                "stream=codec_name,pix_fmt,width,height", "-of", "default=noprint_wrappers=1", str(path)], text=True).stdout
    info = dict(line.split("=", 1) for line in out.splitlines() if "=" in line)
    try:
        small = min(int(info.get("width", 0)), int(info.get("height", 0))) <= 1080
    except ValueError:
        small = False
    return info.get("codec_name") == "h264" and info.get("pix_fmt") in ("yuv420p", "yuvj420p") and small


def make_proxy(src, dst):
    """ブラウザで確実に再生できる軽い動画 (H.264, 高さ480まで) を作る。"""
    proc = _run(["ffmpeg", "-v", "error", "-y", "-i", str(src),
                 "-vf", "scale=-2:'min(480,ih)'", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "fastdecode",
                 "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k",
                 "-movflags", "+faststart", str(dst)])
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode(errors="replace")[-300:])


def cut_clip(src, dst, start, length, height=720, crop=None):
    pre = crop_filter(crop) if crop else ""
    proc = _run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-i", str(src),
                 "-t", f"{length:.3f}", "-vf", f"{pre}scale=-2:'min({height},ih)'",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dst)])
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode(errors="replace")[-300:])


# ---------- 文字 ----------

_FONT_CANDIDATES = [
    "C:/Windows/Fonts/meiryo.ttc", "C:/Windows/Fonts/YuGothM.ttc", "C:/Windows/Fonts/msgothic.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc", "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
]


def font(size):
    """日本語が書けるフォント。見つからなければ None (英数字だけで書く)。"""
    for p in _FONT_CANDIDATES:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
    return None


def draw_label(draw, xy, text, size, fallback):
    f = font(size)
    if f is None:
        text, f = fallback, ImageFont.load_default()
    x, y = xy
    pad = max(4, size // 4)
    box = draw.textbbox((x + pad, y + pad), text, font=f)
    draw.rectangle([x, y, box[2] + pad, box[3] + pad], fill=(0, 0, 0, 170))
    draw.text((x + pad, y + pad), text, font=f, fill=(255, 255, 255, 255))


# ---------- 1球ぶんの画像と動画 ----------

def _hue_rgb(h):
    def f(n):
        k = (n + h / 30) % 12
        return 255 * (0.5 - 0.5 * max(-1, min(k - 3, 9 - k, 1)))
    return np.array([f(0), f(8), f(4)], dtype=np.float32)


def _box_blur(a):
    """3x3 の平均でならす (夜のざらつきを消す)。縦と横に分けて足すので速い。"""
    p = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode="edge")
    h, w = a.shape[:2]
    rows = p[0:h] + p[1:h + 1] + p[2:h + 2]
    return (rows[:, 0:w] + rows[:, 1:w + 1] + rows[:, 2:w + 2]) / 9.0


# スイングの区切りごとの色 (時間で少しずつ変えるより、どこで通り道が変わったかが見やすい)
PHASE_COLORS = {"back": (59, 130, 246), "down": (249, 115, 22), "follow": (250, 204, 21)}
PHASE_LABELS = [("バックスイング", "back"), ("ダウンスイング", "down"), ("フォロー", "follow")]


def make_trail(frames, base, body_masks=None, phases=None):
    """各コマから「その瞬間だけ動いていた部分」を取り出し、時間ごとに色を付けて重ねる (青 → 赤)。

    夜の動画は照明のちらつきとざらつきで、動いていない所まで拾ってしまうので、
    コマごとの明るさの差をならし、細かいざらつきを消してから比べる。
    body_masks (コマごとの胴体・脚・頭の場所) を渡すと、そこには色を付けない (クラブと腕の通り道だけを残す)。
    phases (コマごとの "back" / "down" / "follow") を渡すと、時間ではなくスイングの区切りで色を分ける。
    """
    f = frames.astype(np.float32)
    f -= np.median(f, axis=(1, 2), keepdims=True)  # 明るさのちらつきをならす
    f = np.stack([_box_blur(x) for x in f])
    out = base.astype(np.float32) * 0.6
    count = len(f)
    # 動いたとみなす差: ざらつきの大きさ (ふつうのコマどうしの差の大きめの値) に合わせて上げる
    noise = float(np.quantile(np.abs(f[1:] - f[:-1]).sum(axis=3), 0.9)) if count > 1 else 0.0
    thr = max(90.0, noise * 3)
    for k in range(1, count - 1):
        dp = np.abs(f[k] - f[k - 1]).sum(axis=2)
        dn = np.abs(f[k] - f[k + 1]).sum(axis=2)
        mask = (dp > thr) & (dn > thr)
        if body_masks is not None:
            mask &= ~body_masks[k]
        if not mask.any():
            continue
        if phases is not None:
            color = np.array(PHASE_COLORS[phases[k]], dtype=np.float32)
            out[mask] = frames[k][mask] * 0.25 + color * 0.75
        else:
            color = _hue_rgb(240 - 240 * k / (count - 1))
            out[mask] = frames[k][mask] * 0.4 + color * 0.6
    img = Image.fromarray(out.clip(0, 255).astype(np.uint8)).convert("RGBA")
    # 凡例
    w, h = img.size
    size = max(14, h // 40)
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bar_w = min(w - 20, size * 10)
    top = h - size * 3 - 10
    f_ = font(size)
    if phases is not None:
        names = [(label if f_ else key, PHASE_COLORS[key]) for label, key in PHASE_LABELS]
        fnt = f_ or ImageFont.load_default()
        widths = [d.textlength(n, font=fnt) + size * 1.6 for n, _ in names]
        d.rectangle([0, h - size * 2 - 10, sum(widths) + 20, h], fill=(0, 0, 0, 170))
        x = 10
        for (name, c), wd in zip(names, widths):
            d.rectangle([x, h - size - 12, x + size, h - 12], fill=(*c, 255))
            d.text((x + size * 1.3, h - size - 14), name, font=fnt, fill=(255, 255, 255, 255))
            x += wd
        return Image.alpha_composite(img, layer).convert("RGB")
    d.rectangle([0, top, bar_w + 20, h], fill=(0, 0, 0, 160))
    for x in range(bar_w):
        c = _hue_rgb(240 - 240 * x / max(1, bar_w - 1)).astype(int)
        d.line([10 + x, h - size - 6, 10 + x, h - 8], fill=(*c, 255))
    if f_ is None:
        d.text((10, top + 4), "top -> follow", font=ImageFont.load_default(), fill=(255, 255, 255, 255))
    else:
        d.text((10, top + 4), "トップ側 → フォロー側", font=f_, fill=(255, 255, 255, 255))
    return Image.alpha_composite(img, layer).convert("RGB")


def make_swing_media(src, t, duration, out_dir, prefix, crop=None):
    """1球ぶんの、コマ画像(横一列)・クラブ軌道画像・切り出し動画を作る。

    crop (元の動画に対する割合 x0, y0, x1, y1) を渡すと、人のまわりだけを切り出して大きく写す。
    """
    first = frame_at(src, t, SPRITE_HEIGHT)
    w, h = first.size
    if crop:
        x0, y0, x1, y1 = crop
        w = round(SPRITE_HEIGHT * (w * (x1 - x0)) / (h * (y1 - y0)))
        h = SPRITE_HEIGHT
    w -= w % 2
    start = max(0.0, t + PHASES[0][0])
    end = min(duration, t + PHASES[-1][0] + 0.1)
    frames = decode_range(src, start, end - start, w, h, crop)

    def idx(time):
        return int(min(len(frames) - 1, max(0, round((time - start) * FPS))))

    sprite = Image.new("RGB", (w * len(PHASES), h))
    for i, (dt, _) in enumerate(PHASES):
        sprite.paste(Image.fromarray(frames[idx(t + dt)]), (i * w, 0))
    sprite_path = out_dir / f"{prefix}_sprite.jpg"
    sprite.save(sprite_path, "JPEG", quality=85)

    a, b = idx(t + TRAIL_FROM), idx(t + TRAIL_TO)
    trail = make_trail(frames[a:b + 1], frames[idx(t)])
    trail_path = out_dir / f"{prefix}_trail.jpg"
    trail.save(trail_path, "JPEG", quality=88)

    clip_start = max(0.0, t - CLIP_BEFORE)
    clip_path = out_dir / f"{prefix}.mp4"
    cut_clip(src, clip_path, clip_start, min(duration, t + CLIP_AFTER) - clip_start, crop=crop)
    return {
        "aspect": w / h,
        "sprite": sprite_path.name,
        "trail": trail_path.name,
        "clip": clip_path.name,
        "clipOffset": t - clip_start,  # 切り出し動画の中でのインパクトの位置(秒)
    }


# ---------- AI に送る画像 ----------

def _jpeg(img, max_bytes=3_500_000):
    for q in (85, 70, 55):
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=q)
        if buf.tell() <= max_bytes:
            break
    return buf.getvalue()


def grid_images(sprite_path, labels):
    """横一列のコマ画像を、8コマずつ 4列×2段 に並べ、番号と局面名を書き込んだ JPEG にする。"""
    sprite = Image.open(sprite_path).convert("RGB")
    n = len(labels)
    fw0 = sprite.width / n
    fh0 = sprite.height
    cols, rows = 4, 2
    # 送信時に約1.2メガピクセルへ縮小されるので、その大きさに合わせて作る
    scale = min(1.0, (1_200_000 / (fw0 * cols * fh0 * rows)) ** 0.5)
    fw, fh = int(fw0 * scale), int(fh0 * scale)
    size = max(14, fh // 22)
    out = []
    for start in range(0, n, cols * rows):
        grid = Image.new("RGBA", (fw * cols, fh * rows), (0, 0, 0, 255))
        draw = ImageDraw.Draw(grid)
        for j in range(cols * rows):
            i = start + j
            if i >= n:
                break
            cell = sprite.crop((int(i * fw0), 0, int((i + 1) * fw0), fh0)).resize((fw, fh))
            x, y = (j % cols) * fw, (j // cols) * fh
            grid.paste(cell, (x, y))
            draw_label(draw, (x, y), f"{i + 1} {labels[i]}", size, str(i + 1))
        out.append(_jpeg(grid.convert("RGB")))
    return out


def trail_image(trail_path):
    img = Image.open(trail_path).convert("RGB")
    scale = min(1.0, (1_200_000 / (img.width * img.height)) ** 0.5)
    if scale < 1:
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    return _jpeg(img)


if __name__ == "__main__":
    # 動作確認用: python video.py 動画.mp4
    setup_ffmpeg()
    target = Path(sys.argv[1])
    dur, has_audio = probe(target)
    impacts = find_impacts(read_audio(target)) if has_audio else []
    print(f"{dur:.1f}秒, インパクト: {impacts}")
