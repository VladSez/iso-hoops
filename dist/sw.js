// Keeps the game playable offline: every file the page needs is saved on the first visit.
//
// FILES must list exactly what index.html and its modules load, with the same ?v= strings;
// test/offline.test.js checks this. Any edit to this file makes browsers install it again,
// which downloads every file fresh, so bump VERSION when a file changes without its URL
// changing (index.html, the icons).
const VERSION = 2
const FILES = [
	'./',
	'style.css?v=a7c3e09d5f14',
	'engine.js?v=5b7e2a91',
	'game.js?v=0c5e9b27',
	'physics.js?v=3',
	'free-throws.js?v=5',
	'beat-the-clock.js?v=2',
	'horse.js?v=2',
	'music.js?v=2',
	'courts.js?v=4',
	'favicon.ico',
	'favicon.svg',
	'apple-touch-icon.png',
	'manifest.webmanifest',
	'icon-192.png',
	'icon-512.png',
]

const SCOPE = self.registration.scope
// Caches are shared by the whole origin, and PR previews live under this scope
// (pr-preview/pr-N/) with their own worker, so name the cache after the scope.
const CACHE = `${SCOPE} offline`
const URLS = new Set(FILES.map(file => new URL(file, SCOPE).href))
const PAGE_URLS = new Set([SCOPE, new URL('index.html', SCOPE).href])

self.addEventListener('install', event => {
	// cache: 'reload' skips the HTTP cache, so files that keep their URL arrive fresh.
	const requests = [...URLS].map(url => new Request(url, { cache: 'reload' }))
	event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
	event.waitUntil(removeStaleFiles().then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
	const url = new URL(event.request.url)
	url.hash = ''

	// The page itself comes from the network when there is one, so a new deploy shows up
	// right away, and from the cache when offline.
	if (event.request.mode === 'navigate' && PAGE_URLS.has(url.origin + url.pathname)) {
		event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match(SCOPE))))
		return
	}

	// Everything else in FILES is versioned by its URL, so the saved copy is always right.
	// Requests outside FILES, including PR previews, go to the network untouched.
	if (URLS.has(url.href)) {
		event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request)).then(saved => saved ?? fetch(event.request)))
	}
})

// Drops files from older versions, such as a game.js with a previous ?v=.
async function removeStaleFiles() {
	const cache = await caches.open(CACHE)
	for (const request of await cache.keys()) {
		if (!URLS.has(request.url)) await cache.delete(request)
	}
}
