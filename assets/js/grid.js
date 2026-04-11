(function () {
    'use strict';

    const API_KEY   = 'AIzaSyCmtV8QIecdM2A-5YCGRPanLqIsOIjoV74';
    const QUEUE_MAX = 10;

    /* ── State ──────────────────────────────────────────────── */
    let activeCategory = '';   // category pill filter  → album.category
    let searchQuery    = '';   // search bar filter     → album.tag
    let scrollPaused   = false;
    let activeCell     = null;
    let scrollTimer    = null;
    let currentAlbum   = null; // album currently playing in the panel

    /* ── Queue ──────────────────────────────────────────────── */
    let queue = [];

    /* ── Lyrics ─────────────────────────────────────────────── */
    let lyricsData   = [];
    let lyricsCueIdx = -1;
    let lyricsTimer  = null;

    /* ── YouTube IFrame API ─────────────────────────────────── */
    let ytPlayer    = null;
    let ytReady     = false;
    let pendingVideo = null;

    window.onYouTubeIframeAPIReady = function () {
        ytReady = true;
        if (pendingVideo) { createYTPlayer(pendingVideo); pendingVideo = null; }
    };

    /* ── URL state ──────────────────────────────────────────── */
    /*
     * URL format: ?v=VIDEO_ID&q=ID1,ID2,ID3
     *   v  = currently playing video
     *   q  = comma-separated queue video IDs
     * Use replaceState so every song-change doesn't spam browser history.
     */
    function updateURL() {
        const p = new URLSearchParams();
        if (currentAlbum)  p.set('v', currentAlbum.url);
        if (queue.length)  p.set('q', queue.map(a => a.url).join(','));
        const qs = p.toString();
        history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    }

    function albumByUrl(vid) {
        return albums.find(a => a.url === vid) || null;
    }

    function restoreFromURL() {
        const p    = new URLSearchParams(location.search);
        const qStr = p.get('q');
        if (qStr) {
            qStr.split(',').forEach(function (vid) {
                const a = albumByUrl(vid.trim());
                if (a && !queue.some(q => q.url === a.url) && queue.length < QUEUE_MAX) {
                    queue.push(a);
                }
            });
            renderQueue();
        }
        const vStr = p.get('v');
        if (vStr) {
            const a = albumByUrl(vStr.trim());
            if (a) openPanel(a);
        }
    }

    /* ── Helpers ────────────────────────────────────────────── */
    function getScrollSpeed() {
        return navigator.userAgent.includes('Firefox') ? 3 : 1;
    }

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function visibleAlbums() {
        let pool = albums;
        if (activeCategory) pool = pool.filter(a => (a.category || '') === activeCategory);
        if (searchQuery)    pool = pool.filter(a => (a.tag || '').toLowerCase().includes(searchQuery));
        return pool;
    }

    /* ── Grid ───────────────────────────────────────────────── */
    function addCell(grid, album) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.backgroundImage = `url(assets/covers/${album.image})`;
        if (album.tag) cell.title = album.tag;
        cell.addEventListener('click', function () {
            /*
             * If a song is already playing, route the click to the queue
             * instead of replacing the current song. Random always plays now.
             */
            if (currentAlbum) {
                addToQueue(album);
            } else {
                setActiveCell(cell);
                openPanel(album);
            }
        });
        grid.appendChild(cell);
    }

    function populateGrid(grid) {
        const pool = visibleAlbums();
        if (!pool.length) return;
        let s = shuffle(pool);
        for (let i = 0; i < 170; i++) {
            if (i > 0 && i % s.length === 0) s = shuffle(pool);
            addCell(grid, s[i % s.length]);
        }
    }

    function refreshGrid(grid) {
        grid.innerHTML = '';
        clearActiveCell();
        populateGrid(grid);
        grid.scrollTop = 0;
    }

    /* ── Active cell ────────────────────────────────────────── */
    function setActiveCell(cell) {
        if (activeCell) activeCell.classList.remove('active');
        activeCell = cell;
        if (cell) cell.classList.add('active');
    }

    function clearActiveCell() { setActiveCell(null); }

    /* ── Auto-scroll ────────────────────────────────────────── */
    function startAutoScroll(grid) {
        if (scrollTimer) clearInterval(scrollTimer);
        const speed = getScrollSpeed();
        scrollTimer = setInterval(function () {
            if (!scrollPaused) grid.scrollTop += speed;
        }, 50);
    }

    /* ── Category pills ─────────────────────────────────────── */
    function buildFilters(container, grid) {
        const cats = [...new Set(albums.map(a => a.category).filter(Boolean))].sort();

        function makeBtn(label, cat) {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (cat === activeCategory ? ' active' : '');
            btn.textContent = label;
            btn.addEventListener('click', function () {
                if (activeCategory === cat) return;
                activeCategory = cat;
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                refreshGrid(grid);
            });
            return btn;
        }

        container.appendChild(makeBtn('All', ''));
        cats.forEach(cat => container.appendChild(makeBtn(cat, cat)));
    }

    /* ── Queue ──────────────────────────────────────────────── */
    function syncQueueBtn() {
        /* Re-evaluates the "+ Queue / ✓ In Queue" button for the current album. */
        const btn = document.getElementById('queueAddBtn');
        if (!btn || !currentAlbum) return;
        const inQ = queue.some(a => a.url === currentAlbum.url);
        btn.textContent = inQ ? '✓ In Queue' : '+ Queue';
        btn.disabled    = inQ;
    }

    function addToQueue(album) {
        if (queue.length >= QUEUE_MAX) return;
        if (queue.some(a => a.url === album.url)) return;
        queue.push(album);
        renderQueue();
        syncQueueBtn();
        updateURL();
    }

    function renderQueue() {
        const bar = document.getElementById('queueBar');
        bar.innerHTML = '';

        if (!queue.length) {
            bar.classList.remove('has-items');
            return;
        }

        bar.classList.add('has-items');

        const lbl = document.createElement('span');
        lbl.className   = 'queue-label';
        lbl.textContent = 'Queue';
        bar.appendChild(lbl);

        queue.forEach(function (album, idx) {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.style.backgroundImage = `url(assets/covers/${album.image})`;
            if (album.tag) item.title = album.tag;
            if (currentAlbum && currentAlbum.url === album.url) item.classList.add('playing');

            item.addEventListener('click', function (e) {
                if (e.target.classList.contains('queue-remove')) return;
                clearActiveCell();
                openPanel(album);
            });

            const rm = document.createElement('button');
            rm.className = 'queue-remove';
            rm.setAttribute('aria-label', 'Remove from queue');
            rm.textContent = '×';
            rm.addEventListener('click', function (e) {
                e.stopPropagation();
                queue.splice(idx, 1);
                renderQueue();
                syncQueueBtn(); /* reset "✓ In Queue" button if needed */
                updateURL();
            });

            item.appendChild(rm);
            bar.appendChild(item);
        });
    }

    /* ── LRC parser ─────────────────────────────────────────── */
    /*
     * File: assets/lyrics/<youtube-video-id>.lrc
     * Keyed to video ID so songs sharing a cover still get separate files.
     *
     * Format:
     *   [MM:SS.xx]Original | Translation
     *   [MM:SS.xx]Line without translation
     * Hundredths (xx) or milliseconds (xxx) accepted.
     */
    function parseLRC(text) {
        const re   = /^\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)$/;
        const cues = [];
        text.split('\n').forEach(function (line) {
            const m = line.match(re);
            if (!m) return;
            const time = parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
                + parseInt(m[3], 10) / (m[3].length === 2 ? 100 : 1000);
            const content = m[4].trim();
            const sep     = content.indexOf(' | ');
            cues.push({
                time,
                original:    sep >= 0 ? content.slice(0, sep).trim() : content,
                translation: sep >= 0 ? content.slice(sep + 3).trim() : '',
            });
        });
        return cues.sort((a, b) => a.time - b.time);
    }

    /* ── Lyrics overlay ─────────────────────────────────────── */
    function buildLyricsPanel(cues) {
        lyricsData   = cues;
        lyricsCueIdx = -1;

        const container = document.getElementById('lyricsContainer');
        container.innerHTML = '';

        cues.forEach(function (cue, idx) {
            const line = document.createElement('div');
            line.className  = 'lyric-line';
            line.dataset.idx = idx;

            const orig = document.createElement('div');
            orig.className   = 'lyric-original';
            orig.textContent = cue.original;
            line.appendChild(orig);

            if (cue.translation) {
                const tr = document.createElement('div');
                tr.className   = 'lyric-translation';
                tr.textContent = cue.translation;
                line.appendChild(tr);
            }

            container.appendChild(line);
        });

        /* Show with opacity fade-in (display:none → flex, then trigger opacity) */
        const section = document.getElementById('lyricsSection');
        section.style.display = 'flex';
        void section.offsetWidth; /* force reflow */
        section.classList.add('visible');
    }

    function hideLyricsPanel() {
        const section = document.getElementById('lyricsSection');
        section.classList.remove('visible');
        section.style.display = 'none';
        lyricsData   = [];
        lyricsCueIdx = -1;
        stopLyricsSync();
    }

    function highlightLine(idx) {
        const container = document.getElementById('lyricsContainer');
        container.querySelectorAll('.lyric-line').forEach(function (el) {
            el.classList.toggle('current', +el.dataset.idx === idx);
        });
        if (idx >= 0) {
            const el = container.querySelector(`.lyric-line[data-idx="${idx}"]`);
            if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    /* ── Lyrics sync ────────────────────────────────────────── */
    function startLyricsSync() {
        stopLyricsSync();
        if (!lyricsData.length) return;
        lyricsTimer = setInterval(function () {
            if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') return;
            const t = ytPlayer.getCurrentTime();
            let idx = -1;
            for (let i = 0; i < lyricsData.length; i++) {
                if (lyricsData[i].time <= t) idx = i; else break;
            }
            if (idx !== lyricsCueIdx) {
                lyricsCueIdx = idx;
                highlightLine(idx);
            }
        }, 100);
    }

    function stopLyricsSync() {
        if (lyricsTimer) { clearInterval(lyricsTimer); lyricsTimer = null; }
    }

    /* ── YouTube player ─────────────────────────────────────── */
    function createYTPlayer(videoId) {
        const slot = document.getElementById('ytPlayerSlot');
        slot.innerHTML = '';
        const div = document.createElement('div');
        slot.appendChild(div);

        ytPlayer = new YT.Player(div, {
            videoId,
            width: 640, height: 360,
            playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
            events: {
                onStateChange: function (e) {
                    if (e.data === YT.PlayerState.PLAYING) startLyricsSync();
                    else stopLyricsSync();
                }
            }
        });
    }

    function loadVideo(videoId) {
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(videoId);
        } else if (ytReady) {
            createYTPlayer(videoId);
        } else {
            pendingVideo = videoId;
        }
    }

    /* ── Info panel ─────────────────────────────────────────── */
    function openPanel(album) {
        currentAlbum = album;
        updateURL();

        hideLyricsPanel();

        /* Try to load lyrics by video ID */
        fetch(`assets/lyrics/${album.url}.lrc`)
            .then(function (r) { if (!r.ok) throw 0; return r.text(); })
            .then(function (text) {
                const cues = parseLRC(text);
                if (!cues.length) return;
                buildLyricsPanel(cues);
                if (ytPlayer && typeof ytPlayer.getPlayerState === 'function' &&
                    ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    startLyricsSync();
                }
            })
            .catch(function () {});

        fetchVideoDetails(album);
        renderQueue();
    }

    function fetchVideoDetails(album) {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${album.url}&key=${API_KEY}`;
        fetch(url)
            .then(r => r.json())
            .then(function (data) {
                const title = data.items && data.items.length ? data.items[0].snippet.title : '';
                displayVideoInfo(title, album);
            })
            .catch(function () { displayVideoInfo('', album); });
    }

    function displayVideoInfo(title, album) {
        /* Album art */
        const imgEl = document.getElementById('albumImage');
        imgEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = `assets/covers/${album.image}`;
        img.alt = title || 'Album cover';
        imgEl.appendChild(img);

        /* Title */
        document.getElementById('videoTitle').textContent = title;

        /* Platform links */
        const linksEl = document.getElementById('videoLinks');
        linksEl.innerHTML = '';
        [
            { label: 'YouTube',     href: `https://www.youtube.com/watch?v=${album.url}` },
            { label: 'Spotify',     href: `https://open.spotify.com/track/${album.spotifyurl}` },
            { label: 'Apple Music', href: `https://music.apple.com/${album.applemusicurl}` },
        ].forEach(function ({ label, href }) {
            const a = document.createElement('a');
            a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
            a.textContent = label;
            linksEl.appendChild(a);
        });

        /* + Queue button — create once, update on subsequent opens */
        let qBtn = document.getElementById('queueAddBtn');
        if (!qBtn) {
            qBtn = document.createElement('button');
            qBtn.id = 'queueAddBtn';
            document.getElementById('videoInfoBar')
                .insertBefore(qBtn, document.getElementById('videoPlayer'));
        }
        const inQ = queue.some(a => a.url === album.url);
        qBtn.textContent = inQ ? '✓ In Queue' : '+ Queue';
        qBtn.disabled    = inQ;
        qBtn.onclick     = function () { addToQueue(album); };

        loadVideo(album.url);
        document.getElementById('videoInfoBar').classList.add('show');
    }

    function closePanel() {
        document.getElementById('videoInfoBar').classList.remove('show');
        if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
        hideLyricsPanel();
        clearActiveCell();
        currentAlbum = null;
        renderQueue();
        updateURL();
    }

    /* ── Init ───────────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', function () {
        const musicgrid = document.getElementById('musicgrid');
        const filtersEl = document.getElementById('sectionFilters');
        const toggleBtn = document.getElementById('scrollToggle');
        const randomBtn = document.getElementById('randomBtn');
        const searchEl  = document.getElementById('searchBar');
        const closeBtn  = document.getElementById('closeInfoBar');

        if (!musicgrid) { console.error('MusicGrid element not found.'); return; }

        /* Load YouTube IFrame API */
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(s);

        buildFilters(filtersEl, musicgrid);

        searchEl.addEventListener('input', function () {
            searchQuery = this.value.trim().toLowerCase();
            refreshGrid(musicgrid);
        });

        /* ONLY the button pauses/resumes scroll */
        toggleBtn.addEventListener('click', function () {
            scrollPaused = !scrollPaused;
            toggleBtn.textContent = scrollPaused ? '▶ Resume' : '⏸ Pause';
        });

        /* Random always plays immediately, ignoring "currently playing" rule */
        randomBtn.addEventListener('click', function () {
            const pool = visibleAlbums();
            if (!pool.length) return;
            clearActiveCell();
            openPanel(pool[Math.floor(Math.random() * pool.length)]);
        });

        closeBtn.addEventListener('click', closePanel);

        /* Tab-out fix: browsers throttle setInterval in background tabs */
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) startAutoScroll(musicgrid);
        });

        /* Infinite scroll */
        musicgrid.addEventListener('scroll', function () {
            if (musicgrid.scrollTop + musicgrid.clientHeight >=
                musicgrid.scrollHeight - musicgrid.clientHeight * 0.5) {
                populateGrid(musicgrid);
            }
        });

        populateGrid(musicgrid);
        startAutoScroll(musicgrid);

        /* Restore song + queue from URL params (sharing support) */
        restoreFromURL();
    });

})();
