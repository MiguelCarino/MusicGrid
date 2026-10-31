# MusicGrid

A self-generating music wall. Click any cover to play it (YouTube), browse the
collection **by country**, queue songs, and follow along with synced lyrics.

🔗 https://music.carino.systems/ · custom deployment at https://carino.systems/music.html

![mpv-shot0001](https://github.com/MiguelCarino/MusicGrid/assets/6355310/80d25dbf-f4c0-4179-a6c9-6eaf8292ab36)
![mpv-shot0002](https://github.com/MiguelCarino/MusicGrid/assets/6355310/175d165f-b21e-4361-8afa-e77a104764be)

## Features
- **Carino navbar** — the shared `carino-navbar.js` (it slides away in fullscreen or
  when idle); the filters and the 🕺 *Mascots* gallery ride in it.
- **Help and keys** — `?`/`H` help, `P`/`Space` pause the wall, `M` sound, `L` list,
  `F` fullscreen. Under reduced motion the wall starts paused. YouTube and LRCLIB load
  only after you play a song.
- **Navbar lists** — **★ Carino** (Miguel's personal picks, `carino: true`), **All**, and
  **📚 Lists**: one popup with every specific list, in tabs — *Lists* (🎉 Party per country,
  😂 Meme), *Country*, *Genre* and *Mood* — each with song counts, built from the catalog, plus
  a search box across all of them (Enter picks the first match). The button shows the list
  you're on. Party = the songs every party plays, per country; a song lists every country
  it's a staple in (`party: ["mexico", "colombia"]`), and party songs aren't personal picks
  (`carino: false`). Memes are `meme: true`.
- **List** — opens every song in the current section — the shuffle playlist (songs still to
  come first) or, with shuffle off, A–Z — with a search box (accent-insensitive; matches
  title, artist, country, genre and mood). Click a song to play it, **+** to queue it; ↑/↓ and
  Enter work from the search box, Escape closes it. It sits on the left; the player card,
  compact or the lyrics stage, is always on the right.
- **Shuffle** (🔀 in the dock, on by default) — Next, Autoplay and the List walk a shuffled
  playlist of the section, so no song repeats until all of it has played. Off: any random song.
- **Lyrics** are off by default; the choice is remembered.
- **Layout** — the lists live in the navbar; playback lives in a floating dock at the bottom
  center.
- **Transport** — ⏮ ▶/❚❚ ⏭ at the start of the dock. Previous restarts a song
  that's more than 3 s in, else steps back through what you played (the current song goes to
  the front of the queue); Next plays the queue, else a random song from the section. The
  queue sits right after them as small covers (hover one for × to remove it).
- **Autoplay** — toggle in the dock; when on, a fresh song keeps playing after each
  one ends even with an empty queue (preference saved in `localStorage`).
- **Dancer** — when a song has no lyrics (or LRCLIB can't be reached), a mascot dances on
  the lyrics stage instead, picking random moves from its genre (headbang for rock, robot
  for electronic, salsa for Latin, twerk for reggaeton…). The cast is original pixel art:
  Lola, a dancer in a crop tee, leggings and sneakers (or a bikini, tube top, sports set
  or mini dress) whose hairstyle and hair colour are random every time; Moe and Matrix,
  drawn the same way (`assets/js/mascot-moe.js`, `assets/js/mascot-matrix.js`, built on
  the kit and registry in `assets/js/mascots.js`); and crt, a monitor buddy. Each body
  part is baked into one pixelated image in the browser, so no hairlines show between
  pixel rows when the parts turn. Reggaeton twerks facing away, looking back over the
  shoulder or from the side (Moe never twerks); 40-odd moves in all, each with a random
  tempo and sometimes mirrored. **🕺 Mascots** in the navbar shows them all dancing: pick one (or
  Random, or Everyone: the whole cast at once on a song with no lyrics) and how they dance
  (the song's genre, random moves, or one genre's moves). On a song with lyrics the mascot
  dances on the right of the stage, behind the lyrics. ✕ on the lyrics stage only leaves
  lyrics mode; the song keeps playing in the compact card. It
  pauses with the song and stands still under reduced motion (`assets/js/dancer.js`). Lyrics fetched once are kept in the visitor's own
  `localStorage`, and a busy LRCLIB is retried.
- Randomizer, auto-scrolling wall, a 10-song queue, synced karaoke lyrics from LRCLIB, and a
  redesigned now-playing panel with clickable country/genre/mood chips.
- Everything is shareable via URL params (`?v=` play, `?q=` queue, `?cat=` filter). Filters
  encode as `?cat=country:japan`, `?cat=genre:rock`, `?cat=mood:chill`,
  `?cat=party:mexico` or `?cat=meme` (a bare
  `?cat=japan` still works as a country).

## Adding music

### Many songs at once — `tools/addsong_web.py` → **Batch**
Run `python3 tools/addsong_web.py` and open **http://localhost:8765/batch**. Paste
YouTube links, video ids, a whole playlist link, or plain search terms. Everything is
resolved automatically into a review inbox (`tools/inbox/`, not committed): the
"Artist — Title" tag, Apple Music link and cover come from iTunes, the artist's country
from songs already in the catalog or else from MusicBrainz, the genre from iTunes, and
the LRCLIB record of its synced lyrics. Songs already in the catalog are skipped, and songs from an
album that's already there reuse its cover.

Press **Fetch** and watch the list fill in. Every song gets a card with its cover and
dropdowns: green means ready, red marks what still needs picking (usually just the mood,
which the "Set mood on songs without one" button fills in one go). **Write ready songs**
saves the covers and catalog entries; review with `git diff` and commit.

The same thing works from the terminal with `tools/batchadd.py`:

```sh
python3 tools/batchadd.py fetch "https://www.youtube.com/playlist?list=…" --mood chill
python3 tools/batchadd.py fetch --from songs.txt      # one link / id / "artist title" per line
python3 tools/batchadd.py review    # asks only for what's missing (usually the mood)
python3 tools/batchadd.py commit    # covers → assets/covers/mu_N.webp, entries → catalog
```

`--country`, `--genre`, `--mood`, `--party mexico,colombia` and `--no-carino` apply to the
whole batch. `check` shows
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
   | `party`         | optional — country ids where it's a party staple (🎉 Party)     |
   | `meme`          | optional — `true` for songs that became memes (😂 Meme)         |
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
Lyrics are copyrighted, so this repository does not store them. A song's catalog entry
carries `"lrclib": <id>`, the id of its record on [LRCLIB](https://lrclib.net), and the
player fetches that record's synced lyrics from lrclib.net when the song plays. The add-song
tools look the record up and fill in the id. The ♪ Lyrics toggle appears once lyrics arrive.
On a desktop screen the lyrics turn the player card into a stage on the left half of
the screen: lyrics on top, the video and song details merged below. It always starts under
the queue strip, so the two never overlap.
Click any line to jump the song there; it keeps playing from that line.
In its corner, **⏱ − ±0.00s +** fixes lyrics that run early or late: each press moves them
0.25s (+ shows lines sooner, up to ±10s). It's remembered per song, since different uploads
of a song drift differently; click the number to reset.

## Licensing

**Mine — GNU Affero General Public License v3.0 or later.** Everything in this
repository *except* the paths listed below. Copyright © 2026 Miguel Carino.
Full terms in [LICENSE](LICENSE).

**Not mine.** The files below are third-party works redistributed here. This
project's licence does not cover them and could not: they are not mine to
relicense. Each keeps its own terms, and each carries its own notice.

| Path | What it is | Licence | Notice |
| --- | --- | --- | --- |
| [`fonts/`](fonts/) | IBM Plex Mono, IBM Plex Sans, Red Hat Display | SIL OFL 1.1 | [`fonts/OFL.txt`](fonts/OFL.txt) |

Those files travel with any fork, mirror or repackaging of this repository, and
their notices must travel with them.
