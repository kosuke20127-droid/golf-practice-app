"""MediaPipe で体の位置を取り、スイングを数値で測る (AI を使わない決まった分析)。

カメラ1台の映像から推定するので、長さ(cm)は身長からの換算、回転角は目安。
右打ちを前提にし、左打ちのときは左右を入れ替えて測る。
"""

import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

import video

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
             "pose_landmarker_full/float16/latest/pose_landmarker_full.task")
FRAME_HEIGHT = 480

# MediaPipe の関節番号 (右打ち: 左がリード側)
NOSE = 0
L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST = 11, 12, 13, 14, 15, 16
L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE = 23, 24, 25, 26, 27, 28
SKELETON = [(11, 12), (11, 13), (13, 15), (12, 14), (14, 16), (11, 23), (12, 24), (23, 24),
            (23, 25), (25, 27), (24, 26), (26, 28)]
SWAP = {L_SHOULDER: R_SHOULDER, L_ELBOW: R_ELBOW, L_WRIST: R_WRIST, L_HIP: R_HIP, L_KNEE: R_KNEE, L_ANKLE: R_ANKLE}
SWAP.update({v: k for k, v in SWAP.items()})


class PoseError(Exception):
    """画面にそのまま出せる日本語のメッセージを持つ例外。"""


class NotSwingError(PoseError):
    """スイングしていない (構えを確かめているだけ・歩いているなど) とわかったとき。"""


def ensure_model(models_dir):
    path = Path(models_dir) / "pose_landmarker_full.task"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        try:
            urllib.request.urlretrieve(MODEL_URL, tmp)
        except OSError as e:
            raise PoseError("姿勢を測るためのモデルをダウンロードできませんでした。インターネット接続を確認してください。") from e
        tmp.replace(path)
    return path


def _landmarker(model_path, mode, num_poses=1):
    try:
        import mediapipe  # noqa: F401
        from mediapipe.tasks import python as mp_tasks
        from mediapipe.tasks.python import vision
    except ImportError as e:
        raise PoseError("mediapipe が入っていません。start.bat を実行し直してください。") from e
    opts = vision.PoseLandmarkerOptions(
        # Windows でフォルダ名に日本語などが入っていても読めるよう、パスではなく中身を渡す
        base_options=mp_tasks.BaseOptions(model_asset_buffer=Path(model_path).read_bytes()),
        running_mode=getattr(vision.RunningMode, mode), num_poses=num_poses)
    return vision.PoseLandmarker.create_from_options(opts)


def _find_person(lm, img, near=None):
    """画面の中でいちばん大きく写っている人の範囲 (画面に対する割合)。"""
    return _find_person_marks(lm, img, near)[0]


def _find_person_marks(lm, img, near=None):
    """画面の中でいちばん大きく写っている人の範囲と関節位置 (どちらも画面に対する割合)。

    戻り値は (範囲 (x0, y0, x1, y1) または None, 関節 (33, 3: x, y, 見えやすさ) または None)。

    MediaPipe は小さく写った人を見落とすので、見つからなければ画面を区切って拡大しながら探す。
    near (前のコマで見つけた範囲) があれば、まずそのまわりだけを拡大して調べる。
    """
    import mediapipe as mp
    w, h = img.size
    side = min(w, h)
    windows = [(0, 0, w, h)]
    if near:
        s = int(min(side, max((near[2] - near[0]) * w, (near[3] - near[1]) * h) * 2.2))
        cx, cy = (near[0] + near[2]) / 2 * w, (near[1] + near[3]) / 2 * h
        x0 = int(min(max(0, cx - s / 2), w - s))
        y0 = int(min(max(0, cy - s / 2), h - s))
        windows = [(x0, y0, x0 + s, y0 + s), None] + windows
    for size in (side, int(side * 0.6)):
        level = []
        step = size // 2
        for y in range(0, max(1, h - size + step), step):
            for x in range(0, max(1, w - size + step), step):
                level.append((min(x, w - size), min(y, h - size), min(x, w - size) + size, min(y, h - size) + size))
        windows.append(None)  # 区切り: ここまでで見つかれば、それ以上細かく探さない
        windows += list(dict.fromkeys(level))
    best = None
    best_marks = None
    for win in windows:
        if win is None:
            if best:
                break
            continue
        x0, y0, x1, y1 = win
        tile = np.ascontiguousarray(np.asarray(img.crop(win)))
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=tile))
        for marks in res.pose_landmarks or []:
            pts = [((x0 + p.x * (x1 - x0)) / w, (y0 + p.y * (y1 - y0)) / h) for p in marks if (p.visibility or 0) > 0.5]
            if len(pts) < 8:
                continue
            xs, ys = [x for x, _ in pts], [y for _, y in pts]
            box = (min(xs), min(ys), max(xs), max(ys))
            if best is None or box[3] - box[1] > best[3] - best[1]:
                best = box  # 隣の打席の人より、手前の大きく写っている人を選ぶ
                best_marks = np.array([((x0 + p.x * (x1 - x0)) / w, (y0 + p.y * (y1 - y0)) / h, p.visibility or 0)
                                       for p in marks])
    return best, best_marks


