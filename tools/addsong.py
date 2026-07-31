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


def lrclib_lyrics(artist, track, album="", duration=0):
    """Fetch synced LRC lyrics from lrclib.net (keyless, community DB).
    Returns '' on no match or any network trouble — the service is best-effort."""
    base = "https://lrclib.net/api/"
    params = {"artist_name": artist, "track_name": track}
    if album:
        params["album_name"] = album
    if duration:
        params["duration"] = str(int(round(duration)))
    try:
        d = json.loads(fetch(base + "get?" + urllib.parse.urlencode(params), timeout=10))
        if d.get("syncedLyrics"):
            return d["syncedLyrics"]
    except urllib.error.HTTPError:
        pass          # 404 = no exact match; the search fallback may still hit
    except Exception:
        return ""     # timeout / network trouble: don't stall on a second request
    try:
        arr = json.loads(fetch(base + "search?" + urllib.parse.urlencode(
            {"artist_name": artist, "track_name": track}), timeout=10))
        for r in arr:
            if not r.get("syncedLyrics"):
                continue
            if duration and r.get("duration") and abs(r["duration"] - duration) > 7:
                continue
            return r["syncedLyrics"]
    except Exception:
        pass
    return ""


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
                    help="save LRCLIB lyrics without asking")
    ap.add_argument("--no-lyrics", dest="lyrics", action="store_false",
                    help="skip the lyrics lookup")
    ap.add_argument("--lyrics-dir", type=Path, default=None)
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
    lyrics_dir = args.lyrics_dir or args.catalog.parent.parent / "lyrics"
    lyrics_path = lyrics_dir / f"{vid}.lrc"
    lyrics_text = ""
    if args.lyrics is not False:
        if lyrics_path.exists():
            print(f"lyrics: {lyrics_path.name} already exists, keeping it")
        else:
            artist, sep, track = tag.partition(" — ")
            if sep:
                print("searching LRCLIB for synced lyrics…")
                lyrics_text = lrclib_lyrics(artist, track, it_album, it_dur)
            if lyrics_text:
                n = lyrics_text.count("\n") + 1
                keep = True if (args.lyrics or args.yes) else (
                    input(f"synced lyrics found ({n} lines) — save {lyrics_path.name}? "
                          "[Y/n]: ").strip().lower() != "n")
                if not keep:
                    lyrics_text = ""
            else:
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
    line = entry_line(entry)

    print("\n" + line)
    if lyrics_text:
        print(f"(+ lyrics: {lyrics_text.count(chr(10)) + 1} lines → {lyrics_path.name})")
    if args.dry_run:
        print("(dry run: nothing written)")
        return
    if not args.yes and input("write it? [Y/n]: ").strip().lower() == "n":
        print("aborted")
        return

    if write_cover:
        make_cover(art_bytes, covers / image, args.size)
        print(f"wrote {covers / image}")
    if lyrics_text:
        lyrics_dir.mkdir(parents=True, exist_ok=True)
        lyrics_path.write_text(lyrics_text.rstrip() + "\n", encoding="utf-8")
        print(f"wrote {lyrics_path}")

    try:
        append_entry(args.catalog, entry)
    except RuntimeError as e:
        sys.exit(f"error: {e}")
    print(f"appended to {args.catalog}")


if __name__ == "__main__":
    main()
