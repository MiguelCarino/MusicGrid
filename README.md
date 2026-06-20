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
