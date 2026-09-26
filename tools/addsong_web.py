#!/usr/bin/env python3
"""addsong_web.py — local web GUI for adding songs to the MusicGrid catalog.

Run:  python3 tools/addsong_web.py            (opens http://localhost:8765)
Pages: /       one song, picking each match yourself
       /batch  many songs at once (links, ids, a playlist) — see batchadd.py
Flags: --port N  --json PATH  --covers PATH  --no-browser
"""

import argparse
import json
import sys
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import addsong  # noqa: E402
import batchadd  # noqa: E402

PAGE = Path(__file__).parent / "addsong_web.html"
BATCH_PAGE = Path(__file__).parent / "batch_web.html"

# one background fetch at a time; the page polls /api/batch for progress
JOB = {"running": False, "stop": False, "log": [], "total": 0, "done": 0}


def job_log(line):
    JOB["log"] = (JOB["log"] + [line])[-300:]
    if line.startswith(("• ", "  skip ")):
        JOB["done"] += 1
        # a playlist expands to more songs than the lines pasted
        JOB["total"] = max(JOB["total"], JOB["done"] + (1 if JOB["running"] else 0))


def run_fetch(items, opts):
    try:
        batchadd.fetch_items(items, log=job_log, stop=lambda: JOB["stop"], **opts)
    except Exception as e:
        job_log(f"error: {e}")
    finally:
        JOB["running"] = False


def batch_state():
    src, regs, _ = addsong.load_catalog(batchadd.CATALOG)
    in_catalog = {e["url"] for e in batchadd.catalog_entries(src)}
    entries = []
    for e in batchadd.load_inbox():
        entries.append({**e, "_problems": batchadd.problems(e, regs, in_catalog)})
    return {"job": JOB, "entries": entries, "count": len(in_catalog),
            "countries": regs["COUNTRIES"], "genres": regs["GENRES"], "moods": regs["MOODS"]}