def verify_swings(src, times, duration, models_dir, progress=None):
    """音で見つけたインパクト候補が、本当にスイングしたものかを骨格で確かめ、インパクトの位置も合わせ直す。

    スイングなら、インパクトの瞬間は手が低い位置 (腰のあたりより下) にあり、
    その少し前 (トップ) では手がそれより大きく上がっている。
    隣の打席の音・飲み物を飲む・歩く・スマホを触る、などはこの形にならない。
    音と映像が少しずれているとき (0.4 秒まで) は、体の動きから見たインパクトに合わせ直す。
    振り終わったあとの音 (ボールを置いた音など) は、スイングの形にならないので外れる。
    戻り値は候補ごとの {"ok": True/False/None, "reason": 理由, "t": 合わせ直したインパクトの秒}。
    ok が None は「人がうまく写っておらず判定できない」。
    """
    import os
    from concurrent.futures import ThreadPoolExecutor
    model = ensure_model(models_dir)
    out = [None] * len(times)
    done = [0]

    def work(part):
        # 候補をいくつかに分けて並行して確かめる (それぞれ自分の MediaPipe を使う)
        with _landmarker(model, "IMAGE", num_poses=3) as lm:
            for k in part:
                out[k] = _verify_one(lm, src, times[k], duration)
                done[0] += 1
                if progress:
                    progress(done[0] - 1, len(times))

    workers = max(1, min(3, (os.cpu_count() or 2) // 2, len(times)))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(work, [list(range(len(times)))[w::workers] for w in range(workers)]))
    # インパクトのあと 3 秒以内は、同じスイングの続き (フォロー・フィニッシュ・腕を下ろす) なので外す。
    # 打ちっぱなしで次の球を打つまでには、もっと時間がかかる
    kept = []
    for r in sorted(out, key=lambda r: r["t"]):
        if r["ok"] and any(0 <= r["t"] - q["t"] < 3.0 for q in kept):
            r.update(ok=False, reason="同じスイングの続きです（フィニッシュのあとの動きなど）")
        elif r["ok"]:
            kept.append(r)
    return out


def _is_impact(i, keys, sec, ys, hip_y, torso):
    """そのコマがインパクトらしいか: 手が低く、0.1〜0.7 秒前に手がしっかり上がっていた (トップからの速い振り下ろし)。

    フィニッシュのあとに、ゆっくりかがんでボールを置く動きなどは、手が下りるのが遅いので当てはまらない。
    """
    if ys[i] < hip_y - 0.35 * torso:
        return False
    before = [j for j in keys if 0.1 <= sec[i] - sec[j] <= 0.7]
    return bool(before) and ys[i] - min(ys[j] for j in before) > 0.45 * torso


def _verify_one(lm, src, t, duration):
    # インパクトの 0.4 秒ずれまでと、その 0.7 秒前 (トップ) が入る範囲だけを 0.1 秒ごとに読む
    start = max(0.0, t - 1.6)
    end = min(duration - 0.02, t + 0.5)
    if end - start < 1.0:
        return {"ok": False, "reason": "動画の端すぎて、スイングが写っていません", "t": t}
    try:
        w, h = _decode_size(src, start, 640)
        proc = video._run(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{end - start:.3f}",
                           "-vf", f"fps=10,scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
        n = len(proc.stdout) // (w * h * 3)
        frames = np.frombuffer(proc.stdout[: n * w * h * 3], dtype=np.uint8).reshape(n, h, w, 3)
    except Exception:  # noqa: BLE001
        return {"ok": None, "reason": "映像を読み取れませんでした", "t": t}
    idxs = list(range(len(frames)))
    marks, near = {}, None
    for i in idxs:
        box, m = _find_person_marks(lm, Image.fromarray(frames[i]), near)
        if m is not None:
            marks[i] = m
            near = near or box
    if len(marks) <= max(1, len(idxs) // 8):
        return {"ok": False, "reason": "人が写っていません（スマホを動かしたときの音などかも）", "t": t}
    if len(marks) < max(4, len(idxs) // 3):
        return {"ok": None, "reason": "人がうまく写っていないため、スイングか判定できませんでした", "t": t}

    def hands_y(m):
        return (m[L_WRIST, 1] + m[R_WRIST, 1]) / 2

    torsos = []
    hips = []
    for m in marks.values():
        sh = (m[L_SHOULDER, :2] + m[R_SHOULDER, :2]) / 2
        hip = (m[L_HIP, :2] + m[R_HIP, :2]) / 2
        torsos.append(float(np.hypot(*(sh - hip))))
        hips.append(float(hip[1]))
    torso = float(np.median(torsos))
    hip_y = float(np.median(hips))
    if torso < 1e-3:
        return {"ok": None, "reason": "体の大きさを測れませんでした", "t": t}
    keys = sorted(marks)
    sec = {i: start + i / 10.0 for i in keys}
    ys = {i: hands_y(marks[i]) for i in keys}
    # インパクトらしいコマ: 手が低く、その 0.15〜1.6 秒前に手がしっかり上がっていた
    impacts = [i for i in keys if _is_impact(i, keys, sec, ys, hip_y, torso)]
    if impacts:
        # 音の位置にいちばん近いインパクトにする。ずれは 0.4 秒まで
        # (それより離れているなら、その音は別のもの。本当のインパクトの音は別の候補として拾っている)
        best = min(impacts, key=lambda i: abs(sec[i] - t))
        if abs(sec[best] - t) <= 0.4:
            return {"ok": True, "reason": "" if abs(sec[best] - t) <= 0.25
                    else "音の位置がずれていたので、体の動きからインパクトを合わせ直しました", "t": round(sec[best], 2)}
    raised = any(ys[i] - min(ys[j] for j in keys if sec[j] < sec[i]) > 0.45 * torso
                 for i in keys if any(sec[j] < sec[i] for j in keys))
    if not raised:
        return {"ok": False, "reason": "手が上がっていません（スイングしていない／隣の打席の音かも）", "t": t}
    return {"ok": False, "reason": "スイングの形になっていません（振り終わりのあとの音などかも）", "t": t}


def _decode_size(src, t, height):
    w, h = video.frame_at(src, t, height).size
    return w - w % 2, h


def person_crop(src, t, duration, models_dir):
    """スイングしている人のまわりの範囲を、元の動画に対する割合 (x0, y0, x1, y1) で返す。

    人が小さく写っている動画でも、コマ画像・切り出し動画・姿勢の計測で大きく見えるようにするため。
    クラブがトップやフィニッシュで頭の上や体の外に出るので、体の大きさに合わせて余白を取る。
    人が見つからないときや、もともと大きく写っているときは None。
    """
    times = [min(max(0.0, t + dt), max(0.0, duration - 0.05)) for dt in (-2.0, -0.8, 0.0, 1.0)]
    boxes = []
    with _landmarker(ensure_model(models_dir), "IMAGE", num_poses=3) as lm:
        for tt in times:
            img = video.frame_at(src, tt, 1920)
            w, h = img.size
            best = _find_person(lm, img, boxes[0] if boxes else None)
            if best:
                boxes.append(best)
    if not boxes:
        return None
    # 最初に見つかった人と離れた場所の検出 (別の人) は使わない
    ref = boxes[0]
    ref_h = ref[3] - ref[1]
    cx = (ref[0] + ref[2]) / 2
    boxes = [b for b in boxes if abs((b[0] + b[2]) / 2 - cx) < ref_h * h / w]
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    body = y1 - y0                  # 体の高さ (画面の高さに対する割合)
    body_x = body * h / w           # 同じ長さを、画面の幅に対する割合にしたもの
    crop = (max(0.0, x0 - 0.6 * body_x), max(0.0, y0 - 0.45 * body),
            min(1.0, x1 + 0.6 * body_x), min(1.0, y1 + 0.1 * body))
    if (crop[2] - crop[0]) * (crop[3] - crop[1]) > 0.6:
        return None  # もともと大きく写っている
    return tuple(round(v, 4) for v in crop)


def detect(frames, fps, model_path):
    """各コマの関節位置。戻り値は (画像上の座標 (N,33,3: x,y,見えやすさ), 3次元の座標 (N,33,3))。見つからないコマは NaN。"""
    try:
        import mediapipe as mp
        from mediapipe.tasks import python as mp_tasks
        from mediapipe.tasks.python import vision
    except ImportError as e:
        raise PoseError("mediapipe が入っていません。start.bat を実行し直してください。") from e
    n, h, w, _ = frames.shape
    img = np.full((n, 33, 3), np.nan)
    world = np.full((n, 33, 3), np.nan)
    opts = vision.PoseLandmarkerOptions(
        # Windows でフォルダ名に日本語などが入っていても読めるよう、パスではなく中身を渡す
        base_options=mp_tasks.BaseOptions(model_asset_buffer=Path(model_path).read_bytes()),
        running_mode=vision.RunningMode.VIDEO, num_poses=1)
    with vision.PoseLandmarker.create_from_options(opts) as lm:
        for i in range(n):
            res = lm.detect_for_video(
                mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(frames[i])),
                int(i * 1000 / fps))
            if res.pose_landmarks:
                img[i] = [(p.x * w, p.y * h, p.visibility) for p in res.pose_landmarks[0]]
                world[i] = [(p.x, p.y, p.z) for p in res.pose_world_landmarks[0]]
    return img, world


def _fill(a):
    """見つからなかったコマを前後から補う。"""
    a = a.copy()
    flat = a.reshape(len(a), -1)
    idx = np.arange(len(a))
    for c in range(flat.shape[1]):
        col = flat[:, c]
        ok = ~np.isnan(col)
        if ok.sum() >= 2:
            col[~ok] = np.interp(idx[~ok], idx[ok], col[ok])
    return a


def _smooth(x, k=3):
    if len(x) < k:
        return x
    pad = np.pad(x, ((k // 2, k // 2),) + ((0, 0),) * (x.ndim - 1), mode="edge")
    return np.stack([pad[i:i + len(x)] for i in range(k)]).mean(axis=0)


def _angle(a, b, c):
    """b を頂点とする角度 (度)。"""
    v1, v2 = a - b, c - b
    cos = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-9)
    return math.degrees(math.acos(max(-1.0, min(1.0, cos))))


def _turn(img, i0, i1, a, b):
    """正面から撮った映像で、肩(腰)の幅がどれだけ狭く見えるかから回転角を出す (幅 = 元の幅 × cos 角度)。"""
    w0 = abs(img[i0, a, 0] - img[i0, b, 0])
    w1 = abs(img[i1, a, 0] - img[i1, b, 0])
    if w0 < 1:
        return None
    return math.degrees(math.acos(max(0.0, min(1.0, w1 / w0))))


def _grade(value, good, ok, higher_is_better=True):
    if value is None:
        return None
    if higher_is_better:
        return "◎" if value >= good else "○" if value >= ok else "△"
    return "◎" if value <= good else "○" if value <= ok else "△"


# アドレスの前傾角度 (後方から見た、腰→肩の線と縦の角度) の目安。番手が短いほど深く前かがみになる。
# 一般的なレッスンの目安で、体格や構え方で変わる
ADDRESS_TILT = {
    "1W": (28, 38), "3W": (30, 40), "5W": (30, 40), "UT": (32, 40),
    "4I": (33, 41), "5I": (33, 41), "6I": (34, 42), "7I": (35, 43), "8I": (36, 44), "9I": (36, 44),
    "PW": (38, 46), "AW": (38, 46), "SW": (39, 47), "LW": (39, 47),
}


def measure(img, world, fps, impact_t, angle, height_cm=170, lefty=False, club=None):
    """関節位置から、スイングのタイミングと数値を出す。"""
    if lefty:
        order = [SWAP.get(i, i) for i in range(33)]
        img, world = img[:, order], world[:, order]
    found = ~np.isnan(img[:, NOSE, 0])
    if found.mean() < 0.15:
        raise NotSwingError("人が写っていません。")
    if found.mean() < 0.6:
        raise PoseError("体がうまく写っていないため、測れませんでした。全身が入るように撮ってください。")
    img, world = _fill(img), _fill(world)
    n = len(img)
    i_imp = int(min(n - 1, max(0, round(impact_t * fps))))

    hands = _smooth((img[:, L_WRIST, :2] + img[:, R_WRIST, :2]) / 2)
    mid_sh = (img[:, L_SHOULDER, :2] + img[:, R_SHOULDER, :2]) / 2
    mid_hip = (img[:, L_HIP, :2] + img[:, R_HIP, :2]) / 2
    torso = float(np.nanmedian(np.linalg.norm(mid_sh[: max(1, i_imp)] - mid_hip[: max(1, i_imp)], axis=1)))
    if not torso or torso < 10:
        raise PoseError("体が小さく写りすぎていて測れませんでした。")
    speed = np.r_[0, np.linalg.norm(np.diff(hands, axis=0), axis=1)] / torso

    # トップ: インパクトの 1.6〜0.1 秒前で手がいちばん高いコマ
    lo, hi = max(0, i_imp - int(1.6 * fps)), max(1, i_imp - int(0.1 * fps))
    i_top = lo + int(np.argmin(hands[lo:hi, 1]))
    # 始動: トップからさかのぼって、手がほぼ止まっていたところ
    i_start = max(0, i_top - int(1.5 * fps))
    for i in range(i_top - 3, max(0, i_top - int(1.5 * fps)), -1):
        if speed[i] < 0.008 and speed[i - 1] < 0.008 and speed[i - 2] < 0.008:
            i_start = i
            break
    # インパクトの補正: 音は動画とずれることがある (スロー動画など) ので、
    # 音の位置の 0.4 秒前〜0.15 秒後で、手がアドレスの位置にいちばん近づいたコマにする
    a = max(i_top + 3, i_imp - int(0.4 * fps))
    b = min(n - 1, i_imp + int(0.15 * fps))
    if b > a:
        dist = np.linalg.norm(hands[a:b + 1] - hands[i_start], axis=1)
        i_imp = a + int(np.argmin(dist))
    impact_shift = (i_imp - int(min(n - 1, max(0, round(impact_t * fps))))) / fps

    # スイングしたかの確認: インパクトで手が低い位置にあり、トップでは手がそれより大きく上がっていること。
    # 構えを確かめているだけ・素振りの途中で止めた・歩いている、などは点数を付けない
    hip_y = float(np.median(mid_hip[:, 1]))
    rise = float(hands[i_imp, 1] - hands[i_top, 1])
    if rise < 0.45 * torso:
        raise NotSwingError("スイングしていないようです（手がほとんど上がっていません）。")
    if hands[i_imp, 1] < hip_y - 0.35 * torso:
        raise NotSwingError("スイングしていないようです（インパクトの位置で手が低いところにありません）。")

    # フィニッシュ: インパクト 0.3 秒後以降で手がほぼ止まったところ
    i_fin = n - 1
    for i in range(min(n - 3, i_imp + int(0.3 * fps)), n - 2):
        if speed[i] < 0.01 and speed[i + 1] < 0.01 and speed[i + 2] < 0.01:
            i_fin = i
            break

    cm_per_px = height_cm * 0.30 / torso  # 肩〜腰の長さを身長の 3 割として換算
    head = img[:, NOSE, :2]
    target_sign = 1.0 if img[i_start, L_SHOULDER, 0] >= img[i_start, R_SHOULDER, 0] else -1.0
    # 正面から撮ったかどうか。「わからない」のときは、アドレスの肩幅が広く見えれば正面とみなす
    sh_width = abs(img[i_start, L_SHOULDER, 0] - img[i_start, R_SHOULDER, 0])
    face_on = angle == "正面" or (angle != "後方" and sh_width / torso > 0.55)
    side_view = not face_on
    items = []

    back_t = (i_top - i_start) / fps
    down_t = (i_imp - i_top) / fps
    if down_t > 0 and back_t > 0:
        ratio = back_t / down_t
        g = "◎" if 2.5 <= ratio <= 3.5 else "○" if 2.0 <= ratio <= 4.0 else "△"
        items.append({"key": "tempo", "label": "テンポ（バック：ダウン）", "value": round(ratio, 2),
                      "display": f"{ratio:.1f} : 1（{back_t:.2f}秒 / {down_t:.2f}秒）", "grade": g, "hint": "目安 3 : 1"})

    dx = float(head[i_imp, 0] - head[i_start, 0]) * cm_per_px
    dy = float(head[i_imp, 1] - head[i_start, 1]) * cm_per_px
    sway = float(np.max(np.abs(head[i_start:i_top + 1, 0] - head[i_start, 0]))) * cm_per_px
    if side_view:
        side_word = "ボール側へ" if dx * (1 if img[i_start, L_WRIST, 0] > head[i_start, 0] else -1) > 0 else "体の後ろ側へ"
    else:
        side_word = "目標側へ" if dx * target_sign > 0 else "目標と反対側へ"
    items.append({"key": "head_side", "label": "頭の横の動き（アドレス→インパクト）", "value": round(abs(dx), 1),
                  "display": f"{side_word} {abs(dx):.0f}cm", "grade": _grade(abs(dx), 3, 6, False), "hint": "目安 3cm 以内"})
    items.append({"key": "head_up", "label": "頭の上下（アドレス→インパクト）", "value": round(abs(dy), 1),
                  "display": f"{'下へ' if dy > 0 else '上へ'} {abs(dy):.0f}cm", "grade": _grade(abs(dy), 3, 6, False),
                  "hint": "目安 3cm 以内（上へ動くのは起き上がり）"})
    items.append({"key": "sway", "label": "バックスイング中の頭の横ぶれ", "value": round(sway, 1),
                  "display": f"最大 {sway:.0f}cm", "grade": _grade(sway, 4, 8, False), "hint": "目安 4cm 以内"})

    def tilt(i):
        v = mid_sh[i] - mid_hip[i]
        return math.degrees(math.atan2(abs(v[0]), -v[1]))

    if side_view and club in ADDRESS_TILT:
        lo_t, hi_t = ADDRESS_TILT[club]
        a0 = tilt(i_start)
        g = "◎" if lo_t <= a0 <= hi_t else "○" if lo_t - 5 <= a0 <= hi_t + 5 else "△"
        word = "浅め（体が起きている）" if a0 < lo_t else "深め" if a0 > hi_t else "目安どおり"
        items.append({"key": "address_tilt", "label": "アドレスの前傾", "value": round(a0, 1),
                      "display": f"{a0:.0f}°（{word}）", "grade": g,
                      "hint": f"目安 {lo_t}〜{hi_t}°（この番手の場合）。背筋は伸ばしたまま、股関節から前に倒す"})

    if side_view:
        change = tilt(i_start) - tilt(i_imp)
        items.append({"key": "spine", "label": "前傾角度の変化（アドレス→インパクト）", "value": round(abs(change), 1),
                      "display": f"アドレス {tilt(i_start):.0f}° → インパクト {tilt(i_imp):.0f}°（{'起き上がり' if change > 0 else '深くなる'} {abs(change):.0f}°）",
                      "grade": _grade(abs(change), 5, 10, False), "hint": "目安 5° 以内"})
        # お尻 (腰の中心) がアドレスからインパクトでボール側へ出たか (アーリーエクステンション)
        ball_sign = 1.0 if img[i_start, L_WRIST, 0] > mid_hip[i_start, 0] else -1.0
        hip_dx = float(mid_hip[i_imp, 0] - mid_hip[i_start, 0]) * cm_per_px * ball_sign
        fwd = max(0.0, hip_dx)
        word = (f"ボール側へ {hip_dx:.0f}cm（お尻が前に出ている）" if hip_dx > 4
                else f"ボール側へ {hip_dx:.0f}cm（目安内）" if hip_dx >= 1.5
                else f"後ろ側へ {-hip_dx:.0f}cm（お尻の位置をキープ）" if hip_dx <= -1.5 else "ほぼ動かず（お尻の位置をキープ）")
        items.append({"key": "hip_line", "label": "お尻の位置（アドレス→インパクト）", "value": round(hip_dx, 1),
                      "display": word, "grade": _grade(fwd, 4, 8, False),
                      "hint": "目安 ボール側へ 4cm 以内（前に出るのは体の起き上がりのサイン）"})

    if face_on:
        sh_turn = _turn(img, i_start, i_top, L_SHOULDER, R_SHOULDER)
        hip_turn = _turn(img, i_start, i_top, L_HIP, R_HIP)
        if sh_turn is not None and hip_turn is not None:
            items.append({"key": "shoulder_turn", "label": "肩の回転（トップ）", "value": round(sh_turn),
                          "display": f"約 {sh_turn:.0f}°", "grade": _grade(sh_turn, 80, 60), "hint": "目安 80〜90°（見た目の肩幅からの推定）"})
            items.append({"key": "hip_turn", "label": "腰の回転（トップ）", "value": round(hip_turn),
                          "display": f"約 {hip_turn:.0f}°",
                          "grade": "◎" if 35 <= hip_turn <= 55 else "○" if 25 <= hip_turn <= 65 else "△",
                          "hint": "目安 45° 前後（推定）"})
            items.append({"key": "xfactor", "label": "捻転差（肩 − 腰）", "value": round(sh_turn - hip_turn),
                          "display": f"約 {sh_turn - hip_turn:.0f}°", "grade": _grade(sh_turn - hip_turn, 35, 20),
                          "hint": "目安 35° 以上（推定）"})

    arm = _angle(world[i_top, L_SHOULDER], world[i_top, L_ELBOW], world[i_top, L_WRIST])
    items.append({"key": "lead_arm", "label": f"{'右' if lefty else '左'}腕の伸び（トップ）", "value": round(arm),
                  "display": f"{arm:.0f}°", "grade": _grade(arm, 160, 140), "hint": "目安 160° 以上（180° でまっすぐ）"})

    if face_on:
        def weight(i):
            lead, trail = img[i, L_ANKLE, 0], img[i, R_ANKLE, 0]
            if abs(lead - trail) < 1:
                return None
            return float(np.clip((mid_hip[i, 0] - trail) / (lead - trail), -0.5, 1.5))
        w_fin = weight(i_fin)
        if w_fin is not None:
            items.append({"key": "finish_weight", "label": f"フィニッシュの体重（{'右' if lefty else '左'}足側）", "value": round(w_fin * 100),
                          "display": f"{w_fin * 100:.0f}%", "grade": _grade(w_fin * 100, 80, 60), "hint": "目安 80% 以上"})

    vis = float(np.nanmean(img[[i_start, i_top, i_imp, i_fin]][:, [NOSE, L_SHOULDER, R_SHOULDER, L_HIP, R_HIP, L_WRIST, R_WRIST], 2]))
    return {
        "items": items,
        "events": {k: round((v - i_imp) / fps, 3) for k, v in
                   (("start", i_start), ("top", i_top), ("impact", i_imp), ("finish", i_fin))},
        "frames": {"start": i_start, "top": i_top, "impact": i_imp, "finish": i_fin},
        "quality": round(vis, 2),
        "lefty": lefty,
        "impactShift": round(impact_shift, 3),  # 音から見つけたインパクトとのずれ (秒)
        "view": "正面" if face_on else "後方",
        "note": "" if face_on else "肩・腰の回転と体重移動は、正面から撮った動画で測れます。",
    }


def draw(frames, img, result, dst):
    """始動・トップ・インパクト・フィニッシュの4コマに、関節の線と頭の位置の目安線を描く。"""
    img = _fill(img)
    keys = [("start", "アドレス"), ("top", "トップ"), ("impact", "インパクト"), ("finish", "フィニッシュ")]
    h, w = frames.shape[1:3]
    sheet = Image.new("RGB", (w * len(keys), h), (0, 0, 0))
    i0 = result["frames"]["start"]
    head0 = img[i0, NOSE, :2]
    for j, (key, label) in enumerate(keys):
        i = result["frames"][key]
        panel = Image.fromarray(frames[i]).convert("RGBA")
        layer = Image.new("RGBA", panel.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        # アドレス時の頭の位置 (縦・横の目安線)
        d.line([(head0[0], 0), (head0[0], h)], fill=(255, 255, 255, 110), width=1)
        d.line([(0, head0[1]), (w, head0[1])], fill=(255, 255, 255, 110), width=1)
        p = img[i]
        for a, b in SKELETON:
            if not np.isnan(p[a, 0]) and not np.isnan(p[b, 0]):
                d.line([tuple(p[a, :2]), tuple(p[b, :2])], fill=(80, 220, 140, 230), width=3)
        mid_sh = (p[L_SHOULDER, :2] + p[R_SHOULDER, :2]) / 2
        mid_hip = (p[L_HIP, :2] + p[R_HIP, :2]) / 2
        d.line([tuple(mid_hip), tuple(mid_sh)], fill=(255, 200, 60, 230), width=3)  # 背骨
        if not np.isnan(p[NOSE, 0]):
            x, y = p[NOSE, :2]
            d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=(255, 90, 90, 255), width=3)
        video.draw_label(d, (0, 0), label, max(14, h // 26), key)
        sheet.paste(Image.alpha_composite(panel, layer).convert("RGB"), (j * w, 0))
    sheet.save(dst, "JPEG", quality=85)


# ---------- 補助線 ----------

def line_refs(norm, result, aspect):
    """アドレスの姿勢から、補助線の位置を決める (座標は画面に対する割合)。

    norm: 各コマの関節位置 (コマ数, 33, 2)。aspect: 画面の 横 / 縦。
    """
    i0 = result["frames"]["start"]
    p = norm[i0]
    hip = (p[L_HIP] + p[R_HIP]) / 2
    sh = (p[L_SHOULDER] + p[R_SHOULDER]) / 2
    head = np.nanmean(p[[NOSE, 7, 8]], axis=0)  # 鼻と両耳の真ん中あたり
    torso = float(np.hypot((sh[0] - hip[0]) * aspect, sh[1] - hip[1]))  # 縦の長さを1とした長さ
    hands = (p[L_WRIST] + p[R_WRIST]) / 2
    back = -1.0 if hands[0] > hip[0] else 1.0  # ボールと反対側 (お尻のある側)
    return {
        "hip": hip.tolist(), "shoulder": sh.tolist(), "head": head.tolist(),
        "headR": torso * 0.28, "butt": float(hip[0] + back * torso * 0.28 / aspect),
        "side": result.get("view") == "後方",
    }


def _tilt_deg(p):
    hip = (p[L_HIP] + p[R_HIP]) / 2
    sh = (p[L_SHOULDER] + p[R_SHOULDER]) / 2
    return math.degrees(math.atan2(abs(sh[0] - hip[0]), hip[1] - sh[1]))


def draw_lines(im, refs, p=None, label=None):
    """画像 (PIL) に補助線を描く。refs はアドレスの基準、p はそのコマの関節位置 (割合)。

    - 黄色の円: アドレスの頭の位置 (頭が動くと円から外れる)
    - 緑の線: アドレスの背骨の傾き (前傾が起き上がると、体がこの線から離れる)
    - 水色の縦線: アドレスのお尻の位置 (後方から。お尻が線より前に出ると前傾が崩れている)
    - 白い線: そのコマの背骨
    """
    w, h = im.size
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    lw = max(2, h // 220)
    hx, hy = refs["head"][0] * w, refs["head"][1] * h
    r = refs["headR"] * h
    d.ellipse([hx - r, hy - r, hx + r, hy + r], outline=(255, 214, 10, 230), width=lw)
    (x0, y0), (x1, y1) = refs["hip"], refs["shoulder"]
    ext = 1.45  # 頭の上まで伸ばす
    d.line([(x0 * w, y0 * h), ((x0 + (x1 - x0) * ext) * w, (y0 + (y1 - y0) * ext) * h)],
           fill=(60, 220, 120, 230), width=lw)
    if refs.get("side"):
        bx = refs["butt"] * w
        d.line([(bx, y0 * h - (y0 - y1) * h * 0.4), (bx, h)], fill=(80, 200, 255, 210), width=lw)
    if p is not None and not np.isnan(p).any():
        hip = (p[L_HIP] + p[R_HIP]) / 2
        sh = (p[L_SHOULDER] + p[R_SHOULDER]) / 2
        d.line([(hip[0] * w, hip[1] * h), (sh[0] * w, sh[1] * h)], fill=(255, 255, 255, 220), width=max(1, lw - 1))
        if label is None:
            label = f"前傾 {_tilt_deg(p):.0f}°"
    if label:
        video.draw_label(d, (0, h - max(14, h // 22) - 8), label, max(14, h // 22), label.replace("前傾", "tilt"))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def write_lines_video(frames, norm, refs, dst):
    """測った動画に補助線を描いて、mp4 に書き出す。"""
    import subprocess
    n, h, w, _ = frames.shape
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
         "-r", str(video.FPS), "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst)],
        stdin=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=video.NO_WINDOW)
    try:
        for i in range(n):
            proc.stdin.write(np.asarray(draw_lines(Image.fromarray(frames[i]), refs, norm[i])).tobytes())
        proc.stdin.close()
    except BrokenPipeError:
        pass
    if proc.wait() != 0:
        raise RuntimeError(proc.stderr.read().decode(errors="replace")[-300:])


def draw_lines_sprite(sprite_path, phase_dts, clip_offset, norm_full, refs_full, dst):
    """コマ画像 (横一列) の各コマにも、同じ補助線を描く。"""
    sprite = Image.open(sprite_path).convert("RGB")
    n = len(phase_dts)
    fw = sprite.width // n
    out = Image.new("RGB", sprite.size)
    for k, dt in enumerate(phase_dts):
        i = int(min(len(norm_full) - 1, max(0, round((clip_offset + dt) * video.FPS))))
        cell = sprite.crop((k * fw, 0, (k + 1) * fw, sprite.height))
        out.paste(draw_lines(cell, refs_full, norm_full[i], label=""), (k * fw, 0))
    out.save(dst, "JPEG", quality=85)


def face_zoom(clip_path, result, norm_full, clip_offset, dst):
    """テークバックでクラブが地面と平行になるあたりの手元を拡大した画像 (AI がフェースの向きを見る用)。

    始動からトップまでの 4割・6割・8割の時点の3コマを、手首のまわりで切り出して横に並べる。
    """
    ev = result.get("events") or {}
    if "start" not in ev or "top" not in ev:
        return False
    full_w, full_h = video.frame_at(clip_path, 0, 120).size
    panels = []
    for frac, label in ((0.4, "テークバック前半"), (0.6, "シャフトが地面と平行付近"), (0.8, "トップ手前")):
        rel = ev["start"] + (ev["top"] - ev["start"]) * frac  # インパクトからの秒
        t = clip_offset + rel
        i = int(min(len(norm_full) - 1, max(0, round(t * video.FPS))))
        p = norm_full[i]
        hands = (p[L_WRIST] + p[R_WRIST]) / 2
        torso = float(np.hypot(((p[L_SHOULDER] + p[R_SHOULDER]) / 2 - (p[L_HIP] + p[R_HIP]) / 2)[0] * full_w / full_h,
                               ((p[L_SHOULDER] + p[R_SHOULDER]) / 2 - (p[L_HIP] + p[R_HIP]) / 2)[1]))
        img = video.frame_at(clip_path, t, 1080)
        w, h = img.size
        half = max(40, int(torso * h * 1.35))  # 手元からクラブヘッドまで入るくらい
        cx, cy = int(hands[0] * w), int(hands[1] * h)
        box = (max(0, cx - half), max(0, cy - half), min(w, cx + half), min(h, cy + half))
        panel = img.crop(box).resize((360, 360))
        d = ImageDraw.Draw(panel, "RGBA")
        video.draw_label(d, (0, 0), label, 18, f"{int(frac * 100)}%")
        panels.append(panel)
    sheet = Image.new("RGB", (360 * len(panels), 360))
    for k, panel in enumerate(panels):
        sheet.paste(panel, (k * 360, 0))
    sheet.save(dst, "JPEG", quality=88)
    return True


def body_mask(p, w, h):
    """そのコマの胴体・脚・頭の場所 (True)。腕とクラブは含めない。p は関節位置 (画面に対する割合)。"""
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    pt = lambda i: (float(p[i, 0] * w), float(p[i, 1] * h))  # noqa: E731
    sh = (p[L_SHOULDER, :2] + p[R_SHOULDER, :2]) / 2
    hip = (p[L_HIP, :2] + p[R_HIP, :2]) / 2
    torso = float(np.hypot((sh[0] - hip[0]) * w, (sh[1] - hip[1]) * h))
    if not torso or np.isnan(torso):
        return np.zeros((h, w), bool)
    lw = max(4, int(torso * 0.22))
    d.polygon([pt(L_SHOULDER), pt(R_SHOULDER), pt(R_HIP), pt(L_HIP)], fill=255)
    d.line([pt(L_SHOULDER), pt(R_SHOULDER), pt(R_HIP), pt(L_HIP), pt(L_SHOULDER)], fill=255, width=lw)
    for a, b, c in ((L_HIP, L_KNEE, L_ANKLE), (R_HIP, R_KNEE, R_ANKLE)):
        d.line([pt(a), pt(b), pt(c)], fill=255, width=lw)
        x, y = pt(c)
        d.ellipse([x - lw, y - lw * 0.6, x + lw, y + lw * 0.8], fill=255)  # 足
    head = np.nanmean(p[[NOSE, 7, 8], :2], axis=0)
    r = torso * 0.34
    d.ellipse([head[0] * w - r, head[1] * h - r, head[0] * w + r, head[1] * h + r], fill=255)
    return np.asarray(img) > 0


def retrail(clip_path, clip_offset, norm_full, dst, events=None):
    """骨格を使って、クラブ軌道画像を作り直す。

    - 胴体・脚・頭には色を付けない (腕とクラブの通り道だけが残る)
    - 始動からフォローまでを、バックスイング (青)・ダウンスイング (オレンジ)・フォロー (黄) に色分けする。
      上げるときと下ろすときで通り道が変わっていないかが見える
    """
    ev = events or {}
    first = ev.get("start", video.TRAIL_FROM)  # インパクトからの秒
    top = ev.get("top", (first + 0) / 2)
    start = max(0.0, clip_offset + max(first - 0.05, -2.4))
    end = clip_offset + video.TRAIL_TO
    w, h = _decode_size(clip_path, 0, 560)
    frames = video.decode_range(clip_path, start, end - start + 1 / video.FPS, w, h)
    base = video.decode_range(clip_path, max(0.0, clip_offset), 1 / video.FPS, w, h)[0]
    i0 = int(round(start * video.FPS))
    masks = np.stack([body_mask(norm_full[min(len(norm_full) - 1, i0 + k)], w, h) for k in range(len(frames))])
    phases = []
    for k in range(len(frames)):
        rel = start + k / video.FPS - clip_offset
        phases.append("back" if rel < top else "down" if rel <= 0.0 else "follow")
    video.make_trail(frames, base, masks, phases).save(dst, "JPEG", quality=88)


def analyze_clip(clip_path, impact_t, angle, models_dir, dst_image, height_cm=170, lefty=False,
                 club=None, lines_video=None):
    """切り出した1球ぶんの動画を測り、結果と姿勢の画像を作る。"""
    duration, _, _ = video.probe(clip_path)
    # 人が小さく写っている動画 (前に保存した記録など) は、人のまわりを切り出してから測る
    try:
        crop = person_crop(clip_path, impact_t, duration, models_dir)
    except PoseError:
        raise
    except Exception:  # noqa: BLE001
        crop = None
    first = video.frame_at(clip_path, 0, FRAME_HEIGHT)
    w, h = first.size
    if crop:
        x0, y0, x1, y1 = crop
        w = round(FRAME_HEIGHT * (w * (x1 - x0)) / (h * (y1 - y0)))
        h = FRAME_HEIGHT
    w -= w % 2
    frames = video.decode_range(clip_path, 0, duration, w, h, crop)
    img, world = detect(frames, video.FPS, ensure_model(models_dir))
    result = measure(img, world, video.FPS, impact_t, angle, height_cm, lefty, club)
    draw(frames, img, result, dst_image)
    # 補助線: 測った範囲 (切り出したなら切り出した範囲) と、元の切り出し動画全体の両方の座標で持つ
    norm = _fill(img)[:, :, :2] / np.array([w, h])
    refs = line_refs(norm, result, w / h)
    if lines_video:
        write_lines_video(frames, norm, refs, lines_video)
    x0, y0, x1, y1 = crop or (0.0, 0.0, 1.0, 1.0)
    norm_full = norm * np.array([x1 - x0, y1 - y0]) + np.array([x0, y0])
    full_w, full_h = video.frame_at(clip_path, 0, 120).size
    result["_norm_full"] = norm_full
    result["_refs_full"] = line_refs(norm_full, result, full_w / full_h)
    return result
