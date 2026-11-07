#!/usr/bin/env python3
"""addsong.py — interactive helper to add a song to the MusicGrid catalog.

Usage:
  addsong.py <search terms | youtube url | video id>

Flow: search YouTube (yt-dlp) -> pick video -> search iTunes -> pick match
(fills tag + Apple Music path + 1000px cover) -> optional Spotify paste ->
pick country/genre/mood from the catalog registries -> cover saved as
assets/covers/mu_N.webp -> entry appended to the albums array.

Non-interactive / scripting flags: --pick --itunes-pick --country --genre
--mood --tag --spotify --carino/--no-carino --yes --dry-run
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "Mozilla/5.0 (MusicGrid addsong)"}

NOISE = re.compile(
    r"\s*[\(\[](official|officiel|hd|4k|lyric|lyrics|audio|video|music video|"
    r"visualizer|remaster(ed)?( \d{4})?|clip|mv|m/v|sub|live)[^\)\]]*[\)\]]", re.I)


def fetch(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def clean_title(t):
    t = NOISE.sub("", t)
    return re.sub(r"\s{2,}", " ", t).strip(" -–—|")


def video_id_from(arg):
    m = re.search(r"(?:youtu\.be/|[?&]v=|/shorts/|/embed/)([\w-]{11})", arg)
    if m:
        return m.group(1)
    if re.fullmatch(r"[\w-]{11}", arg) and not arg.isalpha():
        return arg
    return None


def yt_search(query, n=8):
    out = subprocess.run(
        ["yt-dlp", f"ytsearch{n}:{query}", "--flat-playlist", "--dump-json"],
        capture_output=True, text=True, timeout=60)
    vids = []
    for line in out.stdout.splitlines():
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        dur = d.get("duration")
        vids.append({
            "id": d.get("id"),
            "title": d.get("title") or "?",
            "channel": d.get("channel") or d.get("uploader") or "?",
            "dur": f"{int(dur // 60)}:{int(dur % 60):02d}" if dur else "?",
            "secs": float(dur) if dur else 0.0,
        })
    return vids


def yt_oembed_title(vid):
    try:
        d = json.loads(fetch(
            "https://www.youtube.com/oembed?format=json&url="
            + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}")))
        return d.get("title", "")
    except Exception:
        return ""


def itunes_search(term, n=8):
    url = ("https://itunes.apple.com/search?media=music&entity=song&limit="
           f"{n}&term=" + urllib.parse.quote(term))
    try:
        return json.loads(fetch(url)).get("results", [])
    except Exception:
        return []


def apple_path(track_view_url):
    p = track_view_url.split("music.apple.com/", 1)[-1]
    return re.sub(r"&uo=\d+$", "", p)


# ── Lyrics matching (LRCLIB) ─────────────────────────────────────────────
# The catalog writes Russian and Japanese titles in Latin letters ("Padat' v
# gryaz'", "Yoru ni Kakeru") while LRCLIB mostly has them in their own script
# ("Падать в грязь", "夜に駆ける"). lrclib_find() searches with every form it
# has (the tag, a Cyrillic spelling of it, native titles from the iTunes
# store of the artist's country) and compares in Latin letters, so either
# side may be in either script.

LAT2CYR = [  # longest first
    ("shch", "щ"), ("yo", "ё"), ("zh", "ж"), ("kh", "х"), ("ts", "ц"), ("ch", "ч"),
    ("sh", "ш"), ("yu", "ю"), ("ya", "я"), ("ye", "е"), ("iy", "ий"), ("yy", "ый"),
    ("y", "ы"), ("'", "ь"), ("a", "а"), ("b", "б"), ("v", "в"), ("g", "г"), ("d", "д"),
    ("e", "е"), ("z", "з"), ("i", "и"), ("j", "й"), ("k", "к"), ("l", "л"), ("m", "м"),
    ("n", "н"), ("o", "о"), ("p", "п"), ("r", "р"), ("s", "с"), ("t", "т"), ("u", "у"),
    ("f", "ф"), ("h", "х"), ("c", "к"), ("w", "в"), ("x", "кс"), ("q", "к"),
]
CYR2LAT = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh",
           "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
           "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
           "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
           "я": "ya", "і": "i", "ї": "yi", "є": "ye", "ґ": "g"}


def to_cyrillic(text):
    """Latin transliteration of Russian back to Cyrillic, best effort
    ("Padat' v gryaz'" -> "падать в грязь"). A vowel-initial y + vowel at a
    word start ("Yolka") comes out right; rarer spellings may not."""
    out, t, i = [], text.lower().replace("’", "'"), 0
    while i < len(t):
        for lat, cyr in LAT2CYR:
            if t.startswith(lat, i):
                out.append(cyr)
                i += len(lat)
                break
        else:
            out.append(t[i])
            i += 1
    return "".join(out)


def to_latin(text):
    """Cyrillic -> Latin (other scripts pass through)."""
    return "".join(CYR2LAT.get(c, CYR2LAT.get(c.lower(), c)) for c in text)


def _norm(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", to_latin((s or "").lower()))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[\W_]+", " ", s).strip()


def _sim(a, b):
    import difflib
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if len(a) >= 4 and len(b) >= 4 and (a in b or b in a):
        return 0.92
    return difflib.SequenceMatcher(None, a, b).ratio()


def is_latin(text):
    return bool(text) and all(ord(c) < 0x250 for c in text)


def video_length(vid):
    """Seconds, from the watch page (no download); 0 if unknown."""
    try:
        html = fetch(f"https://www.youtube.com/watch?v={vid}", timeout=20).decode("utf-8", "replace")
        m = re.search(r'"lengthSeconds":"(\d+)"', html)
        return int(m.group(1)) if m else 0
    except Exception:
        return 0


STORE_FOR = {"japan": "jp", "russia": "ru", "korea": "kr", "ukraine": "ua", "china": "cn",
             "taiwan": "tw", "greece": "gr", "israel": "il", "thailand": "th"}


def itunes_native(track_id, country):
    """The same iTunes track as the store of the artist's country lists it:
    native-script titles ("Yoru ni Kakeru" -> "夜に駆ける"). -> (artist, track) or None"""
    store = STORE_FOR.get(country or "")
    if not track_id or not store:
        return None
    try:
        r = json.loads(fetch(f"https://itunes.apple.com/lookup?id={track_id}&country={store}"))
        hit = (r.get("results") or [None])[0]
        if hit and hit.get("trackName"):
            return hit.get("artistName", ""), clean_title(hit["trackName"])
    except Exception:
        pass
    return None


def itunes_native_search(artist, track, country, seconds=0):
    """No iTunes track id: search the store of the artist's country, first
    for "artist title" (it knows many romaji titles), then among the
    artist's songs for one of the same length. -> (artist, track, by_length) or None"""
    import time
    store = STORE_FOR.get(country or "")
    if not store:
        return None
    def search(term, n):
        time.sleep(3.1)   # iTunes allows ~20 calls a minute
        try:
            return json.loads(fetch("https://itunes.apple.com/search?media=music&entity=song"
                                    f"&country={store}&limit={n}&term=" + urllib.parse.quote(term))).get("results", [])
        except Exception:
            return []
    artists = [artist]
    for who in artists:
        for h in search(f"{who} {track}", 5):
            secs = (h.get("trackTimeMillis") or 0) / 1000
            if not seconds or abs(secs - seconds) <= 8:
                return h.get("artistName", ""), clean_title(h.get("trackName", "")), False
        if seconds:
            near = [h for h in search(who, 200)
                    if abs((h.get("trackTimeMillis") or 0) / 1000 - seconds) <= 1.5
                    and _sim(h.get("artistName"), who) >= 0.6]
            names = {clean_title(h.get("trackName", "")) for h in near}
            if len(names) == 1:     # one song of that length: a hint, not proof
                return near[0].get("artistName", ""), names.pop(), True
        if who is artist:
            native = mb_native_artist(artist)   # the store may only know カネコアヤノ
            if native:
                artists.append(native)
    return None


