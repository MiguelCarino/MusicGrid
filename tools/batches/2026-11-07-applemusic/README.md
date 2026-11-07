# Apple Music library, 2026-11-07

- `applemusic-library.json` — the export: 1,916 songs as `{n, ar, al, ms, g, cat}` (title,
  artist, album, length in ms, Apple Music genre, catalog id), read from music.apple.com.
- `library.json` — the same songs staged by `batchadd.py library`, with a suggested mood
  each and your approvals (all pending when this was committed).

Review on any machine:

```sh
mkdir -p tools/inbox
cp tools/batches/2026-11-07-applemusic/library.json tools/inbox/
python3 tools/addsong_web.py          # then open http://localhost:8765/library
```

(`python3 tools/batchadd.py library tools/batches/2026-11-07-applemusic/applemusic-library.json`
stages the export afresh instead, with moods suggested from the catalog as it is then.)
Approvals live in `tools/inbox/library.json`, which git ignores; copy it back here and
commit it to carry them to another machine.
