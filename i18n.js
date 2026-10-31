// i18n — Music Grid UI chrome. English strings ARE the keys, so a missing
// entry falls back to English. Locale comes from the fleet resolver
// (carino-lang.js → window.CarinoLang.current) — this file only owns the
// dictionaries and applies them. Content (albums, countries, genres in
// catalog.json) is data and is never translated here.
// Load order: catalog -> carino-navbar -> carino-lang -> i18n -> dancer -> grid
// (all deferred, so t() is a global by the time dancer.js / grid.js run).

const I18N = {
    es: {
        // Lists popup
        "Lists": "Listas",
        "Search lists…": "Buscar listas…",
        "No lists match": "Ninguna lista coincide",
        // Mascots / shuffle
        "Mascots": "Mascotas",
        "Mascot": "Mascota",
        "Dance": "Baile",
        "Random": "Al azar",
        "Everyone": "Todos",
        "Song's genre": "Género de la canción",
        "Random moves": "Pasos al azar",
        "Dances on the lyrics stage when a song has no lyrics.": "Baila en el panel de letras cuando una canción no tiene letra.",
        "Dances on the lyrics stage when a song has no lyrics, and beside the lyrics when it has them.": "Baila en el panel de letras cuando una canción no tiene letra, y junto a la letra cuando la tiene.",
        "All mascots at once when a song has no lyrics": "Todas las mascotas a la vez cuando una canción no tiene letra",
        "Shuffle": "Aleatorio",
        "Shuffle on: no song repeats until the whole section has played": "Aleatorio activado: ninguna canción se repite hasta que suene toda la sección",
        "Shuffle off": "Aleatorio desactivado",
        "See the dancing mascots and choose how they dance": "Mira las mascotas bailando y elige cómo bailan",
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
        // Play controls + help overlay
        "Late shift.": "Turno nocturno.",
        "More": "Más",
        "Resume auto-scroll": "Reanudar el desplazamiento automático",
        "Sound on": "Sonido",
        "Sound off": "Silencio",
        "Sound (M)": "Sonido (M)",
        "Help": "Ayuda",
        "Close": "Cerrar",
        "Fullscreen": "Pantalla completa",
        "How the wall works": "Cómo funciona el muro",
        "Click a cover to play it. + on a cover adds it to the queue. The buttons in the bar pick a list, a country, a genre or a mood.": "Haz clic en una portada para reproducirla. El + de una portada la añade a la cola. Los botones de la barra eligen una lista, un país, un género o un ánimo.",
        "Touch": "Táctil",
        "Tap a cover to play it. The filters are under ⋯ in the top bar; Pause in the dock stops the wall.": "Toca una portada para reproducirla. Los filtros están en ⋯ de la barra superior; Pausar en la barra inferior detiene el muro.",
        "Pause or resume the wall": "Pausar o reanudar el muro",
        "Sound on or off": "Activar o silenciar el sonido",
        "Song list and search": "Lista de canciones y búsqueda",
        "Nothing loads from outside until you play a song. Then the video comes from YouTube (youtube-nocookie.com) and the lyrics from LRCLIB (lrclib.net).": "No se carga nada de fuera hasta que reproduces una canción. Entonces el video viene de YouTube (youtube-nocookie.com) y la letra de LRCLIB (lrclib.net).",
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
        'Lists and filters': 'Listas y filtros',
    },
    'pt-BR': {
        // Lists popup
        "Lists": "Listas",
        "Search lists…": "Buscar listas…",
        "No lists match": "Nenhuma lista encontrada",
        // Mascots / shuffle
        "Mascots": "Mascotes",
        "Mascot": "Mascote",
        "Dance": "Dança",
        "Random": "Aleatório",
        "Everyone": "Todos",
        "Song's genre": "Gênero da música",
        "Random moves": "Passos aleatórios",
        "Dances on the lyrics stage when a song has no lyrics.": "Dança no painel de letras quando a música não tem letra.",
        "Dances on the lyrics stage when a song has no lyrics, and beside the lyrics when it has them.": "Dança no painel de letras quando a música não tem letra, e ao lado da letra quando tem.",
        "All mascots at once when a song has no lyrics": "Todos os mascotes juntos quando a música não tem letra",
        "Shuffle": "Aleatório",
        "Shuffle on: no song repeats until the whole section has played": "Aleatório ligado: nenhuma música se repete até tocar a seção inteira",
        "Shuffle off": "Aleatório desligado",
        "See the dancing mascots and choose how they dance": "Veja os mascotes dançando e escolha como dançam",
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
        // Play controls + help overlay
        "Late shift.": "Turno da noite.",
        "More": "Mais",
        "Resume auto-scroll": "Retomar a rolagem automática",
        "Sound on": "Som",
        "Sound off": "Mudo",
        "Sound (M)": "Som (M)",
        "Help": "Ajuda",
        "Close": "Fechar",
        "Fullscreen": "Tela cheia",
        "How the wall works": "Como o mural funciona",
        "Click a cover to play it. + on a cover adds it to the queue. The buttons in the bar pick a list, a country, a genre or a mood.": "Clique numa capa para tocá-la. O + numa capa a adiciona à fila. Os botões da barra escolhem uma lista, um país, um gênero ou um clima.",
        "Touch": "Toque",
        "Tap a cover to play it. The filters are under ⋯ in the top bar; Pause in the dock stops the wall.": "Toque numa capa para tocá-la. Os filtros ficam em ⋯ na barra superior; Pausar na barra inferior para o mural.",
        "Pause or resume the wall": "Pausar ou retomar o mural",
        "Sound on or off": "Ligar ou desligar o som",
        "Song list and search": "Lista de músicas e busca",
        "Nothing loads from outside until you play a song. Then the video comes from YouTube (youtube-nocookie.com) and the lyrics from LRCLIB (lrclib.net).": "Nada é carregado de fora até você tocar uma música. Aí o vídeo vem do YouTube (youtube-nocookie.com) e a letra do LRCLIB (lrclib.net).",
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
        'Lists and filters': 'Listas e filtros',
    },
    ja: {
        // Lists popup
        "Lists": "リスト",
        "Search lists…": "リストを検索…",
        "No lists match": "一致するリストはありません",
        // Mascots / shuffle
        "Mascots": "マスコット",
        "Mascot": "マスコット",
        "Dance": "ダンス",
        "Random": "ランダム",
        "Everyone": "みんな",
        "Song's genre": "曲のジャンル",
        "Random moves": "ランダムな動き",
        "Dances on the lyrics stage when a song has no lyrics.": "歌詞のない曲では歌詞ステージで踊ります。",
        "Dances on the lyrics stage when a song has no lyrics, and beside the lyrics when it has them.": "歌詞のない曲では歌詞ステージで、歌詞のある曲では歌詞の横で踊ります。",
        "All mascots at once when a song has no lyrics": "歌詞のない曲ではマスコット全員で踊ります",
        "Shuffle": "シャッフル",
        "Shuffle on: no song repeats until the whole section has played": "シャッフルオン：セクションの全曲を再生するまで同じ曲は流れません",
        "Shuffle off": "シャッフルオフ",
        "See the dancing mascots and choose how they dance": "踊るマスコットを見て、踊り方を選びます",
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
        // Play controls + help overlay
        "Late shift.": "夜勤お疲れさま。",
        "More": "その他",
        "Resume auto-scroll": "自動スクロールを再開",
        "Sound on": "音あり",
        "Sound off": "消音",
        "Sound (M)": "音 (M)",
        "Help": "ヘルプ",
        "Close": "閉じる",
        "Fullscreen": "全画面",
        "How the wall works": "ウォールの使い方",
        "Click a cover to play it. + on a cover adds it to the queue. The buttons in the bar pick a list, a country, a genre or a mood.": "ジャケットをクリックすると再生します。ジャケットの + でキューに追加。バーのボタンでリスト、国、ジャンル、ムードを選べます。",
        "Touch": "タッチ",
        "Tap a cover to play it. The filters are under ⋯ in the top bar; Pause in the dock stops the wall.": "ジャケットをタップすると再生します。フィルターは上のバーの ⋯ にあります。下のバーの一時停止でウォールが止まります。",
        "Pause or resume the wall": "ウォールを一時停止／再開",
        "Sound on or off": "音のオン／オフ",
        "Song list and search": "曲リストと検索",
        "Nothing loads from outside until you play a song. Then the video comes from YouTube (youtube-nocookie.com) and the lyrics from LRCLIB (lrclib.net).": "曲を再生するまで外部からは何も読み込みません。再生すると動画は YouTube (youtube-nocookie.com) から、歌詞は LRCLIB (lrclib.net) から読み込みます。",
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
        'Lists and filters': 'リストと絞り込み',
    },
    ru: {
        // Lists popup
        "Lists": "Списки",
        "Search lists…": "Поиск списков…",
        "No lists match": "Нет подходящих списков",
        // Mascots / shuffle
        "Mascots": "Маскоты",
        "Mascot": "Маскот",
        "Dance": "Танец",
        "Random": "Случайно",
        "Everyone": "Все",
        "Song's genre": "Жанр песни",
        "Random moves": "Случайные движения",
        "Dances on the lyrics stage when a song has no lyrics.": "Танцует на панели текста, когда у песни нет текста.",
        "Dances on the lyrics stage when a song has no lyrics, and beside the lyrics when it has them.": "Танцует на панели текста, когда у песни нет текста, и рядом с текстом, когда он есть.",
        "All mascots at once when a song has no lyrics": "Все маскоты сразу, когда у песни нет текста",
        "Shuffle": "Перемешать",
        "Shuffle on: no song repeats until the whole section has played": "Перемешивание включено: песни не повторяются, пока не прозвучит весь раздел",
        "Shuffle off": "Перемешивание выключено",
        "See the dancing mascots and choose how they dance": "Посмотрите на танцующих маскотов и выберите, как они танцуют",
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
        // Play controls + help overlay
        "Late shift.": "Ночная смена.",
        "More": "Ещё",
        "Resume auto-scroll": "Продолжить автопрокрутку",
        "Sound on": "Звук",
        "Sound off": "Без звука",
        "Sound (M)": "Звук (M)",
        "Help": "Справка",
        "Close": "Закрыть",
        "Fullscreen": "Полный экран",
        "How the wall works": "Как устроена стена",
        "Click a cover to play it. + on a cover adds it to the queue. The buttons in the bar pick a list, a country, a genre or a mood.": "Нажмите на обложку, чтобы включить песню. + на обложке добавляет её в очередь. Кнопки на панели выбирают список, страну, жанр или настроение.",
        "Touch": "Касание",
        "Tap a cover to play it. The filters are under ⋯ in the top bar; Pause in the dock stops the wall.": "Коснитесь обложки, чтобы включить песню. Фильтры — под ⋯ в верхней панели; «Пауза» внизу останавливает стену.",
        "Pause or resume the wall": "Пауза или продолжение стены",
        "Sound on or off": "Включить или выключить звук",
        "Song list and search": "Список песен и поиск",
        "Nothing loads from outside until you play a song. Then the video comes from YouTube (youtube-nocookie.com) and the lyrics from LRCLIB (lrclib.net).": "Пока вы не включите песню, извне ничего не загружается. Затем видео загружается с YouTube (youtube-nocookie.com), а текст — с LRCLIB (lrclib.net).",
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
        'Lists and filters': 'Списки и фильтры',
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
    ['#helpBtn',        'title', 'Help'],
    ['#helpBtn',        'aria-label', 'Help'],
    ['#helpX',          'aria-label', 'Close'],
    ['#muteBtn',        'title', 'Sound (M)'],
    ['#queueBar',       'title', 'Queue'],
    ['#sectionFilters', 'aria-label', 'Lists and filters'],
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
        const paused = scrollBtn.classList.contains('paused');
        scrollBtn.textContent = paused ? t('Resume') : t('Pause');
        scrollBtn.title = paused ? t('Resume auto-scroll') : t('Pause auto-scroll');
    }
    const muteBtn = document.getElementById('muteBtn');
    if (muteBtn) {
        muteBtn.textContent = muteBtn.getAttribute('aria-pressed') === 'true' ? t('Sound off') : t('Sound on');
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
