const CACHE_NAME = "Cosmic-Book-v4";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./livros.html",
  "./roleta.html",
  "./manifest.json",
  "./icone.png", // Mudado aqui!
  "./offline.html" 
];

// 1. Instalação: Salva os arquivos no cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching app shell...");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting(); // Força o novo SW a se tornar o ativo imediatamente
});

// 2. Ativação: Limpa caches antigos (importante para o v4 substituir o v3)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Removendo cache antigo:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim(); // Faz o SW assumir o controle das abas abertas imediatamente
});

// 3. Estratégia Fetch: Tenta a rede, se falhar (offline), usa o cache
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Se a rede falhar e não estiver no cache, mostra a página offline
        if (event.request.mode === 'navigate') {
          return caches.match("./offline.html");
        }
      });
    })
  );
});