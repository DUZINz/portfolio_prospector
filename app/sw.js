/*
 * Service worker do painel (/app). Existe por dois motivos: deixar o app abrir
 * offline depois da 1a visita e satisfazer o criterio de instalacao do Chrome
 * ("Adicionar a tela inicial" com icone de app).
 *
 * Escopo preso em /app/: o portfolio publico ao lado nao passa por aqui.
 */

const CACHE = "prospector-v1";

const ARQUIVOS = [
  "/app/",
  "/app/index.html",
  "/app/app.css",
  "/app/app.js",
  "/app/manifest.webmanifest",
  "/app/icone-192.png",
  "/app/icone-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/*
 * Rede primeiro, cache como rede de seguranca. O contrario (cache primeiro) e
 * mais rapido, mas deixaria uma versao antiga do painel grudada no celular
 * depois de cada deploy — o tipo de bug que so aparece no aparelho do dono.
 */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Fonte do Google e outros hosts: deixa o navegador cuidar.
  if (new URL(e.request.url).origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return resposta;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("/app/")))
  );
});
