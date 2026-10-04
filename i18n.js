// i18n — Music Grid UI chrome. English strings ARE the keys, so a missing
// entry falls back to English. Locale comes from the fleet resolver
// (carino-lang.js → window.CarinoLang.current) — this file only owns the
// dictionaries and applies them. Content (albums, countries, genres in
// catalog.json) is data and is never translated here.
// Load order: catalog -> clock -> carino-lang -> i18n -> navbar -> grid
// (all deferred, so t() is a global by the time navbar.js / grid.js run).

const I18N = {
    es: {
        // Navbar / diagnostics
        'Status': 'Estado',
        'Library': 'Biblioteca',
        'Songs': 'Canciones',
        'Countries': 'Países',
        'Carino picks': 'Selección de Carino',
        'Now playing': 'Reproduciendo',
        'Track': 'Pista',
        'From': 'Origen',
        'Session': 'Sesión',
        'Filter': 'Filtro',
        'In queue': 'En cola',
        'Local time': 'Hora local',
        'Library status': 'Estado de la biblioteca',
        'Carino Systems — back to hub': 'Carino Systems — volver al hub',
        'Music — reload': 'Music — recargar',
        // Controls bar
        'Autoplay': 'Reproducción automática',
        'Pause': 'Pausar',
        'Resume': 'Reanudar',
        'Lyrics': 'Letra',
        'Keep playing songs automatically': 'Seguir reproduciendo canciones automáticamente',
        'Toggle lyrics': 'Mostrar u ocultar la letra',
        'Play': 'Reproducir',
        'Previous': 'Anterior',
        'Next': 'Siguiente',
        'List': 'Lista',
        'Show the songs in this section': 'Mostrar las canciones de esta sección',
        'Search songs…': 'Buscar canciones…',
        'Close list': 'Cerrar la lista',
        'songs': 'canciones',
        'No songs match': 'Ninguna canción coincide',
        'Lyrics timing for this song — + shows lines sooner, click to reset': 'Sincronía de la letra en esta canción — + adelanta las líneas, clic para restablecer',
        'Show lyrics sooner': 'Mostrar la letra antes',
        'Show lyrics later': 'Mostrar la letra después',
        'Play a random song': 'Reproducir una canción al azar',
        'Pause auto-scroll': 'Pausar el desplazamiento automático',
        // Filters
        'All': 'Todo',
        'Country': 'País',
        'Genre': 'Género',
        'Mood': 'Ánimo',
        'Party': 'Fiesta',
        'Meme': 'Meme',
        'Songs that became memes': 'Canciones que se volvieron memes',
        "Miguel's personal list": 'La lista personal de Miguel',
        'Filter by': 'Filtrar por',
        // Queue + panel
        'Queue': 'Cola',
        '✓ In Queue': '✓ En cola',
        '+ Add to queue': '+ Añadir a la cola',
        'Add to queue': 'Añadir a la cola',
        'Remove from queue': 'Quitar de la cola',
        'Close panel': 'Cerrar panel',
        'Album cover': 'Portada del álbum',
        // Greeting
        'Good morning.': 'Buenos días.',
        'Good afternoon.': 'Buenas tardes.',
        'Good evening.': 'Buenas noches.',
        'Burning the midnight oil.': 'Quemándose las pestañas.',
    },
    'pt-BR': {
        'Status': 'Status',
        'Library': 'Biblioteca',
        'Songs': 'Músicas',
        'Countries': 'Países',
        'Carino picks': 'Escolhas do Carino',
        'Now playing': 'Tocando agora',
        'Track': 'Faixa',
        'From': 'Origem',
        'Session': 'Sessão',
        'Filter': 'Filtro',
        'In queue': 'Na fila',
        'Local time': 'Hora local',
        'Library status': 'Status da biblioteca',
        'Carino Systems — back to hub': 'Carino Systems — voltar ao hub',
        'Music — reload': 'Music — recarregar',
        'Autoplay': 'Reprodução automática',
        'Pause': 'Pausar',
        'Resume': 'Retomar',
        'Lyrics': 'Letra',
        'Keep playing songs automatically': 'Continuar tocando músicas automaticamente',
        'Toggle lyrics': 'Mostrar ou ocultar a letra',
        'Play': 'Tocar',
        'Previous': 'Anterior',
        'Next': 'Próxima',
        'List': 'Lista',
        'Show the songs in this section': 'Mostrar as músicas desta seção',
        'Search songs…': 'Buscar músicas…',
        'Close list': 'Fechar a lista',
        'songs': 'músicas',
        'No songs match': 'Nenhuma música encontrada',
        'Lyrics timing for this song — + shows lines sooner, click to reset': 'Sincronia da letra nesta música — + adianta as linhas, clique para redefinir',
        'Show lyrics sooner': 'Mostrar a letra antes',
        'Show lyrics later': 'Mostrar a letra depois',
        'Play a random song': 'Tocar uma música aleatória',
        'Pause auto-scroll': 'Pausar a rolagem automática',
        'All': 'Tudo',
        'Country': 'País',
        'Genre': 'Gênero',
        'Mood': 'Clima',
        'Party': 'Festa',
        'Meme': 'Meme',
        'Songs that became memes': 'Músicas que viraram memes',
        "Miguel's personal list": 'A lista pessoal do Miguel',
        'Filter by': 'Filtrar por',
        'Queue': 'Fila',
        '✓ In Queue': '✓ Na fila',
        '+ Add to queue': '+ Adicionar à fila',
        'Add to queue': 'Adicionar à fila',
        'Remove from queue': 'Remover da fila',
        'Close panel': 'Fechar painel',
        'Album cover': 'Capa do álbum',
        'Good morning.': 'Bom dia.',
        'Good afternoon.': 'Boa tarde.',
        'Good evening.': 'Boa noite.',
        'Burning the midnight oil.': 'Virando a noite.',
    },
    ja: {
        'Status': 'ステータス',
        'Library': 'ライブラリ',
        'Songs': '曲数',
        'Countries': '国数',
        'Carino picks': 'Carinoの選曲',
        'Now playing': '再生中',
        'Track': 'トラック',
        'From': '分類',
        'Session': 'セッション',
        'Filter': 'フィルター',
        'In queue': 'キュー内',
        'Local time': 'ローカル時刻',
        'Library status': 'ライブラリの状態',
        'Carino Systems — back to hub': 'Carino Systems — ハブに戻る',
        'Music — reload': 'Music — 再読み込み',
        'Autoplay': '自動再生',
        'Pause': '一時停止',
        'Resume': '再開',
        'Lyrics': '歌詞',
        'Keep playing songs automatically': '曲を自動で再生し続けます',
        'Toggle lyrics': '歌詞の表示を切り替え',
        'Play': '再生',
        'Previous': '前へ',
        'Next': '次へ',
        'List': 'リスト',
        'Show the songs in this section': 'このセクションの曲を表示',
        'Search songs…': '曲を検索…',
        'Close list': 'リストを閉じる',
        'songs': '曲',
        'No songs match': '一致する曲はありません',
        'Lyrics timing for this song — + shows lines sooner, click to reset': 'この曲の歌詞のタイミング — + で早く表示、クリックでリセット',
        'Show lyrics sooner': '歌詞を早く表示',
        'Show lyrics later': '歌詞を遅く表示',
        'Play a random song': 'ランダムに1曲再生',
        'Pause auto-scroll': '自動スクロールを一時停止',
        'All': 'すべて',
        'Country': '国',
        'Genre': 'ジャンル',
        'Mood': 'ムード',
        'Party': 'パーティー',
        'Meme': 'ミーム',
        'Songs that became memes': 'ミームになった曲',
        "Miguel's personal list": 'Miguelの個人リスト',
        'Filter by': '絞り込み:',
        'Queue': 'キュー',
        '✓ In Queue': '✓ キュー済み',
        '+ Add to queue': '+ キューに追加',
        'Add to queue': 'キューに追加',
        'Remove from queue': 'キューから削除',
        'Close panel': 'パネルを閉じる',
        'Album cover': 'アルバムアート',
        'Good morning.': 'おはようございます。',
        'Good afternoon.': 'こんにちは。',
        'Good evening.': 'こんばんは。',
        'Burning the midnight oil.': '夜ふかしですね。',
    },
    ru: {
        'Status': 'Статус',
        'Library': 'Библиотека',
        'Songs': 'Песни',
        'Countries': 'Страны',
        'Carino picks': 'Выбор Carino',
        'Now playing': 'Сейчас играет',
        'Track': 'Трек',
        'From': 'Откуда',
        'Session': 'Сеанс',
        'Filter': 'Фильтр',
        'In queue': 'В очереди',
        'Local time': 'Местное время',
        'Library status': 'Состояние библиотеки',
        'Carino Systems — back to hub': 'Carino Systems — вернуться в хаб',
        'Music — reload': 'Music — перезагрузить',
        'Autoplay': 'Автовоспроизведение',
        'Pause': 'Пауза',
        'Resume': 'Продолжить',
        'Lyrics': 'Текст',
        'Keep playing songs automatically': 'Продолжать воспроизведение автоматически',
        'Toggle lyrics': 'Показать или скрыть текст песни',
        'Play': 'Воспроизвести',
        'Previous': 'Назад',
        'Next': 'Далее',
        'List': 'Список',
        'Show the songs in this section': 'Показать песни этого раздела',
        'Search songs…': 'Поиск песен…',
        'Close list': 'Закрыть список',
        'songs': 'песен',
        'No songs match': 'Ничего не найдено',
        'Lyrics timing for this song — + shows lines sooner, click to reset': 'Синхронизация текста для этой песни — + показывает строки раньше, нажмите для сброса',
        'Show lyrics sooner': 'Показывать текст раньше',
        'Show lyrics later': 'Показывать текст позже',
        'Play a random song': 'Включить случайную песню',
        'Pause auto-scroll': 'Приостановить автопрокрутку',
        'All': 'Все',
        'Country': 'Страна',
        'Genre': 'Жанр',
        'Mood': 'Настроение',
        'Party': 'Вечеринка',
        'Meme': 'Мемы',
        'Songs that became memes': 'Песни, ставшие мемами',
        "Miguel's personal list": 'Личный список Мигеля',
        'Filter by': 'Фильтр:',
        'Queue': 'Очередь',
        '✓ In Queue': '✓ В очереди',
        '+ Add to queue': '+ В очередь',
        'Add to queue': 'Добавить в очередь',
        'Remove from queue': 'Убрать из очереди',
        'Close panel': 'Закрыть панель',
        'Album cover': 'Обложка альбома',
        'Good morning.': 'Доброе утро.',
        'Good afternoon.': 'Добрый день.',
        'Good evening.': 'Добрый вечер.',
        'Burning the midnight oil.': 'Полуночничаем.',
    },
};

