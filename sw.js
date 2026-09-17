/*
 * W.TRACKS — SERVICE WORKER
 * PWA PC
 *
 * Sistema de cache com atualização automática.
 *
 * OBJETIVOS:
 * - Não precisar apagar cache manualmente.
 * - Buscar versões novas dos arquivos automaticamente.
 * - Manter o aplicativo rápido.
 * - Atualizar JS/CSS/HTML em segundo plano.
 * - Ativar novas versões do Service Worker imediatamente.
 *
 * NÃO armazena:
 * - Firebase Auth
 * - Firestore privado
 * - tokens
 * - arquivos R2 privados
 * - uploads
 * - downloads de áudio
 * - dados do usuário
 * - IndexedDB
 * - arquivos de áudio
 */

const CACHE_VERSION = 'wtracks-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

/*
 * Arquivos principais conhecidos da aplicação.
 *
 * O cache inicial é preparado individualmente.
 * Se algum arquivo não existir, isso NÃO impede
 * o Service Worker de ser instalado.
 */
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './manifest-mobile.json',

    './styles.css',
    './styles_3.css',
    './mobile.css',
    './tablet.css',

    './app.js',
    './player.js',
    './storage.js',
    './audiostorage.js',
    './trackhydrator.js',
    './setlists.js',
    './planSystem.js',
    './planUtils.js',
    './communitytracks.js',
    './pwa.js',
    './mobile.js',

    './icon-black-transparent.png',
    './icon-white-transparent.png'
];

/* ============================================================
   FUNÇÕES AUXILIARES
   ============================================================ */

/*
 * Arquivos que podem ser atualizados automaticamente.
 *
 * Não usamos cache para APIs, uploads, downloads,
 * Firebase, R2 ou dados privados.
 */
function isStaticAsset(url) {
    const pathname = url.pathname.toLowerCase();

    return (
        pathname.endsWith('.html') ||
        pathname.endsWith('.js') ||
        pathname.endsWith('.css') ||
        pathname.endsWith('.svg') ||
        pathname.endsWith('.png') ||
        pathname.endsWith('.jpg') ||
        pathname.endsWith('.jpeg') ||
        pathname.endsWith('.webp') ||
        pathname.endsWith('.ico') ||
        pathname.endsWith('.woff') ||
        pathname.endsWith('.woff2') ||
        pathname.endsWith('/manifest.json')
    );
}

/*
 * Arquivos que NUNCA devem passar pelo cache.
 */
function isBlockedRequest(url) {
    const pathname = url.pathname.toLowerCase();

    /*
     * Áudio e arquivos potencialmente grandes.
     */
    const blockedExtensions = [
        '.mp3',
        '.wav',
        '.ogg',
        '.m4a',
        '.aac',
        '.flac',
        '.webm',
        '.mp4',
        '.mov',
        '.avi',
        '.mkv',
        '.zip',
        '.rar',
        '.7z'
    ];

    if (
        blockedExtensions.some(extension =>
            pathname.endsWith(extension)
        )
    ) {
        return true;
    }

    /*
     * APIs / uploads / downloads / workers.
     */
    const blockedPaths = [
        '/api/',
        '/upload',
        '/uploads/',
        '/download',
        '/downloads/',
        '/worker/',
        '/workers/',
        '/firebase/',
        '/firestore/',
        '/r2/',
        '/storage/'
    ];

    if (
        blockedPaths.some(path =>
            pathname.includes(path)
        )
    ) {
        return true;
    }

    return false;
}

/*
 * Salva somente respostas válidas.
 */
async function cacheResponse(request, response) {
    if (!response || !response.ok) {
        return response;
    }

    try {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, response.clone());
    } catch (error) {
        console.warn(
            '[W.Tracks PWA] Não foi possível atualizar o cache:',
            error
        );
    }

    return response;
}

/* ============================================================
   INSTALL
   ============================================================ */

