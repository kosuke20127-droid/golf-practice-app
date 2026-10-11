"""スイングの AI 分析 (Gemini API)。

API キーは、設定画面で保存したもの、なければ環境変数 GEMINI_API_KEY を使う。
"""

from google import genai
from google.genai import errors, types

# 「最新の Flash」を指す別名。設定画面で別のモデル名に変えられる
DEFAULT_MODEL = "gemini-flash-latest"


class AnalysisError(Exception):
    """画面にそのまま出せる日本語のメッセージを持つ例外。"""


def build_prompt(rec, used, per_swing, labels, trail_from, trail_to, club_name, measurements=(), coach_note="", focus="", scoring=""):
    lines = [
        "あなたは経験豊富なゴルフのレッスンプロです。",
        f"添付の画像は、アマチュアゴルファーが同じ日に打った{used}球のスイングです。1球目から順に、1球につき次の画像が並んでいます。",
    ]
    lines += [f"- {i + 1}枚目: {d}" for i, d in enumerate(per_swing)]
    lines.append(
        "コマ画像では、8コマが 左上→右上、左下→右下 の順に並び、各コマの左上に番号と局面名が書いてあります。"
        f"局面は {'、'.join(f'{i + 1} {l}' for i, l in enumerate(labels))} です。"
        "インパクト音を基準に切り出したので、局面は目安です。"
    )
    has_trail = any(d.startswith("クラブ軌道") for d in per_swing)
    if has_trail:
        lines.append(
            f"クラブ軌道画像は、インパクトの{-trail_from}秒前から{trail_to}秒後までの約30コマのうち、"
            "その瞬間に動いていた部分（主にクラブと腕）を、時間順に青→緑→黄→赤で色付けしてインパクトのコマに重ねたものです。"
            "クラブヘッドとシャフトの通り道を読み取ってください。高速部分はぶれて薄く写ることがあります。"
        )
    if measurements:
        lines.append("骨格の推定（MediaPipe）から自動で測った数値です。カメラ1台からの推定なので目安として使い、画像と合わせて判断してください。")
        lines += [f"- {m}" for m in measurements]
    if coach_note:
        lines.append("これまでの記録からわかっている、この人の傾向（コーチのメモ）です。今回の球と比べて、"
                     "いつものクセが出ているか・良くなっているかにも触れてください: " + coach_note)
    if focus:
        lines.append(f"本人が直したい苦手: {focus}。各球でその苦手が出ているか・直せているかを必ず見て、"
                     "1球ごとのひとことで触れ、点数にも大きく反映してください（直せている球は高めに、出ている球は低めに）。")
    if scoring:
        lines.append("本人が付けた印（お手本・悪い例）や弾道から、この人の良い球・悪い球を分けている項目がわかっています。"
                     f"点数はこれに合うように付けてください: {scoring}")
    lines += [
        f"使用クラブ: {club_name}",
        f"撮影の向き: {rec.get('angle') or '不明'}",
        f"本人の悩み・意識したこと: {rec['concern']}" if rec.get("concern") else "本人の悩み: 特になし",
        "",
        "日本語で、次の形式だけで答えてください。見出しは「## 」、箇条書きは「- 」で始めてください。",
        "## 次に試すこと",
        "- （いちばん効果が大きい1つだけ。初心者にもわかる言葉で、どの局面で何をどう変えるかを1〜2文）",
        "## 理由",
        "（その1つを選んだ理由。どの球のどの局面でそう見えたか。2〜3文）",
        "## おすすめの練習",
        "- （「次に試すこと」に効く練習ドリルを1つだけ。やり方を簡潔に）",
        "## 良いところ",
        "- （1〜3個）",
    ]
    if has_trail:
        lines += [
            "## クラブの軌道",
            "- （ダウンスイングからフォローの軌道。インサイドアウト／アウトサイドイン／ほぼストレートのどれに近いか、"
            "スイングプレーンからの外れ、手元とヘッドの通り道など。撮影の向きから判断できる範囲で。"
            "弾道がわかる球は、軌道の読みと弾道が合っているかも確かめ、合わないときは「画像では判断しにくい」と書く）",
        ]
    has_face = any(d.startswith("手元の拡大画像") for d in per_swing)
    lines += [
        "## テークバックのフェースの向き",
        "- （シャフトが地面と平行になったあたりで、フェース（リーディングエッジ）の向きが、前傾した背骨の角度と比べて"
        "「シャット（地面を向く）」「スクエア（背骨とほぼ平行）」「オープン（空や正面を向く）」のどれに近いか。"
        + ("手元の拡大画像をよく見て判断してください。" if has_face else "")
        + "フェースが見えない・ぶれている場合は「この映像では判断しにくい」と書いてください）",
    ]
    lines += [
        "## 他の気づき",
        "- （次に試すこと以外で気になる点を最大2個。今すぐ直さなくてよいもの）",
    ]
    if used > 1:
        lines += ["## 1球ごとのひとこと", "- （「1球目: 〜」の形で各球1行）"]
    lines += [
        "",
        "画像から判断できないことは断定せず、「この角度では判断しにくい」と書いてください。",
        "ゴルフスイングが写っていない球があれば、その球は「スイングが写っていない」とだけ書いてください。",
        "",
        f"最後に、画面の点数表示に使うので、次の形の JSON を ```json と ``` で囲んで付けてください（1球目から順に{used}個）。",
        '{"swings": [{"score": 0〜100の整数, "note": "20字以内のひとこと"}]}',
        "点数の目安: 90以上=お手本にできる、75〜89=良い、50〜74=普通、49以下=要改善。"
        "アドレス・トップ・インパクトの形、クラブの軌道、フィニッシュのバランスを基準に、球ごとの差がわかるように付けてください。"
        "弾道（打った球の結果）がわかる球は、それも大きく反映してください。"
        "クラブ軌道画像はカメラ1台・夜間だと読み違えやすいので、本人がストレートなど良い球と記録した球を、"
        "軌道画像の見た目だけで「カット軌道」などと決めつけて大きく減点しないでください。"
        "スイングが写っていない球は score を null にしてください。",
    ]
    return "\n".join(lines)