def mb_native_artist(artist):
    """The artist's name in its own script, from MusicBrainz (its aliases
    hold the romaji / Latin spellings). -> name or ''"""
    import time
    time.sleep(1.1)   # MusicBrainz: one request a second
    try:
        req = urllib.request.Request(
            "https://musicbrainz.org/ws/2/artist/?fmt=json&limit=3&query=" + urllib.parse.quote(f'"{artist}"'),
            headers={"User-Agent": "MusicGrid-addsong/1.0 ( https://music.carino.systems )", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            for a in json.loads(r.read()).get("artists", []):
                names = [a.get("name", ""), a.get("sort-name", "")] + [x.get("name", "") for x in a.get("aliases") or []]
                if a.get("score", 0) >= 90 and max(_sim(n, artist) for n in names) >= 0.9 \
                        and not is_latin(a.get("name", "")):
                    return a["name"]
    except Exception:
        pass
    return ""


def native_titles(video_title, artists=()):
    """Song titles in their own script, read off the video's title: Japanese
    and Russian uploads usually carry them ("ネクライトーキーMV「北上のススメ」",
    "カネコアヤノ - ロマンス宣言 / Kaneko Ayano - Romance sengen"). -> [titles]"""
    t = video_title or ""
    quoted = re.findall(r"[「『](.+?)[」』]", t)
    parts = quoted or re.split(r"\s+[-–—/|／]\s+|\s*[／|]\s*|\s-\s|^-|-$", t)
    out = []
    for p in parts:
        p = clean_title(re.sub(r"(?i)\b(MV|PV|M/V|music video|official)\b|-music video-", "", p)).strip(" -–—/|／\u3000")
        for a in artists:
            if a and p.startswith(a):
                p = p[len(a):].strip(" -–—/|／")
        if p and not is_latin(p) and p not in out:
            out.append(p)
            short = re.split(r"\s*[～〜~(（]", p)[0].strip()
            if short and short != p and short not in out:
                out.append(short)
    return out


def track_id_from_apple(path):
    m = re.search(r"[?&]i=(\d+)", path or "")
    return m.group(1) if m else ""


def _lrclib(path, params):
    import time
    for attempt in range(3):
        try:
            return json.loads(fetch("https://lrclib.net/api/" + path + "?" + urllib.parse.urlencode(params),
                                    timeout=15))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 + attempt * 3)
        except Exception:
            time.sleep(2 + attempt * 3)
    return None


def lrclib_find(artist, track, duration=0, alts=(), country=""):
    """Best synced LRCLIB record for a song, or None.

    duration: what the record should last (the iTunes track, else the
    video); alts: more (artist, track) spellings, e.g. itunes_native().
    Returns {id, lyrics, duration, artist, track, sure, why}: sure is False
    for a match worth a look (a title that only matches through the length,
    or a record 8-20 s off)."""
    import time
    weak = {(a[0], a[1]) for a in alts if a and len(a) > 2 and a[2]}
    names = [(artist, track)] + [(a[0], a[1]) for a in alts if a and a[1]]
    if country in ("russia", "ukraine") and is_latin(track):
        names.append((to_cyrillic(artist), to_cyrillic(track)))
    queries = []
    for a, t in names:
        queries += [{"artist_name": a, "track_name": t}, {"q": f"{a} {t}"}, {"q": t}]
    queries += [{"q": a} for a, _ in names]   # last: everything by the artist, matched by length
    seen = {}
    for q in queries:
        for r in _lrclib("search", q) or []:
            if r.get("syncedLyrics") and not r.get("instrumental"):
                seen.setdefault(r["id"], r)
        time.sleep(0.3)
    best = None
    for r in seen.values():
        st_by = {(a, t): _sim(t, r.get("trackName")) for a, t in names}
        via = max(st_by, key=st_by.get)
        st = st_by[via]
        sa = max(_sim(a, r.get("artistName")) for a, _ in names)
        dd = abs((r.get("duration") or 0) - duration) if duration and r.get("duration") else None
        if sa < 0.6:
            continue
        if st >= 0.85 and via in weak and (dd is None or dd <= 7):
            tier, why = 2, "title found in the iTunes store by length only: confirm it is the song"
        elif st >= 0.85 and (dd is None or dd <= 7):
            tier, why = 3, "title, artist and length match"
        elif st >= 0.85 and dd is not None and dd <= 20:
            tier, why = 2, f"same song, {dd:.0f}s longer or shorter: check the timing"
        elif st < 0.85 and sa >= 0.85 and dd is not None and dd <= 1.5 and not is_latin(r.get("trackName", "")):
            tier, why = 2, "same artist and length, title in another script: confirm it is the song"
        else:
            continue
        key = (tier, sa + st, -(dd or 0))
        if not best or key > best[0]:
            best = (key, r, why)
    if not best:
        return None
    (tier, _, _), r, why = best
    return {"id": r["id"], "lyrics": r["syncedLyrics"], "duration": r.get("duration") or 0,
            "artist": r.get("artistName", ""), "track": r.get("trackName", ""),
            "sure": tier == 3, "why": why}


def official_audio(artist, track, seconds):
    """A YouTube upload whose length matches the lyrics record (the "Artist -
    Topic" art track or an official audio): no intro, so no offset. -> hit or None"""
    if not seconds:
        return None
    best = None
    for h in yt_search(f"{artist} {track} audio", 8):
        if not h.get("secs") or abs(h["secs"] - seconds) > 2:
            continue
        rank = 2 if h["channel"].endswith(" - Topic") else 1 if re.search(r"audio", h["title"], re.I) else 0
        if _sim(track, h["title"]) < 0.5 and rank < 2:
            continue
        if not best or rank > best[0]:
            best = (rank, h)
    return best[1] if best else None


def lrclib_lyrics(artist, track, album="", duration=0):
    """Find synced LRC lyrics on lrclib.net (keyless, community DB).

    Returns (lyrics, id): the text, for previewing, and the LRCLIB record id,
    which is what the catalog stores ("lrclib"). The site never hosts lyrics:
    they are copyrighted, so the player fetches the record from LRCLIB at play
    time. ('', None) on no match or any network trouble — best-effort."""
    base = "https://lrclib.net/api/"
    params = {"artist_name": artist, "track_name": track}
    if album:
        params["album_name"] = album
    if duration:
        params["duration"] = str(int(round(duration)))
    try:
        d = json.loads(fetch(base + "get?" + urllib.parse.urlencode(params), timeout=10))
        if d.get("syncedLyrics"):
            return d["syncedLyrics"], d.get("id")
    except urllib.error.HTTPError:
        pass          # 404 = no exact match; the search fallback may still hit
    except Exception:
        return "", None   # timeout / network trouble: don't stall on a second request
    try:
        arr = json.loads(fetch(base + "search?" + urllib.parse.urlencode(
            {"artist_name": artist, "track_name": track}), timeout=10))
        for r in arr:
            if not r.get("syncedLyrics"):
                continue
            if duration and r.get("duration") and abs(r["duration"] - duration) > 7:
                continue
            return r["syncedLyrics"], r.get("id")
    except Exception:
        pass
    return "", None


def spotify_id_from(text):
    m = re.search(r"track[/:]([A-Za-z0-9]{22})", text)
    if m:
        return m.group(1)
    if re.fullmatch(r"[A-Za-z0-9]{22}", text.strip()):
        return text.strip()
    return ""


def load_catalog(path):
    src = path.read_text(encoding="utf-8")
    regs = {}
    for name in ("COUNTRIES", "GENRES", "MOODS"):
        m = re.search(rf"const\s+{name}\s*=\s*(\{{.*?\n\}})\s*;", src, re.S)
        regs[name] = json.loads(m.group(1)) if m else {}
    used = [int(n) for n in re.findall(r'"image"\s*:\s*"mu_(\d+)\.webp"', src)]
    return src, regs, used


def pick(prompt, items, render, preset=None, allow_zero=False):
    if preset is not None:
        return preset
    for i, it in enumerate(items, 1):
        print(f"  [{i}] {render(it)}")
    if allow_zero:
        print("  [0] none / skip")
    while True:
        raw = input(f"{prompt} ").strip()
        if allow_zero and raw in ("0", ""):
            return 0
        if raw.isdigit() and 1 <= int(raw) <= len(items):
            return int(raw)
        print("  ?")


def pick_registry(label, reg, preset=None):
    ids = sorted(reg)
    if preset is not None:
        if preset in reg:
            return preset
        sys.exit(f"error: unknown {label} id '{preset}' (have: {', '.join(ids)})")
    cols = 3
    rows = (len(ids) + cols - 1) // cols
    for r in range(rows):
        line = ""
        for c in range(cols):
            i = r + c * rows
            if i < len(ids):
                k = ids[i]
                icon = reg[k].get("flag") or reg[k].get("icon") or ""
                line += f"  [{i + 1:2}] {icon} {k}".ljust(30)
        print(line)
    while True:
        raw = input(f"{label}: ").strip()
        if raw in reg:
            return raw
        if raw.isdigit() and 1 <= int(raw) <= len(ids):
            return ids[int(raw) - 1]
        print("  ? (number or id)")


def next_image_name(covers, used_nums):
    nums = used_nums + [int(m.group(1)) for f in covers.glob("mu_*.webp")
                        if (m := re.match(r"mu_(\d+)\.webp$", f.name))]
    return f"mu_{max(nums, default=0) + 1}.webp"


def entry_line(entry):
    return json.dumps(entry, ensure_ascii=False, separators=(",", ":"))


def append_entry(catalog_path, entry):
    """Insert entry before the closing ]; of the albums array. Returns the line."""
    src = catalog_path.read_text(encoding="utf-8")
    line = entry_line(entry)
    m = re.search(r"(const\s+albums\s*=\s*\[.*?)(\n\s*)?(\]\s*;)", src, re.S)
    if not m:
        raise RuntimeError("could not find the albums array in the catalog")
    body = m.group(1).rstrip()
    if not body.endswith(",") and not body.endswith("["):
        body += ","
    catalog_path.write_text(
        src[:m.start()] + body + "\n  " + line + ",\n" + m.group(3) + src[m.end():],
        encoding="utf-8")
    return line


def make_cover(img_bytes, out_path, size):
    from PIL import Image
    im = Image.open(BytesIO(img_bytes)).convert("RGB")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
    if s > size:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(out_path, "WEBP", quality=82)


def yt_thumb(vid):
    for name in ("maxresdefault", "sddefault", "hqdefault"):
        try:
            return fetch(f"https://i.ytimg.com/vi/{vid}/{name}.jpg")
        except Exception:
            continue
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("query", nargs="+", help="search terms, YouTube URL, or video id")
    ap.add_argument("--json", dest="catalog", default=REPO / "assets/json/catalog.json",
                    type=Path, help="catalog file to update")
    ap.add_argument("--covers", default=None, type=Path, help="covers directory")
    ap.add_argument("--size", type=int, default=400, help="cover px (default 400)")
    ap.add_argument("--results", type=int, default=8)
    ap.add_argument("--pick", type=int, help="YouTube result number (non-interactive)")
    ap.add_argument("--itunes-pick", type=int, help="iTunes result number, 0=skip")
    ap.add_argument("--country")
    ap.add_argument("--genre")
    ap.add_argument("--mood")
    ap.add_argument("--tag", help="override 'Artist — Title'")
    ap.add_argument("--spotify", default=None, help="Spotify track URL/id ('' to skip)")
    ap.add_argument("--image", help="reuse an existing cover file name (mu_X.webp)")
    ap.add_argument("--lyrics", action="store_true", default=None,
                    help="link the LRCLIB lyrics without asking")
    ap.add_argument("--no-lyrics", dest="lyrics", action="store_false",
                    help="skip the lyrics lookup")
    ap.add_argument("--carino", dest="carino", action="store_true", default=None)
    ap.add_argument("--no-carino", dest="carino", action="store_false")
    ap.add_argument("--force", action="store_true", help="allow duplicate video id")
    ap.add_argument("--yes", action="store_true", help="skip final confirmation")
    ap.add_argument("--dry-run", action="store_true", help="print entry, write nothing")
    args = ap.parse_args()

    covers = args.covers or args.catalog.parent.parent / "covers"
    if not args.catalog.is_file():
        sys.exit(f"error: catalog not found: {args.catalog}")
    src, regs, used_nums = load_catalog(args.catalog)

    # ── 1. resolve the YouTube video ──
    raw = " ".join(args.query)
    vid = video_id_from(raw)
    channel = ""
    if vid:
        title = yt_oembed_title(vid)
        print(f"video: {vid}  {title}")
    else:
        print(f"searching YouTube: {raw}")
        results = yt_search(raw, args.results)
        if not results:
            sys.exit("no YouTube results (is yt-dlp working?)")
        i = pick("pick video:", results,
                 lambda v: f"{v['title']}  ·  {v['channel']}  ·  {v['dur']}",
                 preset=args.pick)
        chosen = results[i - 1]
        vid, title = chosen["id"], chosen["title"]
        channel = re.sub(r"\s*-\s*Topic$", "", chosen["channel"] or "")

    if f'"url":"{vid}"' in src and not args.force:
        sys.exit(f"error: {vid} is already in the catalog (use --force to override)")

    # ── 2. iTunes: tag + Apple Music path + cover ──
    term = clean_title(title) if title else raw
    # video titles like plain "Mirror Mirror" need the artist for a good match
    if channel and not re.search(r"[—–]|\s-\s", term) and channel.lower() not in term.lower():
        term = f"{channel} {term}"
    tag = args.tag
    applemusicurl = ""
    art_bytes = None
    print(f"searching iTunes: {term}")
    hits = itunes_search(term, args.results)
    while True:
        if not hits:
            print("  no iTunes results")
        i = pick("pick match (r=retry with new terms):", hits,
                 lambda h: (f"{h['artistName']} — {h['trackName']}"
                            f"  ·  {h.get('collectionName', '?')}"
                            f" ({str(h.get('releaseDate', ''))[:4]})"),
                 preset=args.itunes_pick, allow_zero=True) if hits else 0
        if i == 0 and args.itunes_pick is None and hits is not None:
            retry = input("new iTunes search terms (Enter = skip iTunes): ").strip()
            if retry:
                hits = itunes_search(retry, args.results)
                continue
        break
    it_album, it_dur = "", 0
    if i:
        h = hits[i - 1]
        tag = tag or f"{h['artistName']} — {h['trackName']}"
        applemusicurl = apple_path(h["trackViewUrl"])
        it_album = h.get("collectionName", "")
        it_dur = (h.get("trackTimeMillis") or 0) / 1000
        try:
            art_bytes = fetch(h["artworkUrl100"].replace("100x100", "1000x1000"))
        except Exception:
            print("  warn: artwork download failed, falling back to YouTube thumbnail")
    if not tag:
        guess = clean_title(title)
        tag = input(f"tag [Artist — Title] ({guess}): ").strip() or guess
    tag = tag.replace(" - ", " — ") if " — " not in tag else tag
    if art_bytes is None:
        art_bytes = yt_thumb(vid)
        if art_bytes is None:
            sys.exit("error: no cover source available")

    # ── 3. Spotify (optional) ──
    if args.spotify is not None:
        spotifyurl = spotify_id_from(args.spotify)
    else:
        q = urllib.parse.quote(tag.replace(" — ", " "))
        print(f"spotify search: https://open.spotify.com/search/{q}")
        spotifyurl = spotify_id_from(input("paste Spotify track URL (Enter = skip): ").strip())

    # ── 4. registries ──
    country = pick_registry("country", regs["COUNTRIES"], args.country)
    genre = pick_registry("genre", regs["GENRES"], args.genre)
    mood = pick_registry("mood", regs["MOODS"], args.mood)
    carino = args.carino if args.carino is not None else (
        input("carino list? [Y/n]: ").strip().lower() != "n")

    # ── 4b. synced lyrics (LRCLIB, best-effort) ──
    # Only the LRCLIB record id is stored; the player fetches the lyrics at play time.
    lrclib_id = None
    if args.lyrics is not False:
        artist, sep, track = tag.partition(" — ")
        lyrics_text = ""
        if sep:
            print("searching LRCLIB for synced lyrics…")
            lyrics_text, lrclib_id = lrclib_lyrics(artist, track, it_album, it_dur)
        if lyrics_text and lrclib_id:
            n = lyrics_text.count("\n") + 1
            keep = True if (args.lyrics or args.yes) else (
                input(f"synced lyrics found ({n} lines, LRCLIB #{lrclib_id}) — link them? "
                      "[Y/n]: ").strip().lower() != "n")
            if not keep:
                lrclib_id = None
        else:
            lrclib_id = None
            print("no synced lyrics found (or LRCLIB unreachable)")

    # ── 5. cover file ──
    if args.image:
        image = args.image
        write_cover = False
        if not (covers / image).is_file():
            sys.exit(f"error: {covers / image} does not exist")
    else:
        image = next_image_name(covers, used_nums)
        write_cover = True

    entry = {"url": vid, "image": image, "tag": tag, "country": country,
             "genre": genre, "mood": mood, "carino": carino,
             "spotifyurl": spotifyurl, "applemusicurl": applemusicurl}
    if lrclib_id:
        entry["lrclib"] = lrclib_id
    line = entry_line(entry)

    print("\n" + line)
    if args.dry_run:
        print("(dry run: nothing written)")
        return
    if not args.yes and input("write it? [Y/n]: ").strip().lower() == "n":
        print("aborted")
        return

    if write_cover:
        make_cover(art_bytes, covers / image, args.size)
        print(f"wrote {covers / image}")

    try:
        append_entry(args.catalog, entry)
    except RuntimeError as e:
        sys.exit(f"error: {e}")
    print(f"appended to {args.catalog}")


if __name__ == "__main__":
    main()