def make_handler(catalog, covers, lyrics_dir):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def send_json(self, obj, code=200):
            body = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def send_bytes(self, body, ctype):
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            qs = dict(urllib.parse.parse_qsl(u.query))
            try:
                if u.path == "/":
                    self.send_bytes(PAGE.read_bytes(), "text/html; charset=utf-8")
                elif u.path == "/batch":
                    self.send_bytes(BATCH_PAGE.read_bytes(), "text/html; charset=utf-8")
                elif u.path == "/api/batch":
                    self.send_json(batch_state())
                elif u.path.startswith("/inbox/"):
                    f = batchadd.INBOX / "covers" / Path(u.path).name
                    if f.is_file():
                        self.send_bytes(f.read_bytes(), "image/webp")
                    else:
                        self.send_json({"error": "not found"}, 404)
                elif u.path == "/api/state":
                    src, regs, used = addsong.load_catalog(catalog)
                    self.send_json({
                        "countries": regs["COUNTRIES"],
                        "genres": regs["GENRES"],
                        "moods": regs["MOODS"],
                        "nextImage": addsong.next_image_name(covers, used),
                        "covers": sorted((f.name for f in covers.glob("*.webp")),
                                         key=lambda n: (len(n), n)),
                        "catalog": str(catalog),
                        "count": src.count('"url"'),
                    })
                elif u.path == "/api/ytsearch":
                    self.send_json({"results": addsong.yt_search(qs.get("q", ""), 8)})
                elif u.path == "/api/oembed":
                    self.send_json({"title": addsong.yt_oembed_title(qs.get("vid", ""))})
                elif u.path == "/api/itunes":
                    hits = addsong.itunes_search(qs.get("term", ""), 8)
                    self.send_json({"results": [{
                        "artist": h["artistName"], "track": h["trackName"],
                        "album": h.get("collectionName", ""),
                        "year": str(h.get("releaseDate", ""))[:4],
                        "path": addsong.apple_path(h["trackViewUrl"]),
                        "art": h["artworkUrl100"],
                        "ms": h.get("trackTimeMillis") or 0,
                    } for h in hits]})
                elif u.path == "/api/lyrics":
                    vid = qs.get("vid", "")
                    if vid and (lyrics_dir / f"{vid}.lrc").is_file():
                        self.send_json({"synced": "", "exists": True})
                    else:
                        self.send_json({"exists": False, "synced": addsong.lrclib_lyrics(
                            qs.get("artist", ""), qs.get("track", ""),
                            qs.get("album", ""), float(qs.get("duration", "0") or 0))})
                elif u.path == "/api/check":
                    src, _, _ = addsong.load_catalog(catalog)
                    self.send_json({"dup": f'"url":"{qs.get("vid", "")}"' in src})
                elif u.path.startswith("/covers/"):
                    f = covers / Path(u.path).name
                    if f.is_file():
                        self.send_bytes(f.read_bytes(), "image/webp")
                    else:
                        self.send_json({"error": "not found"}, 404)
                else:
                    self.send_json({"error": "not found"}, 404)
            except Exception as e:  # keep the tool alive on any handler error
                self.send_json({"error": str(e)}, 500)

        def do_POST(self):
            if self.path.startswith("/api/batch/"):
                return self.batch_post()
            if self.path != "/api/add":
                return self.send_json({"error": "not found"}, 404)
            try:
                n = int(self.headers.get("Content-Length", "0"))
                d = json.loads(self.rfile.read(n))
                vid = d.get("url", "")
                if not vid:
                    return self.send_json({"error": "no video id"}, 400)
                src, regs, used = addsong.load_catalog(catalog)
                if f'"url":"{vid}"' in src and not d.get("force"):
                    return self.send_json(
                        {"error": f"{vid} is already in the catalog"}, 409)
                for key, reg in (("country", "COUNTRIES"), ("genre", "GENRES"),
                                 ("mood", "MOODS")):
                    if d.get(key) not in regs[reg]:
                        return self.send_json(
                            {"error": f"unknown {key}: {d.get(key)}"}, 400)
                if not d.get("tag", "").strip():
                    return self.send_json({"error": "tag is empty"}, 400)

                image = d.get("image") or ""
                wrote_cover = None
                if image:  # reuse an existing cover
                    if not (covers / image).is_file():
                        return self.send_json({"error": f"{image} not found"}, 400)
                else:
                    image = addsong.next_image_name(covers, used)
                    art = (d.get("art") or "").replace("100x100", "1000x1000")
                    img = addsong.fetch(art) if art else addsong.yt_thumb(vid)
                    if not img:
                        return self.send_json({"error": "no cover source"}, 400)
                    addsong.make_cover(img, covers / image, int(d.get("size", 400)))
                    wrote_cover = str(covers / image)

                entry = {
                    "url": vid, "image": image, "tag": d["tag"].strip(),
                    "country": d["country"], "genre": d["genre"], "mood": d["mood"],
                    "carino": bool(d.get("carino", True)),
                    "spotifyurl": addsong.spotify_id_from(d.get("spotifyurl", "") or ""),
                    "applemusicurl": d.get("applemusicurl", ""),
                }
                lyrics = (d.get("lyrics") or "").strip()
                wrote_lyrics = None
                if lyrics:
                    lyrics_dir.mkdir(parents=True, exist_ok=True)
                    lp = lyrics_dir / f"{vid}.lrc"
                    lp.write_text(lyrics + "\n", encoding="utf-8")
                    wrote_lyrics = str(lp)
                line = addsong.append_entry(catalog, entry)
                self.send_json({"ok": True, "line": line, "cover": wrote_cover,
                                "image": image, "lyrics": wrote_lyrics,
                                "catalog": str(catalog)})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)

        def batch_post(self):
            try:
                n = int(self.headers.get("Content-Length", "0"))
                d = json.loads(self.rfile.read(n) or b"{}")
                action = self.path.rsplit("/", 1)[-1]
                if action == "fetch":
                    if JOB["running"]:
                        return self.send_json({"error": "a fetch is already running"}, 409)
                    items = [x for x in (d.get("items") or []) if x.strip()]
                    if not items:
                        return self.send_json({"error": "nothing to fetch"}, 400)
                    opts = {k: d.get(k) or None for k in ("country", "genre", "mood")}
                    opts.update(carino=bool(d.get("carino", True)),
                                lyrics=bool(d.get("lyrics", True)))
                    JOB.update(running=True, stop=False, log=[], total=len(items), done=0)
                    threading.Thread(target=run_fetch, args=(items, opts), daemon=True).start()
                    return self.send_json({"ok": True})
                if action == "stop":
                    JOB["stop"] = True
                    return self.send_json({"ok": True})
                if action == "update":
                    # {urls: [...], set: {field: value}} or {urls: [...], delete: true}
                    urls = set(d.get("urls") or [])
                    allowed = {"tag", "country", "genre", "mood", "carino", "spotifyurl"}
                    changes = {k: v for k, v in (d.get("set") or {}).items() if k in allowed}
                    if "spotifyurl" in changes:
                        changes["spotifyurl"] = addsong.spotify_id_from(changes["spotifyurl"] or "")
                    if "tag" in changes and " — " not in changes["tag"]:
                        changes["tag"] = changes["tag"].replace(" - ", " — ")
                    with batchadd.LOCK:
                        inbox = batchadd.load_inbox()
                        if d.get("delete"):
                            inbox = [e for e in inbox if e["url"] not in urls]
                        else:
                            for e in inbox:
                                if e["url"] in urls:
                                    e.update(changes)
                        batchadd.save_inbox(inbox)
                    return self.send_json({"ok": True})
                if action == "commit":
                    if JOB["running"]:
                        return self.send_json({"error": "wait for the fetch to finish"}, 409)
                    lines = []
                    done, left = batchadd.commit_ready(log=lines.append)
                    return self.send_json({"ok": True, "done": done, "left": left,
                                           "lines": lines})
                self.send_json({"error": "not found"}, 404)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--json", dest="catalog", type=Path,
                    default=addsong.REPO / "assets/json/catalog.json")
    ap.add_argument("--covers", type=Path, default=None)
    ap.add_argument("--lyrics-dir", type=Path, default=None)
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    covers = args.covers or args.catalog.parent.parent / "covers"
    lyrics_dir = args.lyrics_dir or args.catalog.parent.parent / "lyrics"
    if not args.catalog.is_file():
        sys.exit(f"error: catalog not found: {args.catalog}")
    if not PAGE.is_file():
        sys.exit(f"error: {PAGE.name} missing next to this script")

    srv = ThreadingHTTPServer(("127.0.0.1", args.port),
                              make_handler(args.catalog, covers, lyrics_dir))
    url = f"http://localhost:{args.port}"
    print(f"MusicGrid add-song GUI: {url}   (batch: {url}/batch)")
    print(f"catalog: {args.catalog}\ncovers:  {covers}\nCtrl+C to stop")
    if not args.no_browser:
        threading.Timer(0.4, webbrowser.open, [url]).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