def split_scores(text):
    """本文と、末尾の点数 JSON を分ける。戻り値は (本文, [{score, note}, ...] または None)。

    AI が ```json の囲みを付け忘れたり、```JSON と書いたりしても読めるようにしている。
    """
    import json
    import re
    fences = [m for m in re.finditer(r"```\s*json", text, re.I)]
    braces = [m.start() for m in re.finditer(r"\{\s*\"swings\"", text)]
    pos = braces[-1] if braces else (fences[-1].start() if fences else -1)
    if fences and braces and fences[-1].start() < pos and not text[fences[-1].end():pos].strip():
        pos = fences[-1].start()
    if pos < 0:
        return text.strip(), None
    body = text[:pos].rstrip()
    m = re.search(r"\{.*\}", text[pos:], re.S)
    if not m:
        return body, None
    try:
        data = json.loads(m.group(0))
    except ValueError:
        return body, None
    swings = data.get("swings") if isinstance(data, dict) else None
    return body, swings if isinstance(swings, list) else None


def _json_call(api_key, model, prompt):
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
    try:
        res = client.models.generate_content(
            model=model or DEFAULT_MODEL, contents=[prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
    except errors.APIError as e:
        raise AnalysisError(_error_message(e)) from e
    except (OSError, ValueError) as e:
        raise AnalysisError(f"Gemini につながりませんでした。インターネット接続を確認してください。({e})") from e
    import json
    try:
        return json.loads(res.text or "{}")
    except ValueError as e:
        raise AnalysisError("AI の答えを読み取れませんでした。もう一度お試しください。") from e


def scores_from_text(api_key, model, text, count, measurements=()):
    """分析の文章から1球ごとの点数を付けてもらう (画像は送らないので軽い)。"""
    prompt = "\n".join([
        f"次はゴルフのレッスンプロが{count}球のスイングを見て書いた分析です。",
        "この分析をもとに、1球ごとに点数を付けてください。",
        "点数の目安: 90以上=お手本にできる、75〜89=良い、50〜74=普通、49以下=要改善。球ごとの差がわかるように付けてください。",
        *(["骨格から測った数値:"] + [f"- {m}" for m in measurements] if measurements else []),
        "",
        text,
        "",
        f'JSON だけで答えてください（1球目から順に{count}個）: {{"swings": [{{"score": 0〜100の整数, "note": "20字以内のひとこと"}}]}}',
    ])
    data = _json_call(api_key, model, prompt)
    swings = data.get("swings") if isinstance(data, dict) else None
    return swings if isinstance(swings, list) else None


# 振り返りノートの整理の形式 (画面の claude.ai 版 app.js の notePrompt と同じ内容にする)
NOTE_FORMAT_HEAD = [
    "本人はゴルフの正解がまだよく分かっていません。メモは本人の言葉のまま整理し、AI はそれに技術的な補足を付けます。",
    "日本語で、次の形式だけで書いてください。見出しは「## 」「### 」、箇条書きは「- 」（一段下げるときは「  - 」）で始めてください。",
    "## メモの整理",
    "（本人のメモを、項目ごと（例: ### アドレス、### アプローチ、### アイアン、### ドライバー、### パター、### ドリル、### 気になること）"
    "に分けて、本人の言葉をできるだけそのまま短い箇条書きにする。誤字は直し、同じ内容はまとめる。"
    "AI の意見や説明は入れない。メモにない項目は作らない。見返してすぐわかる、シンプルなまとめにする）",
    "## 今日のまとめ", "（1〜2文）",
    "## メモへの技術的な補足",
    "（メモの中で、本人が疑問に思っていること・わからないと書いていること・うまくいかないことを優先して、大事なものから最大6個。次の形で）",
    "- **「メモの言葉そのまま」**",
    "  - 何が起きているか: （ゴルフの用語はかみくだいて）",
    "  - 正しい動き: （目指す形。体のどこがどう動くか）",
    "  - 確かめ方: （鏡・動画・ドリルなど、本人が確かめられる方法）",
]
NOTE_FORMAT_VIDEO = [
    "## 動画から見えたこと", "- （点数の高い球と低い球の違いなど。「〇時〇分の1球目」のように球を特定して。メモの感覚と合っているか・ずれているかも）",
]
NOTE_FORMAT_TAIL = [
    "## 次の練習でやること", "- （いちばん大事な1つを最初に。具体的に1〜2個）",
    "",
    "メモに書いていないことを事実のように書かないでください。動画の記録がない日は動画に触れないでください。",
    "",
    "最後に、本人がつかんだ感覚・イメージを集めます。メモの中に「〇〇な感じ」「〇〇のイメージ」「〇〇を意識したら良くなった」"
    "のような、本人なりの感覚で効果があったものがあれば、次の JSON を ```json と ``` で囲んで1つだけ付けてください。"
    "なければ feels を空の配列にしてください。",
    '{"feels": [{"phrase": "本人の言葉そのまま（短く）", "fixes": "何が良くなったか・どんな場面で使うか（40字以内）", "club": "クラブ（わかれば。なければ空）"}]}',
]


def split_feels(text):
    """整理した文章と、「つかんだ感覚」の JSON を分ける。戻り値は (本文, [{phrase, fixes, club}, ...])。

    JSON が2つ以上付いていても、全部を本文から取り除いて、中身はまとめて返す。
    """
    import json
    import re
    out = []
    pattern = re.compile(r"```\s*json\s*(\{.*?\})\s*```", re.S | re.I)
    for m in pattern.finditer(text):
        try:
            feels = json.loads(m.group(1)).get("feels") or []
        except (ValueError, AttributeError):
            continue
        for f in feels if isinstance(feels, list) else []:
            if isinstance(f, dict) and str(f.get("phrase") or "").strip():
                out.append({"phrase": str(f["phrase"]).strip()[:80], "fixes": str(f.get("fixes") or "").strip()[:120],
                            "club": str(f.get("club") or "").strip()[:20]})
    return pattern.sub("", text).strip(), out


def organize_note(api_key, model, memo, day_label, swing_lines, tendency=(), theme=None):
    """練習後のメモを、その日のスイング記録と合わせて読みやすく整理する。"""
    lines = [
        "あなたはアマチュアゴルファーに寄り添うレッスンプロです。",
        f"次は{day_label}の練習後に本人が書いた振り返りメモです（走り書きです）。",
        "---", memo.strip() or "（メモなし）", "---",
    ]
    if swing_lines:
        lines += ["同じ日に撮ったスイング動画の記録（AIの点数・ひとこと・骨格からの計測・分析の要点）です。"]
        lines += swing_lines
    else:
        lines += ["この日のスイング動画の記録はありません。"]
    if tendency:
        lines += ["最近の傾向（姿勢の計測から自動で集計）:"] + [f"- {t}" for t in tendency]
    if theme:
        lines.append(f"今のテーマ: {theme}")
    lines += ["", *NOTE_FORMAT_HEAD]
    if swing_lines:
        lines += NOTE_FORMAT_VIDEO
    lines += NOTE_FORMAT_TAIL
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
    try:
        res = client.models.generate_content(model=model or DEFAULT_MODEL, contents=["\n".join(lines)])
    except errors.APIError as e:
        raise AnalysisError(_error_message(e)) from e
    except (OSError, ValueError) as e:
        raise AnalysisError(f"Gemini につながりませんでした。インターネット接続を確認してください。({e})") from e
    text = (res.text or "").strip()
    if not text:
        raise AnalysisError("整理した結果が空でした。もう一度お試しください。")
    return text


def generate_text(api_key, model, prompt):
    """画像なしで文章を書いてもらう (コーチのメモなど)。"""
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
    try:
        res = client.models.generate_content(model=model or DEFAULT_MODEL, contents=[prompt])
    except errors.APIError as e:
        raise AnalysisError(_error_message(e)) from e
    except (OSError, ValueError) as e:
        raise AnalysisError(f"Gemini につながりませんでした。インターネット接続を確認してください。({e})") from e
    text = (res.text or "").strip()
    if not text:
        raise AnalysisError("返事が空でした。もう一度お試しください。")
    return text


def _error_message(e):
    text = (getattr(e, "message", None) or str(e)).lower()
    code = getattr(e, "code", 0) or 0
    if "api key" in text or "api_key" in text or code in (401, 403):
        return "Gemini の API キーが正しくありません。設定タブで入れ直してください。"
    if code == 404 or "not found" in text:
        return "そのモデル名は使えません。設定タブでモデル名を確認してください。"
    if code == 429 or "quota" in text or "exhausted" in text:
        return "Gemini の利用回数の上限に達しました。しばらく（無料枠は翌日）待ってからお試しください。"
    if code >= 500:
        return f"Gemini のサーバーでエラーが起きました ({code})。時間をおいてお試しください。"
    return f"Gemini でエラーが起きました: {getattr(e, 'message', None) or e}"


def analyze(api_key, model, prompt, images, on_text, cancelled):
    """画像とプロンプトを送り、書かれていく途中の文章を on_text に渡す。

    戻り値は (全文, 途中で切れたか)。cancelled() が真になったら打ち切る。
    """
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
    contents = [types.Part.from_bytes(data=img, mime_type="image/jpeg") for img in images]
    contents.append(prompt)
    text = ""
    finish = None
    try:
        for chunk in client.models.generate_content_stream(model=model or DEFAULT_MODEL, contents=contents):
            if chunk.text:
                text += chunk.text
                on_text(text)
            if chunk.candidates and chunk.candidates[0].finish_reason:
                finish = str(chunk.candidates[0].finish_reason)
            if cancelled():
                return text, False
    except errors.APIError as e:
        raise AnalysisError(_error_message(e)) from e
    except (OSError, ValueError) as e:
        raise AnalysisError(f"Gemini につながりませんでした。インターネット接続を確認してください。({e})") from e
    if not text.strip():
        if finish and ("SAFETY" in finish or "PROHIBITED" in finish or "BLOCK" in finish):
            raise AnalysisError("この動画は分析できませんでした。")
        raise AnalysisError("分析結果が空でした。もう一度お試しください。")
    return text, bool(finish and "MAX_TOKENS" in finish)


def guess_club(api_key, model, images, choices):
    """スイングのコマから使ったクラブを推定する。choices は [(ID, 名前), ...]。

    戻り値は {"club": ID, "reason": 理由} 。分からなければ None。
    """
    import json
    ids = [c for c, _ in choices]
    listing = "、".join(f"{c}（{name}）" for c, name in choices)
    prompt = (
        "添付の画像は、ゴルフ練習場で撮ったスイング動画のアドレスとインパクトのコマです。"
        f"使っているクラブを次の中から1つ選んでください: {listing}。"
        "ティーの高さ、ヘッドの大きさと形、シャフトの長さ、ボールとの距離から判断してください。"
        "アイアンの番手は見分けにくいので、アイアンだと思ったら 7I があれば 7I を選んでください。"
        'JSON だけで答えてください: {"club": "ID", "reason": "20字以内の理由"}'
    )
    client = genai.Client(api_key=api_key) if api_key else genai.Client()
    contents = [types.Part.from_bytes(data=img, mime_type="image/jpeg") for img in images] + [prompt]
    try:
        res = client.models.generate_content(
            model=model or DEFAULT_MODEL, contents=contents,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        data = json.loads(res.text or "{}")
    except (errors.APIError, OSError, ValueError):
        return None
    club = str(data.get("club", "")).strip().upper() if isinstance(data, dict) else ""
    if club not in ids:
        return None
    return {"club": club, "reason": str(data.get("reason") or "")[:40]}