let LOCALE = 'en';

function currentFleetLang() {
    return (window.CarinoLang && window.CarinoLang.current) || 'en';
}

function setLocale(l) {
    LOCALE = (l === 'en' || I18N[l]) ? l : 'en';
    document.documentElement.lang = LOCALE;
}

function t(key) {
    const dict = I18N[LOCALE];
    return (dict && dict[key]) || key;
}

// Static markup: elements carrying data-i18n use their original English text
// as the key (captured on first pass so locale switches stay reversible).
function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
        if (!el.dataset.i18nKey) el.dataset.i18nKey = el.textContent.trim();
        el.textContent = t(el.dataset.i18nKey);
    });
}

// Prominent title / aria-label attributes, addressed explicitly (not data-i18n).
const I18N_ATTRS = [
    ['#listToggle',     'title', 'Show the songs in this section'],
    ['#songSearch',     'placeholder', 'Search songs…'],
    ['#songListClose',  'aria-label', 'Close list'],
    ['#autoplayToggle', 'title', 'Keep playing songs automatically'],
    ['#lyricsToggle',   'title', 'Toggle lyrics'],
    ['#lyricsOffsetVal', 'title', 'Lyrics timing for this song — + shows lines sooner, click to reset'],
    ['#lyricsSooner',   'aria-label', 'Show lyrics sooner'],
    ['#lyricsLater',    'aria-label', 'Show lyrics later'],
    ['#prevBtn',        'title', 'Previous'],
    ['#prevBtn',        'aria-label', 'Previous'],
    ['#nextBtn',        'title', 'Next'],
    ['#nextBtn',        'aria-label', 'Next'],
    ['#randomBtn',      'title', 'Play a random song'],
    ['#randomBtn',      'aria-label', 'Play a random song'],
    ['#scrollToggle',   'title', 'Pause auto-scroll'],
    ['#closeInfoBar',   'aria-label', 'Close panel'],
    ['#diagToggle',     'title', 'Library status'],
    ['#diagToggle',     'aria-label', 'Library status'],
    ['.brand-name',     'title', 'Carino Systems — back to hub'],
    ['.app-tag',        'title', 'Music — reload'],
];

