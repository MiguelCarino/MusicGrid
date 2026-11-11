#!/usr/bin/env python3
"""batchadd.py — add many songs to the MusicGrid catalog at once.

Two steps, with a reviewable inbox in between:

  batchadd.py fetch <youtube urls | playlist url | video ids | "search terms"> ...
  batchadd.py fetch --from list.txt           (one item per line, '-' = stdin)
      Resolves every item without asking anything: YouTube title, best iTunes
      match (tag, Apple Music path, cover), artist country (existing catalog
      first, then MusicBrainz), genre (from iTunes), synced lyrics (LRCLIB record id).
      Results land in tools/inbox/inbox.jsonl; covers next to it.
      Batch defaults: --country --genre --mood --carino/--no-carino, and
      --party mexico,usa (the party lists the songs belong to).

  batchadd.py check        show the inbox and what still needs a hand
  batchadd.py review       asks only for the missing fields ("?"), entry by entry
                           (or edit tools/inbox/inbox.jsonl by hand), then:
  batchadd.py commit       move every ready entry into the catalog + assets;
                           entries that still have a "?" stay in the inbox
  batchadd.py library FILE stage a music library export (Apple Music JSON:
                           [{n, ar, al, ms, g, cat}]) in tools/inbox/library.json,
                           with a suggested mood per song; approve songs, albums
                           or artists on addsong_web.py's /library page, which
                           fetches the approved ones into this inbox
  batchadd.py lyrics       look again for synced lyrics for catalog songs that
                           have none (native-script titles, matched by length);
                           --apply links the sure matches, the rest are listed

Lyrics: the LRCLIB record is matched by title, artist and length. When the
video runs longer or shorter than the record (an intro, a skit), a video
picked by search is swapped for the official audio upload of the same length;
a video you gave is kept and flagged — tools/lyricsync.py measures the offset.

Fields starting with "_" are hints for you (video title, iTunes match,
MusicBrainz area, what to check) and are dropped on commit.
"""

import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import addsong  # noqa: E402

REPO = addsong.REPO
CATALOG = REPO / "assets/json/catalog.json"
COVERS = REPO / "assets/covers"
INBOX = Path(__file__).resolve().parent / "inbox"
INBOX_FILE = INBOX / "inbox.jsonl"
MB_UA = {"User-Agent": "MusicGrid-batchadd/1.0 ( https://music.carino.systems )",
         "Accept": "application/json"}
UNSET = "?"
LOCK = threading.RLock()   # the GUI edits the inbox while a fetch appends to it

# MusicBrainz ISO 3166 code -> COUNTRIES id. Codes not listed fall back to a
# name match against the registry, then to "?" (with the area name as a hint).
ISO_TO_COUNTRY = {
    "AU": "australia", "BR": "brazil", "CA": "canada", "CL": "chile", "CO": "colombia",
    "FI": "finland", "FR": "france", "IS": "iceland", "JP": "japan",
    "MX": "mexico", "NZ": "newzealand", "KP": "northkorea", "PL": "poland", "PR": "puertorico",
    "RO": "romania", "RU": "russia", "KR": "korea", "SE": "sweden",
    "UA": "ukraine", "GB": "uk", "US": "usa", "ES": "spain", "VE": "venezuela", "AR": "argentina",
    "DO": "dominicanrepublic", "HN": "honduras", "BO": "bolivia", "UY": "uruguay",
    "CU": "cuba", "PA": "panama",
}

# iTunes primaryGenreName (lower-cased) -> GENRES id
ITUNES_GENRE = {
    "pop": "pop", "j-pop": "pop", "k-pop": "pop", "pop/rock": "pop", "teen pop": "pop",
    "rock": "rock", "hard rock": "rock", "j-rock": "rock", "prog-rock/art rock": "rock",
    "metal": "metal", "heavy metal": "metal", "hair metal": "metal",
    "alternative": "indie", "indie rock": "indie", "indie pop": "indie",
    "electronic": "electronic", "dance": "electronic", "house": "electronic",
    "techno": "electronic", "electronica": "electronic", "trance": "electronic",
    "hip-hop/rap": "hiphop", "hip-hop": "hiphop", "rap": "hiphop",
    "jazz": "jazz", "vocal jazz": "jazz", "classical": "classical",
    "soundtrack": "soundtrack", "original score": "soundtrack", "anime": "soundtrack",
    "video game": "soundtrack", "musicals": "soundtrack", "tv soundtrack": "soundtrack",
    "folk": "folk", "singer/songwriter": "folk", "country": "americana",
    "americana": "americana", "r&b/soul": "funksoul", "soul": "funksoul",
    "funk": "funksoul", "latin": "latin", "latin pop": "latin", "pop latino": "latin",
    "música mexicana": "latin", "regional mexicano": "latin", "urbano latino": "reggaeton", "reggaeton": "reggaeton",
    "punk": "punkska", "ska": "punkska", "ambient": "ambient", "new age": "ambient",
}


# ── helpers ──────────────────────────────────────────────────────────────

def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode() or (s or "")
    return re.sub(r"[^\w]+", " ", s.lower()).strip()


