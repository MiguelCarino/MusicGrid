#!/usr/bin/env python3
"""lyricsync.py — measure how far a video's singing is from its LRCLIB lyrics.

A music video often opens with a scene, a skit or a long intro the studio
recording does not have, so its lyrics come in early (1DOSTRES4: 15.8 s).
This listens to the video and says by how much, so the catalog can carry
the fix as "lrcoffset" (the player's timing; + shows lines sooner, −
later). It plays nothing and stores nothing: the audio is downloaded to a
temporary folder, transcribed on the CPU with faster-whisper, and deleted.

  lyricsync.py VIDEO_ID ...       measure these catalog songs
  lyricsync.py --flagged          every linked song whose video and lyrics
                                  record differ in length by more than 3 s
  options: --apply (write the confident results into the catalog)
           --model large-v3-turbo|small|base (default large-v3-turbo: far better
                   on sung lyrics, about as fast on the CPU)
           --threads N (default 4)

How: whisper writes down what it hears with a time per word; each lyric
line is looked for in that text (the longest stretch they share, near
where the line should be), and the gap between the line's time in the
record and where it is heard is one estimate. The median of the estimates
that agree is the offset. Spoken intros don't match a lyric line, so they
don't count. When the early and late lines disagree (a skit in the
middle), one offset can't fix it, and the result says so.

Whisper comes from the voice venv (~/.local/share/voice/venv) and its
models folder unless MG_WHISPER_PY / MG_WHISPER_MODELS say otherwise; this
script re-runs itself under that Python when needed.
"""

import os
import sys

VOICE = os.path.expanduser("~/.local/share/voice")
try:
    import faster_whisper  # noqa: F401
except ImportError:
    py = os.environ.get("MG_WHISPER_PY") or os.path.join(VOICE, "venv/bin/python")
    if os.path.exists(py) and not os.environ.get("MG_LYRICSYNC_REEXEC"):
        os.environ["MG_LYRICSYNC_REEXEC"] = "1"
        os.execv(py, [py, os.path.abspath(__file__)] + sys.argv[1:])
    sys.exit("faster-whisper is not installed (pip install faster-whisper, or set MG_WHISPER_PY)")

import argparse
import difflib
import json
import re
import statistics
import subprocess
import tempfile
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import addsong  # noqa: E402

REPO = addsong.REPO
CATALOG = REPO / "assets/json/catalog.json"
MODELS = os.environ.get("MG_WHISPER_MODELS") or os.path.join(VOICE, "models")
GAP_LINE = re.compile(r"^[\s♪♫…・.\-–—]*$|^[(（\[]\s*(instrumental|interlude|intro|outro|solo|music|break|間奏)", re.I)


# ── the lyrics ───────────────────────────────────────────────────────────

def cues_of(lrc):
    out = []
    for line in (lrc or "").splitlines():
        for m in re.finditer(r"\[(\d+):(\d+(?:\.\d+)?)\]", line):
            text = re.sub(r"\[[^\]]*\]", "", line).strip()
            if text and not GAP_LINE.search(text):
                out.append((int(m.group(1)) * 60 + float(m.group(2)), text))
    return sorted(out)


def language_of(text):
    if re.search(r"[぀-ヿ]", text):
        return "ja"
    if re.search(r"[가-힯]", text):
        return "ko"
    if re.search(r"[Ѐ-ӿ]", text):
        return "uk" if re.search(r"[іїєґ]", text, re.I) else "ru"
    if re.search(r"[一-鿿]", text):
        return "zh"
    return None   # whisper tells Latin-script languages apart well enough


def norm(s):
    s = unicodedata.normalize("NFKC", s).lower()
    return "".join(c for c in s if c.isalnum())


# ── the audio ────────────────────────────────────────────────────────────