function applyAttrI18n() {
    I18N_ATTRS.forEach(function (spec) {
        const el = document.querySelector(spec[0]);
        if (el) el.setAttribute(spec[1], t(spec[2]));
    });
}

// JS-managed controls whose label depends on state — resynced from their
// visible state only (display-only, no app logic touched).
function applyDynamicI18n() {
    const scrollBtn = document.getElementById('scrollToggle');
    if (scrollBtn) {
        scrollBtn.textContent = scrollBtn.classList.contains('paused') ? t('Resume') : t('Pause');
    }
    const autoplayBtn = document.getElementById('autoplayToggle');
    if (autoplayBtn) {
        autoplayBtn.textContent = t('Autoplay');
    }
    const lyricsBtn = document.getElementById('lyricsToggle');
    if (lyricsBtn && lyricsBtn.style.display !== 'none') {
        lyricsBtn.textContent = t('Lyrics');
    }
    const queueAdd = document.getElementById('queueAddBtn');
    if (queueAdd) {
        queueAdd.textContent = queueAdd.disabled ? t('✓ In Queue') : t('+ Add to queue');
    }
    document.querySelectorAll('.queue-label').forEach(function (el) {
        el.textContent = t('Queue');
    });
    // "All" quick pill (the ★ Carino pill is brand and stays as-is)
    document.querySelectorAll('.filter-btn[data-ftype="all"]').forEach(function (el) {
        el.textContent = t('All');
    });
    document.querySelectorAll('.filter-btn[data-ftype="meme"]').forEach(function (el) {
        el.textContent = t('Meme');
        el.title = t('Songs that became memes');
    });
    // Dropdown buttons showing their default label (an active pick keeps its
    // own country/genre label, which is data and stays untouched).
    const MENU_LABELS = { party: 'Party', country: 'Country', genre: 'Genre', mood: 'Mood' };
    document.querySelectorAll('.filter-menu-btn').forEach(function (el) {
        const def = MENU_LABELS[el.dataset.menu];
        if (def && !el.classList.contains('active')) el.textContent = t(def) + ' ▾';
    });
}

function applyI18n() {
    setLocale(currentFleetLang());
    applyStaticI18n();
    applyAttrI18n();
    applyDynamicI18n();
}

// carino-lang.js is deferred and runs before this (script order), so
// CarinoLang exists by DOMContentLoaded. This listener is registered before
// navbar.js / grid.js run theirs, so LOCALE is set before they render.
document.addEventListener('DOMContentLoaded', applyI18n);
window.addEventListener('carino:langchange', applyI18n);
