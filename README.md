# MusicGrid

A self-generating music wall. Click any cover to play it (YouTube), browse the
collection **by country**, queue songs, and follow along with synced lyrics.

🔗 https://music.carino.systems/ · custom deployment at https://carino.systems/music.html

![mpv-shot0001](https://github.com/MiguelCarino/MusicGrid/assets/6355310/80d25dbf-f4c0-4179-a6c9-6eaf8292ab36)
![mpv-shot0002](https://github.com/MiguelCarino/MusicGrid/assets/6355310/175d165f-b21e-4361-8afa-e77a104764be)

## Features
One screen, four parts: **search** at the top, the **cover wall** to browse, **Now playing
+ Up next** beside it, and the **player bar** at the foot. Every switch lives in ⚙ Settings.

- **Search first** — the box under the navbar (`/` jumps to it) searches every song in the
  catalog, accent-insensitive, by title, artist, country, genre and mood. Matching lists
  (★ Carino, a party list, a country, a genre, a mood) show as chips on top; a chip puts that
  list on the wall. Each song has **Play next** and **+ Add to queue**; a click plays it.
  ↑/↓ choose, **Enter** plays the top song when nothing is playing and adds it to Up next
  once music is on (**Shift+Enter** does the other), Esc closes. With the box empty it lists
  the songs of the list on the wall (in shuffle order, songs still to come first; A–Z with
  shuffle off).
- **Browse** — the auto-scrolling cover wall. Click a cover to play it, **+** on a cover to add
  it to Up next. Beside the search: **All**, **★ Carino** (Miguel's personal picks,
  `carino: true`) and **Lists**, one dialog with All / ★ Carino on top and every other list in
  tabs — *Lists* (🎉 Party per country, 😂 Meme), *Country*, *Genre* and *Mood* — with song
  counts and a search box (Enter picks the first match). Party = the songs every party
  plays, per country (`party: ["mexico", "colombia"]`, never personal picks); memes are
  `meme: true`. The wall stops while the pointer rests on it, under reduced motion, and
  with *Moving wall* off.
- **Player bar** — the song (click it for Now playing), ⏮ ▶/❚❚ ⏭, elapsed / length with a
  seek bar, 🎤 lyrics, Up next (with a count) and volume. Previous restarts a song more than
  3 s in, else steps back through what you played (the current song goes to the front of Up
  next). On a phone: cover, title, ⏮ ▶ ⏭ and Up next, with a thin seek line on top.
- **Now playing + Up next** — a panel beside the wall (a sheet over it on a phone): the
  video, title, artist, chips that put that country / genre / mood / party list on the
  wall, YouTube / Spotify / Apple Music links, then **Up next**. Up next plays first, then
  Autoplay carries on with the list on the wall; the panel says which. Reorder by dragging
  (desktop), with ↑/↓ (touch, or Alt+↑/↓ from the keyboard), remove with × (or Delete),
  **Clear** empties it. Up to 200 songs. Hiding the panel keeps the music playing.
- **Settings** (⚙ in the navbar) — Autoplay, Shuffle (no song repeats until the whole list
  has played; off: any random song), Smooth transitions, sound and volume, Party setup and
  Party lock, Lyrics, Moving wall, the TV display, the mascots and how they dance, keyboard
  shortcuts and fullscreen. All remembered in this browser.
- **Party setup — "What's tonight?"** — the first visit in a browser opens one screen with
  three big choices (again any time from ⚙ Settings → Party → Choose; `?welcome=1` forces it):
  - 🎤 **Karaoke** — lyrics on, Autoplay on, Shuffle off (people pick songs: Up next plays in
    order), TV display in Karaoke mode. Step two shows how to queue a song (search, then +),
    offers the TV display and puts the cursor in the search box.
  - 🎉 **Party** — Autoplay and Shuffle on, lyrics off on this page, TV display in Party mode
    (the mascots). Step two lists ★ Carino, the party lists per country and the biggest
    genres; a click puts that list on the wall and starts the music (that click is the
    gesture browsers need before they play sound).
  - 🎵 **Background** — Autoplay and Shuffle on, lyrics off, TV display Ambient, Moving wall
    on, volume down to 40 % (if it was higher). Step two lists All, ★ Carino and moods.
  - **Just browse** (or Esc) changes nothing. Each preset only flips switches: everything
    stays editable in Settings, and the choice is remembered (`mg_tonight`). A shared link
    (`?v=`, `?q=`, `?s=`) skips the setup; with `?cat=` that list is offered first.
- **Party lock** (⚙ Settings → Party) — a light house-party lock, not security. While it is
  on, guests can search, add songs to Up next (Play next joins the end of the line), take out
  songs they added themselves, and start the music when nothing plays (a cover or search
  "play" while music plays goes to Up next instead). Skipping, previous, pausing, seeking,
  the volume and mute, lyrics, the list (All / ★ Carino / Lists / chips), reordering,
  removing or clearing other people's songs, the TV display and Settings show a small
  padlock and ask for the PIN; the keyboard shortcuts and the TV display's keys follow the
  same rule, and closing the tab asks first. The right PIN does what was asked and unlocks
  for a minute (the 🔒 chip in the navbar counts down; click it to lock again). The PIN is
  optional (4 digits, set before turning the lock on); without one the host holds a button
  for two seconds. Five wrong tries wait 30 s. The lock and PIN are kept in this browser
  (`mg_lock`, `mg_lock_pin`), so a reload doesn't undo it.
- **Party polish** — the screen stays on while music plays (Screen Wake Lock, taken again
  when the tab comes back). A video YouTube won't play (embedding off, removed, private:
  `onError` 2, 5, 100, 101, 150) is skipped with a toast ("Skipped — … not available") and
  remembered for the session, so the shuffle and Up next pass it over; a video whose clock
  stops for 15 s while playing (40 s at 0:00, where an ad may be running) is reloaded where
  it stopped once, then skipped. After five failures in a row the music stops ("check the
  connection") instead of racing through the list. *Smooth transitions* (on by default)
  fades a song out over 0.35 s when you skip and fades every song in over 0.9 s (only the
  player's volume moves, never your setting). A song that starts by itself gets a "Now
  playing" toast; screen readers hear every new song, and the tab title reads
  ▶ Song — Artist (❚❚ when paused).
- **Keys** — `/` search · `Space`/`K` play or pause · `N` next · `B` previous · `←`/`→` 5 s ·
  `Q` Now playing · `L` lyrics · `M` sound · `P` pause the wall · `F` fullscreen · `D` TV
  display (`Shift+D` its next mode) · `?`/`H` help · `Esc` close. Under the party lock `N`
  `B` `←` `→` `Space` (pause) `L` `M` `P` `D` ask for the PIN. YouTube and LRCLIB load only
  after you play a song.
- **TV display** — for a house party: 📺 in the player bar (or ⚙ Settings → TV display, or
  `D`) opens `display.html` in its own window. Drag it to the TV or projector and press `F`
  (or click it) for fullscreen. The sound and the YouTube player stay on the music page; the
  display shows pictures only and follows the music page live (same browser, same machine).
  Three modes, picked in the 📺 pop-up, in Settings or with `1` `2` `3` on the display:
  - **Karaoke** — the line being sung, huge, its words turning gold as it goes; the next
    line under it, the last one faded, a translation if the lyrics carry one. Before the
    singing starts: the cover, title and artist big, then a 3-2-1 of dots; long breaks show
    notes and count in the next line the same way. The song and Up next sit in the corners.
    The lyrics timing set with ⏱ on the music page applies here too. A song with no lyrics
    shows the Party screen with a "No lyrics for this song" note.
  - **Party** — the mascots dancing big (the same cast and Settings → Mascots choice, sad
    moves for melancholic songs), the cover blurred behind them, the song, a progress bar
    and the next three songs.
  - **Ambient** — the cover wall drifting slowly in columns, with a small now-playing tag.

  On the display, `Space`/`K`, `N` and `B` play, pause and skip on the music page. It needs
  no navbar, hides the cursor after 3 s, keeps the screen awake, works from 1280×720 to 4K
  and on a portrait screen, and stands still under reduced motion. With no music page open
  it waits ("Waiting for the music…") and picks up again by itself.
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
  tempo and sometimes mirrored. **Settings → Mascots** shows them all dancing: pick one (or
  Random, or Everyone: the whole cast at once on a song with no lyrics) and how they dance
  (the song's genre, random moves, or one genre's moves). A melancholic song gets sad, slow
  moves instead (moping, hugging themselves, a hand on the heart, a hand to the chin,
  looking up at the sky in the rain) and sad, heartbroken or pensive faces. On a song with
  lyrics the mascot dances on the right of the stage, behind the lyrics. It pauses with the
  song and stands still under reduced motion (`assets/js/dancer.js`).
- **Shareable** — the URL carries the state: `?v=` the song (it waits for Play), `?q=` Up
  next, `?cat=` the list on the wall (`carino`, `meme`, `party:mexico`, `country:japan`,
  `genre:rock`, `mood:chill`; a bare `?cat=japan` still works as a country), `?s=` the
  search box.
- **Two themes** — Gold & Black and Colourful (the fleet's theme switch); the choice carries
  across carino.systems.

### For later pieces: the bus
`assets/js/mg-core.js` defines `window.MusicGrid`, which every part of the page talks
through, so a TV display window, party modes or guest requests can plug in without touching
`grid.js`. `MusicGrid.on(type, fn)` subscribes to `ready`, `track`, `playstate`, `time`,
`queue`, `filter`, `lyrics`, `lyricline`, `lyricsoffset`, `ended`, `settings`, `display`,
`unavailable` (a song was skipped: `reason` `error` / `stall`, YouTube `code`), `stall` and
`lock` (`{ locked, host }`); the actions are `play`,
`toggle`, `next`, `prev`, `seek`, `enqueue(song, { next, from })`, `removeAt`, `move`,
`clearQueue`, `setFilter`, `setVolume`, `setMuted`, `search`, `state()` and
`settings.get/set` (keys include `smooth`, `partyLock` and `tonight`; `set(key, value,
'preset')` tags a change made by the party setup). `MusicGrid.lock` (`locked()`,
`ask(what, then)`, `lock(pin)`, `unlock()`, `relock()`) and `MusicGrid.setup.open()` come
from `assets/js/party.js`, which also holds the wake lock and the now-playing title. The
header of `mg-core.js` lists every event's fields.

The TV display is the first piece built on it: `assets/js/display-link.js` (on the music
page) passes the bus events to `display.html` over `BroadcastChannel('musicgrid')` and
answers the display's `hello` with a full snapshot (`state()`, the mode, theme and
language); a `beat` each way every second or two tells each side the other is still there.
`assets/js/display.js` draws it, `assets/css/display.css` styles it. The message list is in
the header of `display-link.js`.

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
tools look the record up and fill in the id. Turn lyrics on with 🎤 in the player bar,
`L`, or Settings (off by default; remembered): they take the stage over the wall, beside the
Now playing panel, full screen on a phone.
Click any line to jump the song there; it keeps playing from that line.
In the stage's corner, **⏱ − ±0.00s +** fixes lyrics that run early or late: each press moves them
0.25s (+ shows lines sooner, up to ±10s). It's remembered per song, since different uploads
of a song drift differently; click the number to reset. Lyrics fetched once are kept in the
visitor's own `localStorage` (the last 150 songs), and a busy LRCLIB is retried.

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
