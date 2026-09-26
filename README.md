# MusicGrid

A self-generating music wall. Click any cover to play it (YouTube), browse the
collection **by country**, queue songs, and follow along with synced lyrics.

🔗 https://music.carino.systems/ · custom deployment at https://carino.systems/music.html

![mpv-shot0001](https://github.com/MiguelCarino/MusicGrid/assets/6355310/80d25dbf-f4c0-4179-a6c9-6eaf8292ab36)
![mpv-shot0002](https://github.com/MiguelCarino/MusicGrid/assets/6355310/175d165f-b21e-4361-8afa-e77a104764be)

## Features
- **Carino navbar** — brand, live clock + greeting, and a *Status* panel with live
  library/now-playing/session stats (`assets/js/navbar.js`).
- **Browse menus** — **🌍 Country**, **🎵 Genre** and **🎭 Mood** dropdown menus, each
  listing its options with song counts, generated automatically from the catalog.
- **★ Carino list** — a quick pill that filters to Miguel's personal picks (`carino: true`).
- **Autoplay** — toggle in the controls; when on, a fresh song keeps playing after each
  one ends even with an empty queue (preference saved in `localStorage`).
- Randomizer, auto-scrolling wall, a 10-song queue, per-video `.lrc` karaoke lyrics, and a
  redesigned now-playing panel with clickable country/genre/mood chips.
- Everything is shareable via URL params (`?v=` play, `?q=` queue, `?cat=` filter). Filters
  encode as `?cat=country:japan`, `?cat=genre:rock` or `?cat=mood:chill` (a bare
  `?cat=japan` still works as a country).

## Adding music

### Many songs at once — `tools/addsong_web.py` → **Batch**
Run `python3 tools/addsong_web.py` and open **http://localhost:8765/batch**. Paste
YouTube links, video ids, a whole playlist link, or plain search terms. Everything is
resolved automatically into a review inbox (`tools/inbox/`, not committed): the
"Artist — Title" tag, Apple Music link and cover come from iTunes, the artist's country
from songs already in the catalog or else from MusicBrainz, the genre from iTunes, and
synced lyrics from LRCLIB. Songs already in the catalog are skipped, and songs from an
album that's already there reuse its cover.

Press **Fetch** and watch the list fill in. Every song gets a card with its cover and
dropdowns: green means ready, red marks what still needs picking (usually just the mood,
which the "Set mood on songs without one" button fills in one go). **Write ready songs**
saves the covers, lyrics and catalog entries; review with `git diff` and commit.

The same thing works from the terminal with `tools/batchadd.py`:

```sh
python3 tools/batchadd.py fetch "https://www.youtube.com/playlist?list=…" --mood chill
python3 tools/batchadd.py fetch --from songs.txt      # one link / id / "artist title" per line
python3 tools/batchadd.py review    # asks only for what's missing (usually the mood)
python3 tools/batchadd.py commit    # covers → assets/covers/mu_N.webp, entries → catalog
```

`--country`, `--genre`, `--mood` and `--no-carino` apply to the whole batch. `check` shows
the inbox without changing it, and `review --all` also walks entries flagged for a second
look (a guessed iTunes match, a possible duplicate) so you can fix the tag or delete them.
You can also edit `tools/inbox/inbox.jsonl` by hand; fields starting with `_` are hints
that are dropped when you commit.

### One song, step by step — `tools/addsong.py` / `tools/addsong_web.py`
`python3 tools/addsong.py "search terms or link"` does the same lookups but lets you pick
each match yourself; the front page of `tools/addsong_web.py` is the same flow in the browser.

### By hand
1. Drop the cover image in **`assets/covers/`** (e.g. `mu_190.webp`).
2. Add an entry to the `albums` array in **`assets/json/catalog.json`**:

   ```js
   { "url": "YOUTUBE_ID", "image": "mu_190.webp",
     "tag": "Artist — Song Title", "country": "japan", "genre": "rock",
     "mood": "energetic", "carino": true, "spotifyurl": "", "applemusicurl": "" }
   ```

   | field           | meaning                                                        |
   |-----------------|----------------------------------------------------------------|
   | `url`           | YouTube video id (the player source)                           |
   | `image`         | cover filename in `assets/covers/`                             |
   | `tag`           | `"Artist — Title"` — drives the tooltip and *now playing*      |
   | `country`       | a key in the `COUNTRIES` registry at the top of the file       |
   | `genre`         | a key in the `GENRES` registry at the top of the file          |
   | `mood`          | a key in the `MOODS` registry at the top of the file           |
   | `carino`        | `true` to include it in the ★ Carino personal list             |
   | `spotifyurl`    | Spotify track id, or `""` to link a search by `tag`            |
   | `applemusicurl` | Apple Music path, or `""` to link a search by `tag`           |

3. New country / genre / mood? Add it to the matching registry at the top of
   `catalog.json` (the menus build themselves from whatever is present):

   ```js
   const COUNTRIES = { japan: { name: "Japan", flag: "🇯🇵" }, /* … */ };
   const GENRES    = { rock:  { name: "Rock",  icon: "🎸" }, /* … */ };
   const MOODS     = { energetic: { name: "Energetic", icon: "⚡" }, /* … */ };
   ```

   The `soundtrack` id is the catch-all for film / musical / game OST cues (country 🎬
   for un-attributable scores; genre 🎬 for theme songs).

## Lyrics
Add a file named `assets/lyrics/<youtube-id>.lrc`. Each line is
`[MM:SS.xx]Original | Optional translation`. The ♪ Lyrics toggle appears whenever a
matching file exists for the playing video.

## Licensing

**Mine — GNU Affero General Public License v3.0 or later.** Everything in this
repository *except* the paths listed below. Copyright © 2026 Miguel Carino.
Full terms in [LICENSE](LICENSE).

**Not mine.** The files below are third-party works redistributed here. This
project's licence does not cover them and could not: they are not mine to
relicense. Each keeps its own terms, and each carries its own notice.

| Path | What it is | Licence | Notice |
| --- | --- | --- | --- |
| [`assets/webfonts/`](assets/webfonts/) | Liberation Sans | SIL OFL 1.1 | [`assets/webfonts/OFL.txt`](assets/webfonts/OFL.txt) |
| [`fonts/`](fonts/) | IBM Plex Mono, IBM Plex Sans, Red Hat Display | SIL OFL 1.1 | [`fonts/OFL.txt`](fonts/OFL.txt) |

Those files travel with any fork, mirror or repackaging of this repository, and
their notices must travel with them.
