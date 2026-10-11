"""記録から学習する「コーチのメモ」。パソコンの Claude Code (claude コマンド) に記録を読ませて作る。

モデルそのものを鍛えるのではなく、これまでの記録 (計測・点数・感触・ノート・テーマ) を読ませて
「この人の特徴・崩れるパターン・効いた練習」をまとめたメモを作り、記録が増えるたびに書き直してもらう。
メモは画面に出すほか、Gemini の分析や振り返りノートの整理にも渡す。
"""

import json
import re
import shutil
import subprocess
import time

DEFAULT_MODEL = "sonnet"
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)  # Windows で黒い窓を出さない
MAX_SWINGS = 300
FLIGHT_NAMES = {"straight": "ストレート", "fade": "フェード", "draw": "ドロー", "slice": "スライス", "hook": "フック",
                "push": "プッシュ", "pull": "引っかけ", "fat": "ダフリ", "thin": "トップ", "sky": "テンプラ"}  # 読ませる球数の上限 (新しいものから)


FOCUS_LABELS = {"rise": "体が起きる", "hip": "お尻が前に出る", "head": "頭が動く", "arm": "左腕が曲がる", "path": "アウトから下りる（手元の通り道）",
                "tempo": "打ち急ぐ（テンポ）", "tense": "力む（切り返しで打ちにいく）", "setup": "アドレスの前傾が浅い・深い", "finish": "フィニッシュで体重が残る"}


class CoachError(Exception):
    """画面にそのまま出せる日本語のメッセージを持つ例外。"""


def _day(ms):
    return time.strftime("%Y-%m-%d %H:%M", time.localtime((ms or 0) / 1000))


def _pose_text(sw):
    items = (sw.get("pose") or {}).get("items") or []
    return "、".join(f"{it['label']} {it['display']}{it.get('grade') or ''}" for it in items)


def build_input(state, club_names):
    """記録を、Claude に読ませる文章にする (画像は送らない)。"""
    lines = []
    swings = sorted([r for r in state.get("swings") or [] if not r.get("ideal")], key=lambda r: r.get("shotAt") or r.get("at") or 0, reverse=True)
    count = 0
    lines.append("## スイング動画の記録（新しい順）")
    for rec in swings:
        if count >= MAX_SWINGS:
            break
        club = club_names.get(rec.get("club"), rec.get("club"))
        head = f"### {_day(rec.get('shotAt') or rec.get('at'))} {club}（{rec.get('angle') or '向き不明'}）"
        if rec.get("concern"):
            head += f" 意識したこと: {rec['concern']}"
        lines.append(head)
        for i, sw in enumerate(rec.get("swings") or []):
            count += 1
            parts = [f"{i + 1}球目"]
            if sw.get("score") is not None:
                parts.append(f"AI点 {sw['score']}")
            if sw.get("aiNote"):
                parts.append(sw["aiNote"])
            if sw.get("mark") == "good":
                parts.append("本人がお手本に指定")
            elif sw.get("mark") == "bad":
                parts.append("本人が悪い例に指定")
            if sw.get("flight"):
                parts.append(f"弾道: {FLIGHT_NAMES.get(sw['flight'], sw['flight'])}")
            if _pose_text(sw):
                parts.append("計測: " + _pose_text(sw))
            elif (sw.get("pose") or {}).get("error"):
                parts.append("計測できず")
            lines.append("- " + " / ".join(parts))
        if rec.get("text"):
            lines.append("  AI分析の要点: " + re.sub(r"\s+", " ", rec["text"])[:500])

    sessions = state.get("sessions") or []
    if sessions:
        lines.append("\n## 練習の記録（打った感触）")
        for s in sessions[:40]:
            shots = s.get("shots") or []
            by = {}
            for sh in shots:
                by.setdefault(sh.get("club"), []).append(sh)
            desc = []
            for club, lst in by.items():
                good = sum(1 for x in lst if x.get("feel") == "good")
                meh = sum(1 for x in lst if x.get("feel") == "meh")
                dists = [x["distance"] for x in lst if x.get("distance") is not None]
                d = f"{club_names.get(club, club)} {len(lst)}球（いい感触{good}・いまいち{meh}"
                if dists:
                    d += f"・距離平均{sum(dists) / len(dists):.0f}yd"
                desc.append(d + "）")
            theme = f" テーマ: {s['theme']}" if s.get("theme") else ""
            lines.append(f"- {_day(s.get('startedAt'))} {s.get('place') or ''}{theme}: " + "、".join(desc))

    notes = sorted(state.get("notes") or [], key=lambda n: n.get("day") or "", reverse=True)
    if notes:
        lines.append("\n## 振り返りノート")
        for n in notes[:30]:
            body = n.get("text") or n.get("memo") or ""
            lines.append(f"### {n.get('day')}\n" + re.sub(r"\n{2,}", "\n", body)[:800])

    feels = state.get("feels") or []
    if feels:
        lines.append("\n## 本人がつかんだ感覚・イメージ（感覚ノート）")
        for f in feels[:60]:
            lines.append(f"- 「{f.get('phrase')}」→ {f.get('fixes') or ''}（{f.get('day') or ''} {f.get('club') or ''}）")

    focus = state.get("focus") or {}
    if focus.get("ids") or focus.get("text"):
        lines.append("\n## 本人が選んだ苦手（直したいクセ）\n" + "、".join([*(FOCUS_LABELS.get(i, i) for i in focus.get("ids") or []), focus.get("text") or ""]).strip("、"))
    sc = state.get("scoring") or {}
    if sc.get("weights"):
        lab = sc.get("labels") or {}
        lines.append("\n## 本人の印に合わせて学習した計測項目の重み（1が標準）\n"
                     + "、".join(f"{lab.get(k, k)} ×{v}" for k, v in sc["weights"].items()))
    if state.get("theme"):
        lines.append(f"\n## 今のテーマ\n{state['theme'].get('text')}")
    return "\n".join(lines), count