self.addEventListener('install', event => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(STATIC_CACHE);

            /*
             * Adiciona os arquivos individualmente.
             *
             * Assim, se um arquivo não existir,
             * os outros continuam sendo armazenados.
             */
            await Promise.all(
                STATIC_ASSETS.map(async asset => {
                    try {
                        const request = new Request(asset, {
                            cache: 'no-cache'
                        });

                        const response = await fetch(request);

                        if (response.ok) {
                            await cache.put(
                                request,
                                response.clone()
                            );
                        }
                    } catch (error) {
                        console.warn(
                            `[W.Tracks PWA] Não foi possível preparar: ${asset}`
                        );
                    }
                })
            );

            /*
             * Ativa imediatamente a nova versão.
             */
            await self.skipWaiting();
        })()
    );
});

/* ============================================================
   ACTIVATE
   ============================================================ */

self.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();

            /*
             * Remove SOMENTE versões antigas do cache
             * do próprio W.Tracks.
             *
             * Não mexe em IndexedDB ou localStorage.
             */
            await Promise.all(
                cacheNames
                    .filter(cacheName => {
                        return (
                            (cacheName.startsWith('wtracks-') || cacheName.startsWith('wtracks-pc-')) &&
                            cacheName !== STATIC_CACHE
                        );
                    })
                    .map(cacheName =>
                        caches.delete(cacheName)
                    )
            );

            /*
             * Faz a nova versão controlar as páginas
             * imediatamente.
             */
            await self.clients.claim();

            console.info(
                '[W.Tracks PWA] Nova versão ativada:',
                CACHE_VERSION
            );
        })()
    );
});

/* ============================================================
   FETCH
   ============================================================ */

self.addEventListener('fetch', event => {
    const request = event.request;

    /*
     * Somente GET.
     */
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);

    /*
     * Nunca interceptar recursos externos.
     *
     * Isso evita interferência em:
     * Firebase
     * Google
     * R2
     * APIs externas
     * CDNs externas
     */
    if (url.origin !== self.location.origin) {
        return;
    }

    /*
     * Nunca armazenar áudio, arquivos grandes,
     * uploads, downloads ou endpoints dinâmicos.
     */
    if (isBlockedRequest(url)) {
        return;
    }

    /*
     * Só trabalhamos com recursos estáticos conhecidos.
     *
     * Outros requests continuam normalmente pela rede.
     */
    if (!isStaticAsset(url)) {
        return;
    }

    /*
     * ========================================================
     * HTML / JS / CSS
     * ========================================================
     *
     * NETWORK FIRST
     *
     * 1. Busca a versão atual na rede.
     * 2. Atualiza o cache automaticamente.
     * 3. Se estiver offline, usa o cache.
     *
     * Isso evita que alterações no código fiquem presas
     * na versão antiga do cache.
     */
    event.respondWith(
        (async () => {
            try {
                const networkResponse = await fetch(
                    new Request(request, {
                        cache: 'no-cache'
                    })
                );

                if (networkResponse.ok) {
                    await cacheResponse(
                        request,
                        networkResponse
                    );
                }

                return networkResponse;
            } catch (error) {
                /*
                 * Sem internet:
                 * tenta usar a versão armazenada.
                 */
                const cachedResponse =
                    await caches.match(request);

                if (cachedResponse) {
                    return cachedResponse;
                }

                /*
                 * Se for navegação e o arquivo específico
                 * não estiver no cache, tenta index.html.
                 */
                if (request.mode === 'navigate') {
                    const fallback =
                        await caches.match('./index.html');

                    if (fallback) {
                        return fallback;
                    }
                }

                return Response.error();
            }
        })()
    );
});

/* ============================================================
   MENSAGENS
   ============================================================ */

self.addEventListener('message', event => {
    if (!event.data) {
        return;
    }

    /*
     * Permite que o pwa.js ou o próprio site
     * mande o Service Worker ativar imediatamente.
     */
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    /*
     * Permite solicitar uma verificação de atualização.
     */
    if (event.data.type === 'CLEAR_OLD_CACHES') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName =>
                            (cacheName.startsWith('wtracks-') || cacheName.startsWith('wtracks-pc-')) &&
                            cacheName !== STATIC_CACHE
                        )
                        .map(cacheName =>
                            caches.delete(cacheName)
                        )
                );
            })
        );
    }
});