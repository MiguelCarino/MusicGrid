#!/usr/bin/env python3
"""addsong_web.py — local web GUI for adding songs to the MusicGrid catalog.

Run:  python3 tools/addsong_web.py            (opens http://localhost:8765)
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

PAGE = Path(__file__).parent / "addsong_web.html"


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
    print(f"MusicGrid add-song GUI: {url}")
    print(f"catalog: {args.catalog}\ncovers:  {covers}\nCtrl+C to stop")
    if not args.no_browser:
        threading.Timer(0.4, webbrowser.open, [url]).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