INSTRUCTION = """あなたは、1人のアマチュアゴルファーを長く見ているレッスンプロです。
下の「これまでのコーチのメモ」と「記録」を読み、この人専用のコーチのメモを書き直してください。
記録は、スイング動画の計測（MediaPipe による骨格の推定。◎○△は目安との比較）、AIの点数とひとこと、
本人の感触、振り返りノート、練習テーマです。カメラ1台からの推定なので、数値は目安として扱ってください。

書くこと（日本語。見出しは「## 」、箇条書きは「- 」）:
## この人のスイングの特徴
## 良いときの共通点
（AI点が高い球・本人がお手本にした球・いい感触の日に共通すること）
## 崩れるパターン
（どんなときに、どの項目が崩れやすいか。クラブや撮影の向きの違いも）
## 効いた練習・テーマ・感覚
（テーマやドリル、本人の感覚ノートの言葉のうち、どれが効いていそうか。本人の言葉はそのまま使う）
（前後で数値や感触が変わったか。わからなければ「まだわからない」）
## 点数と本人の評価のずれ
（本人の印〈お手本・悪い例〉や弾道と、AI点・計測（◎○△）が合っていない球を挙げ、この人の良し悪しを分けているのは何か。
今後の点数付けで重視すべき点・軽く見てよい点。計測では見えないもの〈フェースの向きなど〉が原因らしければそう書く）
## 次に優先すること
- （1つだけ。理由も）
## 前回のメモから変わったこと
（前回のメモがなければ「初回」）

記録にないことを事実のように書かないでください。データが少ない項目は「まだ記録が少ない」と書いてください。

最後に、他のAIに渡す要約を付けてください。形式は次の JSON だけを ```json と ``` で囲んで1つ:
{"summary": "この人の特徴・崩れるパターン・優先することを400字以内で"}
"""


def find_cli(cmd):
    path = shutil.which(cmd or "claude")
    if not path:
        raise CoachError("claude コマンドが見つかりません。Claude Code をパソコンに入れて、"
                         "コマンドプロンプトで一度 claude を起動してログインしてください。"
                         "（入れた場所が違うときは、設定タブで場所を指定できます）")
    return path


def has_cli(cmd):
    return bool(shutil.which(cmd or "claude"))


def _request(state, club_names):
    data, count = build_input(state, club_names)
    if count < 3:
        raise CoachError("学習するには、スイングの記録が3球以上必要です。")
    prev = (state.get("coach") or {}).get("text") or "（まだありません）"
    return f"{INSTRUCTION}\n\n# これまでのコーチのメモ\n{prev}\n\n# 記録\n{data}\n", count


def _parse(out, count, engine):
    summary = ""
    m = None
    for m in re.finditer(r"```\s*json\s*(\{.*?\})\s*```", out, re.S | re.I):
        pass
    text = out
    if m:
        try:
            summary = str(json.loads(m.group(1)).get("summary") or "")
        except ValueError:
            summary = ""
        text = out[:m.start()].rstrip()
    if not summary:
        summary = re.sub(r"\s+", " ", text)[:400]
    return {"text": text, "summary": summary[:600], "swings": count, "engine": engine}


def learn_gemini(state, club_names, api_key, model=""):
    """Claude Code がないパソコンでは、Gemini に同じことを頼む。"""
    import ai
    stdin, count = _request(state, club_names)
    try:
        out = ai.generate_text(api_key, model, stdin)
    except ai.AnalysisError as e:
        raise CoachError(str(e)) from e
    return _parse(out, count, "gemini")


def learn(state, club_names, cmd="claude", model=DEFAULT_MODEL, timeout=600):
    """Claude に記録を読ませて、コーチのメモを作る。戻り値は {text, summary, swings, engine}。"""
    stdin, count = _request(state, club_names)
    path = find_cli(cmd)
    base = [path, "-p", "Follow the instructions given on standard input. Reply in Japanese.",
            "--model", model or DEFAULT_MODEL, "--output-format", "text", "--no-session-persistence"]
    # ツールは使わせない (記録を読んでまとめるだけ)。古い claude で --tools が使えなければ外して再実行する
    for args in (base + ["--tools", ""], base):
        try:
            proc = subprocess.run(args, input=stdin.encode("utf-8"), capture_output=True, timeout=timeout,
                                  creationflags=NO_WINDOW)
        except subprocess.TimeoutExpired as e:
            raise CoachError("Claude の返事に時間がかかりすぎました。しばらくしてからお試しください。") from e
        except OSError as e:
            raise CoachError(f"claude コマンドを起動できませんでした（{e}）") from e
        out = proc.stdout.decode("utf-8", errors="replace").strip()
        err = proc.stderr.decode("utf-8", errors="replace").strip()
        if proc.returncode == 0 and out:
            break
        if "--tools" not in " ".join(args) or "tools" not in (err + out).lower():
            break
    if proc.returncode != 0 or not out:
        msg = (err or out)[-300:]
        if re.search(r"log ?in|auth|credential|api key", msg, re.I):
            raise CoachError("Claude にログインしていないようです。コマンドプロンプトで claude を起動してログインしてください。"
                             f"（{msg}）")
        raise CoachError(f"Claude でエラーが起きました: {msg or '返事が空でした'}")
    return _parse(out, count, "claude")
