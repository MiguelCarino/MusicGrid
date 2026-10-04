#!/usr/bin/env python3
"""batchadd.py — add many songs to the MusicGrid catalog at once.

Two steps, with a reviewable inbox in between:

  batchadd.py fetch <youtube urls | playlist url | video ids | "search terms"> ...
  batchadd.py fetch --from list.txt           (one item per line, '-' = stdin)
      Resolves every item without asking anything: YouTube title, best iTunes
      match (tag, Apple Music path, cover), artist country (existing catalog
      first, then MusicBrainz), genre (from iTunes), synced lyrics (LRCLIB).
      Results land in tools/inbox/inbox.jsonl; covers/lyrics next to it.
      Batch defaults: --country --genre --mood --carino/--no-carino, and
      --party mexico,usa (the party lists the songs belong to).

  batchadd.py check        show the inbox and what still needs a hand
  batchadd.py review       asks only for the missing fields ("?"), entry by entry
                           (or edit tools/inbox/inbox.jsonl by hand), then:
  batchadd.py commit       move every ready entry into the catalog + assets;
                           entries that still have a "?" stay in the inbox

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
LYRICS = REPO / "assets/lyrics"
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
    "UA": "ukraine", "GB": "uk", "US": "usa",
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
    "música mexicana": "latin", "regional mexicano": "latin", "urbano latino": "latin",
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
                       "channel": d.get("channel") or d.get("uploader") or ""}
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
        yield {"id": hits[0]["id"], "title": hits[0]["title"],
               "channel": hits[0]["channel"], "check": f"video picked by search '{raw}'"}


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
    (INBOX / "lyrics").mkdir(parents=True, exist_ok=True)
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

        lyr = ""
        if lyrics and artist:
            lyr = addsong.lrclib_lyrics(artist, tag.partition(" — ")[2], it_album, it_dur)
            if lyr:
                (INBOX / "lyrics" / f"{vid}.lrc").write_text(lyr + "\n", encoding="utf-8")

        entry = {
            "url": vid, "image": (image or f"inbox:{vid}") if (image or art) else UNSET,
            "tag": tag, "country": country,
            "genre": genre_default or genre or UNSET,
            "mood": mood or UNSET,
            "carino": carino, **({"party": list(party)} if party else {}),
            "spotifyurl": "", "applemusicurl": apple,
            "_video": f"{v['title']} · {v['channel']}",
            "_itunes": (f"{hit['artistName']} — {hit['trackName']} · {it_album}"
                        f" · {hit.get('primaryGenreName', '')}") if hit else "",
            "_lyrics": bool(lyr), "_check": checks,
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
        lrc = INBOX / "lyrics" / f"{e['url']}.lrc"
        log(("would add: " if dry_run else "added: ") + addsong.entry_line(entry))
        if not dry_run:
            addsong.append_entry(CATALOG, entry)
            if lrc.is_file() and not (LYRICS / lrc.name).exists():
                shutil.move(lrc, LYRICS / lrc.name)
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
    c = sub.add_parser("commit", help="move ready inbox entries into the catalog")
    c.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    {"fetch": cmd_fetch, "check": cmd_check, "review": cmd_review,
     "commit": cmd_commit}[args.cmd](args)


if __name__ == "__main__":
    main()