def similar(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def load_inbox():
    if not INBOX_FILE.is_file():
        return []
    out = []
    for n, line in enumerate(INBOX_FILE.read_text(encoding="utf-8").splitlines(), 1):
        if line.strip():
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                sys.exit(f"error: {INBOX_FILE.name} line {n} is not valid JSON ({e.msg})")
    return out


def save_inbox(items):
    INBOX.mkdir(parents=True, exist_ok=True)
    INBOX_FILE.write_text("".join(
        json.dumps(e, ensure_ascii=False) + "\n" for e in items), encoding="utf-8")


def catalog_entries(src):
    return [json.loads(m) for m in re.findall(r'^\s*(\{"url".*\})\s*,?\s*$', src, re.M)]


def album_id(applemusicurl):
    m = re.search(r"/album/[^/]*/(\d+)", applemusicurl or "")
    return m.group(1) if m else ""


# ── resolving input items to videos ──────────────────────────────────────

def expand(items, log=print):
    """Yield {id, title, channel, _check?} for each input item."""
    for raw in items:
        if isinstance(raw, dict):      # a staged library song: {q, secs, apple, mood}
            yield pick_video(raw, log)
            continue
        raw = raw.strip()
        if not raw or raw.startswith("#"):
            continue
        if "/playlist?" in raw or (re.search(r"[?&]list=", raw)
                                    and not addsong.video_id_from(raw)):
            log(f"playlist: {raw}")
            out = subprocess.run(["yt-dlp", "--flat-playlist", "--dump-json", raw],
                                 capture_output=True, text=True, timeout=300)
            n = 0
            for line in out.stdout.splitlines():
                try:
                    d = json.loads(line)
                except json.JSONDecodeError:
                    continue
                n += 1
                yield {"id": d.get("id"), "title": d.get("title") or "",
                       "channel": d.get("channel") or d.get("uploader") or "",
                       "secs": float(d.get("duration") or 0)}
            if not n:
                log(f"  warn: no videos read from playlist ({out.stderr.strip()[:200]})")
            continue
        vid = addsong.video_id_from(raw)
        if vid:
            title, channel = "", ""
            try:
                d = json.loads(addsong.fetch(
                    "https://www.youtube.com/oembed?format=json&url="
                    + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}")))
                title, channel = d.get("title", ""), d.get("author_name", "")
            except Exception:
                pass
            yield {"id": vid, "title": title, "channel": channel}
            continue
        hits = addsong.yt_search(raw, 1)
        if not hits:
            log(f"  warn: no YouTube result for '{raw}', skipped")
            continue
        yield {"id": hits[0]["id"], "title": hits[0]["title"], "secs": hits[0].get("secs", 0),
               "channel": hits[0]["channel"], "check": f"video picked by search '{raw}'",
               "searched": True}


# another version of the song: ranked down and flagged, wherever it's from
_VERSION = re.compile(r"\b(live|en vivo|ao vivo|en directo|cover|karaoke|instrumental|nightcore|sped ?up|"
                      r"slowed|reverb|8d|remix|mix|extended|edit|acoustic|piano version|bootleg|mashup|"
                      r"concert|концерт|performed|performance|tv show|full album|album completo|"
                      r"полный альбом|from .+ original motion picture)\b", re.I)
# fan-made extras: ranked down unless the channel is official (official lyric videos are fine)
_FAN = re.compile(r"\b(lyrics?|letra|legendado|tradu[cç][aã]o|subtitulad[oa]|reaction|tutorial|lesson|"
                  r"fan ?made)\b", re.I)


def _extra(rx, video_title, title):
    return {m.lower() for m in rx.findall(video_title or "")} - {m.lower() for m in rx.findall(title or "")}


def _fold(s):
    s = unicodedata.normalize("NFKD", (s or "").lower())
    return re.sub(r"[^\w]+", "", "".join(c for c in s if not unicodedata.combining(c)))


_CH_EXTRA = re.compile(r"official|oficial|officiel|offiziell|オフィシャル|официальн\w*|канал|channel|music|"
                       r"musica|música|band|group|группа|records|tv|vevo|\s*-\s*topic$", re.I)


def official_kind(h, artist):
    """Why an upload counts as official: 'topic' (the artist's own YouTube Music
    art track), 'artist' (the artist's own or VEVO channel), 'verified' (a
    verified channel: a label, a soundtrack publisher), or '' (anyone else,
    fan clubs and other artists' Topic tracks included)."""
    ch = h.get("channel") or ""
    names = [_fold(x) for x in re.split(r",|&|\bfeat\.?|\bft\.?|\bx\b|\band\b|\bи\b|\by\b", artist or "", flags=re.I)]
    names = [n for n in names if len(n) >= 2] or [_fold(artist)]
    fc = _fold(_CH_EXTRA.sub("", ch))
    exact = bool(fc) and fc in names                       # "ABBA", "ABBA - Topic", "ABBAVEVO", "Glukoza Official"
    near = bool(fc) and len(fc) >= 4 and any(n in fc or fc in n for n in names)   # "ABBA. FC", "Pelageya fan page"
    verified = bool(h.get("verified"))
    if ch.endswith(" - Topic"):
        return "topic" if exact or near else ""
    if exact or (near and verified):
        return "artist"
    if verified:
        return "verified"
    return ""


def _score(h, artist, title, secs, alt=()):
    kind = official_kind(h, artist)
    sc = {"topic": 60, "artist": 50, "verified": 35, "": 0}[kind]
    d = abs((h.get("secs") or 0) - secs) if secs and h.get("secs") else None
    if d is not None:
        sc += 20 if d <= 3 else 12 if d <= 10 else 4 if d <= 45 else -25
    vt = _fold(h.get("title"))
    fts = [f for f in (_fold(re.sub(r"\s*[\(\[（【].*?[\)\]）】]", "", t)) for t in (title, *alt)) if f]
    named = any(f in vt for f in fts)
    sc += 15 if named else -45                # an official upload of another song is no use
    if _extra(_VERSION, h.get("title"), title):
        sc -= 30
    if not kind and _extra(_FAN, h.get("title"), title):
        sc -= 20
    if re.search(r"official|オフィシャル|официальн|oficial", h.get("title") or "", re.I):
        sc += 5
    sc += min(5, len(str(h.get("views") or 0)) - 3) if h.get("views") else 0
    return sc, kind, d, named


def pick_video(item, log=print):
    """The YouTube upload for a library song, official first: the artist's
    "- Topic" art track, then the artist's or VEVO channel, then a verified
    channel (label, publisher); as long as the track; live / cover / lyric /
    sped-up uploads ranked down. When the first search has nothing official it
    asks again for the Topic track. Anything not official or not the length is
    flagged. A song whose video was already found (library youtube) keeps it."""
    pre = item.get("yt")
    if pre and pre.get("id"):
        out = {"searched": True, "apple": item.get("apple"), "mood": item.get("mood"),
               "id": pre["id"], "title": pre.get("title", ""), "channel": pre.get("channel", ""),
               "secs": pre.get("secs", 0)}
        if pre.get("check"):
            out["check"] = pre["check"]
        return out
    artist, title = item.get("artist") or "", item.get("title") or ""
    alt = tuple(item.get("alt") or ())
    secs = item.get("secs") or 0
    hits = addsong.yt_search(item["q"], 10)
    if alt:                            # the song's own-language title finds the official upload
        seen = {h["id"] for h in hits}
        hits += [h for h in addsong.yt_search(f"{artist} {alt[0]}", 8) if h["id"] not in seen]
    ranked = sorted(((_score(h, artist, title, secs, alt), h) for h in hits), key=lambda x: -x[0][0])
    if artist and title and not (ranked and ranked[0][0][1] == "topic" and ranked[0][0][3]
                                 and ranked[0][0][2] is not None and ranked[0][0][2] <= 3):
        seen = {h["id"] for h in hits}
        more = [h for h in addsong.yt_search(f"{artist} - Topic {title}", 6) if h["id"] not in seen]
        ranked = sorted(ranked + [(_score(h, artist, title, secs, alt), h) for h in more], key=lambda x: -x[0][0])
    out = {"searched": True, "apple": item.get("apple"), "mood": item.get("mood")}
    if not ranked:
        log(f"  warn: no YouTube result for '{item['q']}', skipped")
        return {"id": None, "title": item["q"], "channel": ""}
    (sc, kind, d, named), h = ranked[0]
    why = []
    if not named:
        why.append("the video title doesn't name the song")
    if not kind:
        why.append("not from an official channel")
    other = _extra(_VERSION, h.get("title"), title)
    if other:
        why.append("another version (" + ", ".join(sorted(other)) + ")")
    if secs and (d is None or d > 10):
        why.append(f"not as long as the track ({int(secs // 60)}:{int(secs % 60):02d})")
    if why:
        out["check"] = " and ".join(why) + ", check it's the song"
    return {**out, "id": h["id"], "title": h["title"], "channel": h["channel"], "secs": h.get("secs", 0),
            "official": kind}


def itunes_by_id(track_id):
    """The exact iTunes track (the library export carries its id). -> hit or None"""
    wait = 3.1 - (time.time() - _last_itunes[0])
    if wait > 0:
        time.sleep(wait)
    _last_itunes[0] = time.time()
    try:
        r = json.loads(addsong.fetch(f"https://itunes.apple.com/lookup?id={track_id}"))
        return next((h for h in r.get("results", []) if h.get("wrapperType") == "track"), None)
    except Exception:
        return None


# ── enrichment ───────────────────────────────────────────────────────────

_last_itunes = [0.0]


def itunes_best(title, channel):
    """Search iTunes and score candidates against the video. -> (hit|None, confident)"""
    channel = re.sub(r"\s*-\s*Topic$", "", channel or "")
    term = addsong.clean_title(title)
    if channel and not re.search(r"[—–]|\s-\s", term) and norm(channel) not in norm(term):
        term = f"{channel} {term}"
    wait = 3.1 - (time.time() - _last_itunes[0])   # iTunes allows ~20 calls/min
    if wait > 0:
        time.sleep(wait)
    _last_itunes[0] = time.time()
    hits = addsong.itunes_search(term, 10)
    if not hits:
        return None, False
    text = f"{channel} {addsong.clean_title(title)}"
    best, best_score = None, -1.0
    for h in hits:
        a = similar(h["artistName"], text)
        t = similar(re.sub(r"\s*\(.*?\)", "", h["trackName"]), text)
        junk = re.search(r"karaoke|instrumental|cover|tribute|live", h["trackName"], re.I) \
            and not re.search(r"karaoke|instrumental|cover|tribute|live", title, re.I)
        score = a + t - (0.5 if junk else 0)
        if score > best_score:
            best, best_score = h, score
    return best, best_score >= 1.7


_mb_cache = {}


def mb_country(artist, regs):
    """-> (country id or '?', area name hint). One request per artist, 1 req/s."""
    key = norm(artist)
    if key in _mb_cache:
        return _mb_cache[key]
    time.sleep(1.1)
    result = (UNSET, "")
    try:
        q = urllib.parse.quote(f'"{artist}"')    # all fields: aliases catch romaji names
        req = addsong.urllib.request.Request(
            f"https://musicbrainz.org/ws/2/artist/?fmt=json&limit=3&query={q}", headers=MB_UA)
        with addsong.urllib.request.urlopen(req, timeout=15) as r:
            arts = json.loads(r.read()).get("artists", [])
        for a in arts:
            names = [a.get("name", ""), " ".join(reversed(a.get("sort-name", "").split(", ")))]
            names += [x.get("name", "") for x in a.get("aliases") or []]
            if a.get("score", 0) < 90 or max(similar(n, artist) for n in names) < 0.9:
                continue
            iso = a.get("country") or ""
            area = (a.get("area") or {}).get("name", "")
            cid = ISO_TO_COUNTRY.get(iso)
            if not cid:
                cid = next((k for k, v in regs["COUNTRIES"].items()
                            if norm(v["name"]) == norm(area)), None)
            result = (cid or UNSET, area or iso)
            break
    except Exception:
        pass
    _mb_cache[key] = result
    return result


def fetch_items(items, country=None, genre=None, mood=None, carino=True, lyrics=True,
                size=400, log=print, stop=lambda: False, party=None):
    """Resolve items into the inbox. Returns how many were added."""
    src, regs, _ = addsong.load_catalog(CATALOG)
    existing = catalog_entries(src)
    in_catalog = {e["url"] for e in existing}
    in_inbox = {e["url"] for e in load_inbox()}
    artist_country = {}
    for e in existing:
        artist_country.setdefault(norm(e["tag"].partition(" — ")[0]), e["country"])
    tags = {norm(e["tag"]): e["url"] for e in existing}
    album_image = {album_id(e["applemusicurl"]): e["image"]
                   for e in existing if album_id(e["applemusicurl"])}
    for flag, v, reg in (("country", country, "COUNTRIES"), ("genre", genre, "GENRES"),
                         ("mood", mood, "MOODS")):
        if v and v not in regs[reg]:
            raise ValueError(f"unknown {flag} '{v}' (have: {', '.join(sorted(regs[reg]))})")
    for v in party or []:
        if v not in regs["COUNTRIES"]:
            raise ValueError(f"unknown party country '{v}'")

    genre_default, country_default = genre, country
    (INBOX / "covers").mkdir(parents=True, exist_ok=True)
    added = 0
    for v in expand(items, log):
        if stop():
            log("stopped")
            break
        vid = v["id"]
        if not vid or vid in in_catalog or vid in in_inbox:
            log(f"  skip {vid}: already in {'catalog' if vid in in_catalog else 'inbox'}")
            continue
        in_inbox.add(vid)
        checks = [v["check"]] if v.get("check") else []
        log(f"• {vid}  {v['title'][:70]}")

        hit = itunes_by_id(v["apple"]) if v.get("apple") else None
        sure = bool(hit)
        if not hit:
            hit, sure = itunes_best(v["title"], v["channel"])
        tag, apple, art, it_album, it_dur, genre = "", "", None, "", 0, ""
        if hit:
            tag = f"{hit['artistName']} — {addsong.clean_title(hit['trackName'])}"
            apple = addsong.apple_path(hit["trackViewUrl"])
            it_album = hit.get("collectionName", "")
            it_dur = (hit.get("trackTimeMillis") or 0) / 1000
            genre = ITUNES_GENRE.get((hit.get("primaryGenreName") or "").lower(), "")
            if not sure:
                checks.append("iTunes match is a guess: confirm tag/cover/apple link")
        else:
            guess = addsong.clean_title(v["title"])
            tag = guess.replace(" - ", " — ") if " - " in guess else UNSET
            checks.append("no iTunes match: tag from video title, cover from YouTube")

        if norm(tag) in tags:
            checks.append(f"same song already in the catalog as {tags[norm(tag)]}"
                          " — delete this line if it's a duplicate")
        tags[norm(tag)] = vid

        # cover: reuse same-album art already in the catalog, else download
        image = album_image.get(str(hit.get("collectionId"))) if hit else None
        if image:
            log(f"    cover: reusing {image} (same album)")
        else:
            if hit:
                try:
                    art = addsong.fetch(hit["artworkUrl100"].replace("100x100", "1000x1000"))
                except Exception:
                    art = None
            art = art or addsong.yt_thumb(vid)
            if art:
                addsong.make_cover(art, INBOX / "covers" / f"{vid}.webp", size)
                if hit:
                    album_image[str(hit["collectionId"])] = f"inbox:{vid}"
            else:
                checks.append("no cover could be downloaded")

        artist = tag.partition(" — ")[0] if " — " in tag else ""
        # "A, B & C" / "A feat. B": the lead artist decides the country
        lead = re.split(r",\s|\s&\s|\s(?:feat\.?|ft\.?|featuring|x|with)\s", artist, maxsplit=1, flags=re.I)[0]
        area = ""
        country = country_default
        if not country and artist:
            country = artist_country.get(norm(artist)) or artist_country.get(norm(lead), "")
            if not country:
                country, area = mb_country(lead, regs)
                if country != UNSET:
                    artist_country[norm(lead)] = country
        country = country or UNSET
        if country == UNSET:
            checks.append(f"country unknown{f' (MusicBrainz says {area})' if area else ''}"
                          " — add it to COUNTRIES if new")

        lrclib_id = None
        if lyrics and artist:
            track = tag.partition(" — ")[2]
            native = addsong.itunes_native(hit.get("trackId"), country) if hit else None
            vlen = v.get("secs") or addsong.video_length(vid)
            alts = ([native] if native else []) + [(artist, t) for t in addsong.native_titles(v["title"], [artist])]
            rec = addsong.lrclib_find(artist, track, it_dur or vlen, alts, country)
            if rec:
                lrclib_id = rec["id"]
                if not rec["sure"]:
                    checks.append(f"lyrics: {rec['why']} (LRCLIB #{rec['id']} {rec['artist']} — {rec['track']})")
                diff = vlen - rec["duration"] if vlen and rec["duration"] else 0
                if abs(diff) > 3:
                    audio = addsong.official_audio(artist, track, rec["duration"])
                    if audio and audio["id"] not in in_catalog and v.get("searched"):
                        checks.append(f"video swapped for the official audio {audio['id']} ({audio['channel']}):"
                                      f" its length matches the lyrics; the search found {vid}, {diff:+.0f}s")
                        vid = audio["id"]
                        v["title"], v["channel"] = audio["title"], audio["channel"]
                    elif audio:
                        checks.append(f"video is {diff:+.0f}s against the lyrics: the official audio"
                                      f" {audio['id']} ({audio['channel']}) matches them; use it, or"
                                      f" measure the offset: tools/lyricsync.py {vid}")
                    else:
                        checks.append(f"video is {diff:+.0f}s against the lyrics: measure the offset"
                                      f" with tools/lyricsync.py {vid}")

        entry = {
            "url": vid, "image": (image or f"inbox:{vid}") if (image or art) else UNSET,
            "tag": tag, "country": country,
            "genre": genre_default or genre or UNSET,
            "mood": v.get("mood") or mood or UNSET,
            "carino": carino, **({"party": list(party)} if party else {}),
            "spotifyurl": "", "applemusicurl": apple,
            **({"lrclib": lrclib_id} if lrclib_id else {}),
            "_video": f"{v['title']} · {v['channel']}",
            "_itunes": (f"{hit['artistName']} — {hit['trackName']} · {it_album}"
                        f" · {hit.get('primaryGenreName', '')}") if hit else "",
            "_lyrics": bool(lrclib_id), "_check": checks,
            **({"_apple": v["apple"]} if v.get("apple") else {}),
        }
        with LOCK:                   # save as we go: a crash loses nothing
            save_inbox(load_inbox() + [entry])
        added += 1
    log(f"{added} added to the inbox.")
    return added


def cmd_fetch(args):
    items = list(args.items)
    if args.from_file:
        fh = sys.stdin if args.from_file == "-" else open(args.from_file, encoding="utf-8")
        items += fh.read().splitlines()
    if not items:
        sys.exit("nothing to fetch (give urls/ids/search terms, or --from FILE)")
    try:
        fetch_items(items, args.country, args.genre, args.mood, args.carino,
                    args.lyrics, args.size,
                    party=[p for p in (args.party or "").split(",") if p.strip()] or None)
    except ValueError as e:
        sys.exit(f"error: {e}")
    print()
    cmd_check(args)


# ── review + commit ──────────────────────────────────────────────────────

def problems(e, regs, in_catalog):
    p = []
    for f, reg in (("country", "COUNTRIES"), ("genre", "GENRES"), ("mood", "MOODS")):
        if e.get(f) not in regs[reg]:
            p.append(f)
    if " — " not in (e.get("tag") or ""):
        p.append("tag")
    img = e.get("image") or ""
    if img.startswith("inbox:"):
        if not (INBOX / "covers" / f"{img[6:]}.webp").is_file():
            p.append("image")
    elif not (COVERS / img).is_file():
        p.append("image")
    if not isinstance(e.get("carino"), bool):
        p.append("carino")
    if any(c not in regs["COUNTRIES"] for c in e.get("party") or []):
        p.append("party")
    if e.get("url") in in_catalog:
        p.append("duplicate")
    return p


def report(inbox, regs, in_catalog=frozenset()):
    if not inbox:
        print("inbox is empty.")
        return
    ready = 0
    for e in inbox:
        p = problems(e, regs, in_catalog)
        ready += not p
        mark = "✓" if not p else "✗"
        print(f" {mark} {e['url']}  {e['tag'][:44]:<44} {e['country']:<11} "
              f"{e['genre']:<10} {e['mood']:<10}{'  ♪' if e.get('_lyrics') else ''}")
        if p:
            print(f"      fix: {', '.join(p)}")
        for c in e.get("_check") or []:
            print(f"      check: {c}")
    print(f"\n{ready}/{len(inbox)} ready."
          + ("" if ready == len(inbox) else " Fix the rest with: batchadd.py review")
          + ("\nThen run: batchadd.py commit" if ready else ""))


def cmd_check(args):
    src, regs, _ = addsong.load_catalog(CATALOG)
    report(load_inbox(), regs, {e["url"] for e in catalog_entries(src)})


def cmd_review(args):
    """Walk the inbox, asking only for the fields that are missing."""
    src, regs, _ = addsong.load_catalog(CATALOG)
    in_catalog = {e["url"] for e in catalog_entries(src)}
    inbox = load_inbox()
    regmap = {"country": "COUNTRIES", "genre": "GENRES", "mood": "MOODS"}
    todo = [e for e in inbox if problems(e, regs, in_catalog) or (args.all and e.get("_check"))]
    for n, e in enumerate(todo, 1):
        print(f"\n[{n}/{len(todo)}] {e['url']}  {e['tag']}  ({e['country']} · {e['genre']}"
              f" · {e['mood']})\n    video: {e.get('_video', '')}")
        for c in e.get("_check") or []:
            print(f"    check: {c}")
        try:
            for f in problems(e, regs, in_catalog):
                if f in regmap:
                    e[f] = addsong.pick_registry(f, regs[regmap[f]])
                elif f == "tag":
                    e["tag"] = input("tag (Artist — Title): ").strip().replace(" - ", " — ")
            if args.all and e.get("_check"):
                t = input(f"tag [{e['tag']}] (Enter = keep, d = delete entry): ").strip()
                if t.lower() == "d":
                    e["_delete"] = True
                elif t:
                    e["tag"] = t.replace(" - ", " — ")
        except (EOFError, KeyboardInterrupt):
            print("\nstopped — progress so far is saved")
            break
        finally:
            save_inbox([x for x in inbox if not x.get("_delete")])
    report(load_inbox(), regs, in_catalog)


def commit_ready(dry_run=False, log=print):
    """Move every complete inbox entry into the catalog. -> (committed, left)"""
    with LOCK:
        return _commit_ready(dry_run, log)


def _commit_ready(dry_run, log):
    src, regs, used = addsong.load_catalog(CATALOG)
    in_catalog = {e["url"] for e in catalog_entries(src)}
    inbox = load_inbox()
    keep, done = [], 0
    inbox_image = {}          # inbox:<vid> -> assigned mu_N.webp
    for e in inbox:
        if problems(e, regs, in_catalog):
            keep.append(e)
            continue
        img = e["image"]
        if img.startswith("inbox:"):
            if img not in inbox_image:
                name = addsong.next_image_name(COVERS, used)
                used.append(int(name[3:-5]))
                if not dry_run:
                    # copy, not move: a same-album entry still in the inbox may share it
                    shutil.copy2(INBOX / "covers" / f"{img[6:]}.webp", COVERS / name)
                inbox_image[img] = name
            img = inbox_image[img]
        entry = {k: v for k, v in e.items() if not k.startswith("_")}
        entry["image"] = img
        log(("would add: " if dry_run else "added: ") + addsong.entry_line(entry))
        if not dry_run:
            addsong.append_entry(CATALOG, entry)
        in_catalog.add(e["url"])
        done += 1
    if not dry_run:
        save_inbox(keep)
        # drop covers no remaining inbox entry points at
        wanted = {e["image"][6:] for e in keep if str(e.get("image", "")).startswith("inbox:")}
        for f in (INBOX / "covers").glob("*.webp"):
            if f.stem not in wanted:
                f.unlink()
    return done, len(keep)


def cmd_commit(args):
    done, left = commit_ready(args.dry_run)
    print(f"\n{done} committed, {left} left in the inbox"
          + (" (dry run: nothing written)" if args.dry_run else ""))
    if left:
        cmd_check(args)


# ── a music library, staged for approval ─────────────────────────────────

LIBRARY = INBOX / "library.json"

# Apple Music genre -> a first guess at the mood
GENRE_MOOD = {
    "soundtrack": "epic", "original score": "epic", "anime": "epic", "video game": "epic",
    "musicals": "romantic", "classical": "dreamy", "jazz": "chill", "vocal jazz": "romantic",
    "ambient": "chill", "new age": "dreamy", "instrumental": "chill", "electronic": "energetic",
    "dance": "energetic", "house": "energetic", "metal": "energetic", "rock": "energetic",
    "hard rock": "energetic", "punk": "energetic", "alternative": "melancholic",
    "indie rock": "melancholic", "indie pop": "dreamy", "singer/songwriter": "melancholic",
    "folk": "nostalgic", "folk-rock": "nostalgic", "kayokyoku": "nostalgic", "worldwide": "nostalgic",
    "arabic": "nostalgic", "pop": "upbeat", "j-pop": "upbeat", "k-pop": "upbeat", "comedy": "upbeat",
    "reggae": "chill", "hip-hop/rap": "energetic", "r&b/soul": "romantic", "latin": "upbeat",
    "christmas": "nostalgic", "blues": "melancholic", "country": "nostalgic",
}
# words in a title that say more than the genre (checked first)
TITLE_MOOD = [
    ("romantic", r"\b(love|lover|amor|amour|kiss|beso|querida|corazón|heart|darling)\b|恋|愛|любов|люблю|поцел"),
    ("melancholic", r"\b(sad|cry|crying|tears?|alone|solo|lonely|goodbye|adiós|farewell|gone|lost|miss|rain|blue)\b|涙|さよなら|一人|ひとり|слёз|слез|прощ|один"),
    ("dark", r"\b(dark|death|dead|die|blood|demon|devil|hell|kill|black|night ?mare|shadow)\b|死|闇|悪魔|смерт|тьм|кров"),
    ("dreamy", r"\b(dream|dreams|sky|stars?|moon|cloud|float|heaven|angel)\b|夢|空|星|月|сон|мечт|небо|звёзд|звезд|луна"),
    ("upbeat", r"\b(dance|party|baila|fiesta|summer|sunshine|happy|fun|disco)\b|ダンス|夏|танц|лето"),
    ("epic", r"\b(battle|war|fight|theme|victory|legend|king|queen|hero)\b|戦|伝説|битв|война|легенд"),
]


def suggest_mood(song, artist_moods):
    """-> (mood, why): the artist's usual mood on the site, else the title,
    else the genre."""
    import collections
    moods = artist_moods.get(norm(song["ar"]))
    if moods:
        m = collections.Counter(moods).most_common(1)[0][0]
        return m, "the artist's songs on the site"
    for m, pat in TITLE_MOOD:
        if re.search(pat, song["n"] or "", re.I):
            return m, "the title"
    g = (song.get("g") or "").lower()
    if g in GENRE_MOOD:
        return GENRE_MOOD[g], f"the genre ({song.get('g')})"
    return "chill", "a default"


def _lib_key(s):
    return re.sub(r"\s+", " ", norm(re.sub(r"\s*[\(\[][^\)\]]*[\)\]]", "", s or "")))


def library_import(path, add=False, log=print):
    """Stage an exported library; keeps the approvals of an earlier import.
    add=True appends the songs that aren't staged yet (same id, or same artist
    and title) and leaves every staged song as it is."""
    lib = json.loads(Path(path).expanduser().read_text(encoding="utf-8"))
    src, _, _ = addsong.load_catalog(CATALOG)
    existing = catalog_entries(src)
    artist_moods = {}
    for e in existing:
        artist_moods.setdefault(norm(e["tag"].partition(" — ")[0]), []).append(e["mood"])
    old = {}
    if LIBRARY.is_file():
        old = {x["id"]: x for x in json.loads(LIBRARY.read_text(encoding="utf-8"))}
    items = []
    for i, s in enumerate(lib):
        sid = str(s.get("cat") or f"x{abs(hash((s.get('ar'), s.get('n')))) % 10**9}")
        mood, why = suggest_mood(s, artist_moods)
        prev = old.get(sid, {})
        items.append({
            "id": sid, "title": s.get("n") or "", "artist": s.get("ar") or "", "album": s.get("al") or "",
            "secs": round((s.get("ms") or 0) / 1000), "genre": s.get("g") or "",
            "apple": str(s["cat"]) if s.get("cat") else "",
            "mood": prev.get("mood") if prev.get("moodSet") else mood, "moodWhy": why,
            "moodSet": bool(prev.get("moodSet")),
            "status": prev.get("status", "pending"),
        })
        if prev.get("yt"):
            items[-1]["yt"] = prev["yt"]
    with LOCK:
        INBOX.mkdir(parents=True, exist_ok=True)
        if add:
            # read again right before writing: a running lookup saves into this file
            staged = json.loads(LIBRARY.read_text(encoding="utf-8")) if LIBRARY.is_file() else []
            have = {x["id"] for x in staged} | {(_lib_key(x["artist"]), _lib_key(x["title"])) for x in staged}
            new = [x for x in items
                   if x["id"] not in have and (_lib_key(x["artist"]), _lib_key(x["title"])) not in have]
            items = staged + new
            log(f"added {len(new)} new songs ({len(lib) - len(new)} already staged)")
        LIBRARY.write_text(json.dumps(items, ensure_ascii=False, indent=0), encoding="utf-8")
    log(f"staged {len(items)} songs in {LIBRARY.relative_to(REPO)}")
    return items


def library_state():
    """The staged songs, each with where it is: pending / approved / skipped
    (your choice), and onsite / inbox (found in the catalog or the inbox)."""
    if not LIBRARY.is_file():
        return []
    items = json.loads(LIBRARY.read_text(encoding="utf-8"))
    src, _, _ = addsong.load_catalog(CATALOG)
    existing = catalog_entries(src)
    on_ids = {addsong.track_id_from_apple(e.get("applemusicurl")) for e in existing} - {""}
    on_keys = {}
    for e in existing:
        ar, _, t = e["tag"].partition(" — ")
        on_keys.setdefault(_lib_key(t), set()).add(_lib_key(ar))
    inbox = load_inbox()
    in_ids = {str(e.get("_apple")) for e in inbox if e.get("_apple")}
    for it in items:
        where = ""
        if it["apple"] and it["apple"] in on_ids:
            where = "onsite"
        else:
            arts = on_keys.get(_lib_key(it["title"]))
            ka = _lib_key(it["artist"])
            if arts and (any(a and (a in ka or ka in a or similar(a, ka) > 0.8) for a in arts)
                         or len(_lib_key(it["title"])) >= 14):
                where = "onsite"
        if not where and it["apple"] in in_ids:
            where = "inbox"
        it["where"] = where
    return items


def library_update(ids, status=None, mood=None):
    ids = set(ids)
    with LOCK:
        items = json.loads(LIBRARY.read_text(encoding="utf-8"))
        for it in items:
            if it["id"] in ids:
                if status in ("pending", "approved", "skipped"):
                    it["status"] = status
                if mood:
                    it["mood"], it["moodSet"] = mood, True
        LIBRARY.write_text(json.dumps(items, ensure_ascii=False, indent=0), encoding="utf-8")


def library_video(sid, url):
    """Use the video you pasted for a staged song. Returns its yt record."""
    vid = addsong.video_id_from((url or "").strip())
    if not vid:
        raise ValueError("not a YouTube link or video id")
    title, channel = "", ""
    try:
        d = json.loads(addsong.fetch(
            "https://www.youtube.com/oembed?format=json&url="
            + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}")))
        title, channel = d.get("title", ""), d.get("author_name", "")
    except Exception:
        pass
    yt = {"id": vid, "title": title, "channel": channel, "secs": 0, "manual": True}
    with LOCK:
        items = json.loads(LIBRARY.read_text(encoding="utf-8"))
        hit = [it for it in items if it["id"] == sid]
        if not hit:
            raise ValueError(f"no staged song {sid}")
        hit[0]["yt"] = yt
        LIBRARY.write_text(json.dumps(items, ensure_ascii=False, indent=0), encoding="utf-8")
    return yt


def library_to_fetch():
    """The approved songs not yet on the site or in the inbox, as fetch items."""
    return [{"q": f"{it['artist']} {it['title']}", "secs": it["secs"], "apple": it["apple"] or None,
             "mood": it["mood"], "yt": it.get("yt"), "artist": it["artist"], "title": it["title"],
             "alt": it.get("alt")}
            for it in library_state() if it["status"] == "approved" and not it["where"]]


def _needs(it, redo, unofficial):
    y = it.get("yt")
    if not y:
        return True
    if y.get("manual"):
        return False                   # your pasted link always stays
    if redo:
        return True
    if unofficial:
        return not y.get("id") or official_kind(y, it["artist"]) in ("", "verified") and not y.get("official")
    return False


def library_youtube(workers=4, redo=False, unofficial=False, artist=None, log=print):
    """Find the YouTube video of every staged song not on the site yet, ahead of
    review, so the /library page can link it. Resumable: songs that already have
    one are skipped (--redo looks again). Saves as it goes, keeping your approvals."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    todo = [it for it in library_state()
            if not it["where"] and it["status"] != "skipped" and _needs(it, redo, unofficial)
            and (not artist or artist.lower() in (it["artist"] + " " + it["title"]).lower())]
    log(f"looking up {len(todo)} songs on YouTube ({workers} at a time)")

    def one(it):
        v = pick_video({"q": f"{it['artist']} {it['title']}", "secs": it["secs"],
                        "artist": it["artist"], "title": it["title"], "alt": it.get("alt")},
                       log=lambda *_: None)
        if not v.get("id"):
            return it["id"], {"id": None}
        yt = {"id": v["id"], "title": v.get("title", ""), "channel": v.get("channel", ""),
              "secs": v.get("secs", 0), "official": v.get("official", "")}
        if v.get("check"):
            yt["check"] = v["check"]
        return it["id"], yt

    found, done = {}, 0

    def flush():
        with LOCK:
            items = json.loads(LIBRARY.read_text(encoding="utf-8"))
            for x in items:
                if x["id"] in found:
                    x["yt"] = found[x["id"]]
            LIBRARY.write_text(json.dumps(items, ensure_ascii=False, indent=0), encoding="utf-8")

    with ThreadPoolExecutor(workers) as ex:
        futs = [ex.submit(one, it) for it in todo]
        for f in as_completed(futs):
            try:
                sid, yt = f.result()
            except Exception as e:
                log(f"  error: {e}")
                continue
            found[sid] = yt
            done += 1
            if done % 25 == 0:
                flush()
                log(f"  {done}/{len(todo)}")
    flush()
    miss = sum(1 for v in found.values() if not v.get("id"))
    flag = sum(1 for v in found.values() if v.get("check"))
    log(f"done: {done} looked up, {flag} to check (no upload of the same length), {miss} not found")


def cmd_youtube(args):
    library_youtube(args.workers, args.redo, args.unofficial, args.artist)


def cmd_library(args):
    library_import(args.file, add=args.add)
    print("review it on the /library page of tools/addsong_web.py")


def set_field(src, vid, key, value):
    """The catalog line of a song, with key set to value (None removes it)."""
    lines = src.split("\n")
    for i, line in enumerate(lines):
        if line.lstrip().startswith('{"url":"' + vid + '"'):
            body = line.rstrip()
            comma = body.endswith(",")
            e = json.loads(body.rstrip(","))
            if value is None:
                e.pop(key, None)
            else:
                e[key] = value
            indent = line[:len(line) - len(line.lstrip())]
            lines[i] = indent + json.dumps(e, ensure_ascii=False, separators=(",", ":")) + ("," if comma else "")
            return "\n".join(lines)
    raise KeyError(vid)


def cmd_lyrics(args):
    """Find synced lyrics for catalog songs without any."""
    src, _, _ = addsong.load_catalog(CATALOG)
    songs = [e for e in catalog_entries(src) if not e.get("lrclib")]
    if args.ids:
        songs = [e for e in songs if e["url"] in set(args.ids)]
    print(f"{len(songs)} songs without lyrics")
    found, maybe = [], []
    for n, e in enumerate(songs, 1):
        artist, _, track = e["tag"].partition(" — ")
        track = addsong.clean_title(re.sub(r"\s*\((?:feat|ft)\.?[^)]*\)", "", track, flags=re.I))
        native = None
        tid = addsong.track_id_from_apple(e.get("applemusicurl"))
        if tid and e.get("country") in addsong.STORE_FOR:
            wait = 3.1 - (time.time() - _last_itunes[0])
            if wait > 0:
                time.sleep(wait)
            _last_itunes[0] = time.time()
            native = addsong.itunes_native(tid, e["country"])
        vlen = addsong.video_length(e["url"])
        alts = [native] if native else []
        if addsong.is_latin(track):   # the video's own title often has it in its script
            alts += [(artist, t) for t in addsong.native_titles(addsong.yt_oembed_title(e["url"]), [artist])]
        if not alts and e.get("country") in addsong.STORE_FOR and addsong.is_latin(track):
            native = addsong.itunes_native_search(artist, track, e["country"], vlen)
            alts = [native] if native else []
        rec = addsong.lrclib_find(artist, track, vlen, alts, e.get("country"))
        if not rec:
            print(f"[{n}/{len(songs)}] -  {e['tag']}")
            continue
        diff = vlen - rec["duration"] if vlen and rec["duration"] else 0
        line = (f"[{n}/{len(songs)}] {'+' if rec['sure'] else '?'}  {e['tag']}  ->  #{rec['id']}"
                f" {rec['artist']} — {rec['track']}" + (f"  (video {diff:+.0f}s)" if abs(diff) > 3 else ""))
        print(line if rec["sure"] else line + f"\n      {rec['why']}")
        (found if rec["sure"] else maybe).append((e, rec, diff))
    print(f"\n{len(found)} sure, {len(maybe)} to look at, {len(songs) - len(found) - len(maybe)} not found")
    if args.apply and found:
        with LOCK:
            src = CATALOG.read_text(encoding="utf-8")
            for e, rec, _ in found:
                src = set_field(src, e["url"], "lrclib", rec["id"])
            CATALOG.write_text(src, encoding="utf-8")
        print(f"linked {len(found)} (git diff to review).")
    elif found:
        print("run again with --apply to link the sure ones.")
    off = [(e, d) for e, _, d in found + maybe if abs(d) > 3]
    if off:
        print("timing may need an offset (tools/lyricsync.py " + " ".join(e["url"] for e, _ in off) + ")")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0],
                                 formatter_class=argparse.RawDescriptionHelpFormatter,
                                 epilog="\n".join(__doc__.splitlines()[2:]))
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("fetch", help="resolve items into the inbox")
    f.add_argument("items", nargs="*", help="YouTube/playlist URLs, video ids, or search terms")
    f.add_argument("--from", dest="from_file", help="read items from a file ('-' = stdin)")
    f.add_argument("--country", help="use this country for the whole batch")
    f.add_argument("--genre", help="use this genre for the whole batch")
    f.add_argument("--mood", help="use this mood for the whole batch")
    f.add_argument("--carino", dest="carino", action="store_true", default=True,
                   help="add to the ★ Carino list (default)")
    f.add_argument("--no-carino", dest="carino", action="store_false")
    f.add_argument("--no-lyrics", dest="lyrics", action="store_false")
    f.add_argument("--party", help="party lists for the whole batch, e.g. mexico,colombia")
    f.add_argument("--size", type=int, default=400, help="cover px (default 400)")
    sub.add_parser("check", help="show the inbox and what needs fixing")
    r = sub.add_parser("review", help="answer only the missing fields, one entry at a time")
    r.add_argument("--all", action="store_true",
                   help="also step through entries with a 'check' note (fix tag / delete)")
    lb = sub.add_parser("library", help="stage a music library export for approval")
    lb.add_argument("file", help="the export, e.g. ~/Downloads/applemusic-library.json")
    lb.add_argument("--add", action="store_true",
                    help="add the songs that aren't staged yet, keep the rest as it is")
    yt = sub.add_parser("youtube", help="find the YouTube video of every staged library song")
    yt.add_argument("--workers", type=int, default=4)
    yt.add_argument("--redo", action="store_true", help="look again for every song (not your pasted links)")
    yt.add_argument("--artist", help="only songs by (or featuring) this artist")
    yt.add_argument("--unofficial", action="store_true",
                    help="look again for songs whose video isn't from an official channel")
    ly = sub.add_parser("lyrics", help="find synced lyrics for catalog songs without any")
    ly.add_argument("ids", nargs="*", help="only these video ids")
    ly.add_argument("--apply", action="store_true", help="link the sure matches")
    c = sub.add_parser("commit", help="move ready inbox entries into the catalog")
    c.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    {"fetch": cmd_fetch, "check": cmd_check, "review": cmd_review,
     "commit": cmd_commit, "lyrics": cmd_lyrics,
     "library": cmd_library, "youtube": cmd_youtube}[args.cmd](args)


if __name__ == "__main__":
    main()