def download(vid, folder):
    out = subprocess.run(
        ["yt-dlp", "-q", "--no-playlist", "-f", "bestaudio[ext=m4a]/bestaudio",
         "-o", os.path.join(folder, "a.%(ext)s"), f"https://www.youtube.com/watch?v={vid}"],
        capture_output=True, text=True, timeout=300)
    files = list(Path(folder).glob("a.*"))
    if not files:
        raise RuntimeError("download failed: " + (out.stderr.strip().splitlines() or ["?"])[-1][:200])
    return str(files[0])


_model = {}


def model(name, threads):
    if name not in _model:
        from faster_whisper import WhisperModel
        kw = {"device": "cpu", "compute_type": "int8", "cpu_threads": threads}
        if os.path.isdir(MODELS):
            kw["download_root"] = MODELS
        try:
            _model[name] = WhisperModel(name, local_files_only=True, **kw)
        except Exception:
            _model[name] = WhisperModel(name, **kw)
    return _model[name]


def transcribe(path, lang, name, threads):
    """-> (text, times): the heard text as one string (letters and digits
    only) and, for each character, the time it starts."""
    import numpy as np
    pcm = subprocess.run(["ffmpeg", "-v", "quiet", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                         capture_output=True, timeout=300).stdout   # decoded here: the venv's PyAV may not match
    audio = np.frombuffer(pcm, dtype=np.float32)
    if not audio.size:
        raise RuntimeError("could not decode the audio")
    segs, _ = model(name, threads).transcribe(
        audio, language=lang, word_timestamps=True, vad_filter=False,
        condition_on_previous_text=False, beam_size=5)
    text, times = [], []
    for seg in segs:
        for w in seg.words or []:
            t = norm(w.word)
            text.append(t)
            times += [w.start] * len(t)
    return "".join(text), times


# ── the match ────────────────────────────────────────────────────────────

def estimates(cues, heard, times, around=None, window=25.0):
    """[(cue time, offset)] for the lines found in what was heard. around:
    a first guess at the offset; then a line is only looked for near where
    it should be (so a chorus isn't matched to an earlier chorus)."""
    out = []
    for t, line in cues:
        want = norm(line)
        if len(want) < 4:
            continue
        lo, hi = 0, len(heard)
        if around is not None:
            a, b = t - around - window, t - around + window
            lo = next((i for i, x in enumerate(times) if x >= a), len(heard))
            hi = next((i for i, x in enumerate(times) if x > b), len(heard))
            if hi - lo < 4:
                continue
        sm = difflib.SequenceMatcher(None, heard[lo:hi], want, autojunk=False)
        m = sm.find_longest_match(0, hi - lo, 0, len(want))
        if m.size < max(4, int(len(want) * 0.4)):
            continue
        pos = lo + m.a - m.b          # where the line would start in the heard text
        if pos < 0 or pos >= len(times):
            pos = lo + m.a
        out.append((t, round(t - times[pos], 2)))
    return out


def measure(vid, rec, name="small", threads=4, log=print):
    cues = cues_of(rec.get("syncedLyrics"))
    if len(cues) < 4:
        return {"vid": vid, "error": "too few lyric lines"}
    lang = language_of(" ".join(c[1] for c in cues))
    with tempfile.TemporaryDirectory(prefix="lyricsync-") as tmp:
        log(f"  downloading audio…")
        path = download(vid, tmp)
        log(f"  listening ({name}, {lang or 'auto'})…")
        t0 = time.time()
        heard, times = transcribe(path, lang, name, threads)
        took = time.time() - t0
    if not heard:
        return {"vid": vid, "error": "heard nothing"}
    first = estimates(cues, heard, times)
    if not first:
        return {"vid": vid, "error": "no lyric line recognised", "took": took}
    guess = statistics.median(o for _, o in first)
    est = estimates(cues, heard, times, around=guess)
    agree = [(t, o) for t, o in est if abs(o - guess) <= 1.2]
    if not agree:
        return {"vid": vid, "error": "the lines found don't agree", "took": took}
    off = statistics.median(o for _, o in agree)
    off = round(off * 20) / 20     # 0.05 s steps
    half = len(agree) // 2
    drift = 0.0
    if len(agree) >= 8:
        drift = statistics.median(o for _, o in agree[half:]) - statistics.median(o for _, o in agree[:half])
    confidence = len(agree) / max(1, len([c for c in cues if len(norm(c[1])) >= 4]))
    return {"vid": vid, "offset": off, "lines": len(agree), "of": len(cues), "confidence": round(confidence, 2),
            "drift": round(drift, 2), "lang": lang, "took": round(took)}


def verdict(r):
    if "error" in r:
        return "unsure", r["error"]
    if r["lines"] < 5 or r["confidence"] < 0.25:
        return "unsure", f"only {r['lines']} of {r['of']} lines recognised"
    if abs(r["drift"]) > 1.5:
        return "drift", (f"the timing moves by {r['drift']:+.1f}s during the song (a pause or a"
                         " skit in the middle): one offset can't fix it")
    if abs(r["offset"]) < 0.4:
        return "none", "in time already"
    return "fix", f"lrcoffset {r['offset']:+.2f}"


# ── the catalog ──────────────────────────────────────────────────────────

def entries():
    src = CATALOG.read_text(encoding="utf-8")
    return src, {e["url"]: e for e in
                 (json.loads(m) for m in re.findall(r'^\s*(\{"url".*\})\s*,?\s*$', src, re.M))}


def record(lrclib_id):
    return addsong._lrclib(f"get/{lrclib_id}", {}) or {}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="video ids of catalog songs")
    ap.add_argument("--flagged", action="store_true",
                    help="every linked song whose video and lyrics record differ by more than 3 s")
    ap.add_argument("--apply", action="store_true", help="write the confident offsets into the catalog")
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--threads", type=int, default=4)
    args = ap.parse_args()

    _, songs = entries()
    todo = []
    for vid in args.ids:
        e = songs.get(vid)
        if not e:
            print(f"{vid}: not in the catalog")
        elif not e.get("lrclib"):
            print(f"{vid}: has no lyrics (batchadd.py lyrics {vid})")
        else:
            todo.append(e)
    if args.flagged:
        linked = [e for e in songs.values() if e.get("lrclib") and "lrcoffset" not in e]
        print(f"checking the length of {len(linked)} linked songs…")
        for e in linked:
            rec = record(e["lrclib"])
            vlen = addsong.video_length(e["url"])
            if vlen and rec.get("duration") and abs(vlen - rec["duration"]) > 3:
                print(f"  {e['tag']}: video {vlen - rec['duration']:+.0f}s")
                todo.append(e)
            time.sleep(0.3)
    if not todo:
        print("nothing to measure")
        return

    results = []
    for n, e in enumerate(todo, 1):
        print(f"[{n}/{len(todo)}] {e['tag']} ({e['url']})")
        rec = record(e["lrclib"])
        try:
            r = measure(e["url"], rec, args.model, args.threads)
        except Exception as ex:
            r = {"vid": e["url"], "error": str(ex)[:200]}
        kind, why = verdict(r)
        detail = (f"  {r['lines']}/{r['of']} lines, {r['took']}s" if "lines" in r else "")
        print(f"  → {kind}: {why}{detail}")
        results.append((e, r, kind))

    fixes = [(e, r) for e, r, k in results if k == "fix"]
    print(f"\n{len(fixes)} to fix, {sum(k == 'none' for _, _, k in results)} in time,"
          f" {sum(k in ('unsure', 'drift') for _, _, k in results)} to check by hand")
    if args.apply and fixes:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import batchadd
        src = CATALOG.read_text(encoding="utf-8")
        for e, r in fixes:
            src = batchadd.set_field(src, e["url"], "lrcoffset", r["offset"])
        CATALOG.write_text(src, encoding="utf-8")
        print(f"wrote {len(fixes)} lrcoffset values (git diff to review).")
    elif fixes:
        print("run again with --apply to write them.")


if __name__ == "__main__":
    main()
