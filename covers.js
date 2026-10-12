// Lê PDF, EPUB e imagens no próprio aparelho e extrai capa, título, autor e nº de páginas.
// Nada é enviado a terceiros: o arquivo só vai para o seu Supabase (se você estiver logado).

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const COVER_W = 420;

const loaded = {};
function loadScript(src) {
  if (loaded[src]) return loaded[src];
  loaded[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => { delete loaded[src]; reject(new Error('Não foi possível carregar a biblioteca (verifique a internet).')); };
    document.head.append(s);
  });
  return loaded[src];
}

export const kindOf = (file) => {
  const n = file.name.toLowerCase();
  if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (file.type === 'application/epub+zip' || n.endsWith('.epub')) return 'epub';
  if (file.type.startsWith('image/')) return 'image';
  return null;
};
const cleanName = (name) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();

async function downscale(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Imagem inválida')); i.src = url; });
    const scale = Math.min(1, COVER_W / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

async function fromPdf(file) {
  await loadScript(PDFJS);
  const lib = window.pdfjsLib;
  if (!lib.GlobalWorkerOptions.workerSrc) {
    const code = await (await fetch(PDFJS_WORKER)).text();
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  let title = '', author = '';
  try { const m = await pdf.getMetadata(); title = (m.info.Title || '').trim(); author = (m.info.Author || '').trim(); } catch { /* sem metadados */ }
  const page = await pdf.getPage(1);
  const vp1 = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: COVER_W / vp1.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { title, author, pages: pdf.numPages, cover: canvas.toDataURL('image/jpeg', 0.82) };
}

const dirname = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
function resolvePath(base, href) {
  const parts = (base + decodeURIComponent(href.split('#')[0])).split('/');
  const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
}

async function fromEpub(file) {
  await loadScript(JSZIP);
  const zip = await window.JSZip.loadAsync(file);
  const read = (p) => zip.file(p) ? zip.file(p).async('string') : Promise.resolve(null);
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');

  const container = xml(await read('META-INF/container.xml'));
  const opfPath = container.querySelector('rootfile').getAttribute('full-path');
  const opf = xml(await read(opfPath));
  const base = dirname(opfPath);
  const text = (sel) => { const e = opf.querySelector(sel); return e ? e.textContent.trim() : ''; };
  const title = text('metadata > title, metadata > *|title');
  const author = text('metadata > creator, metadata > *|creator');

  const items = [...opf.querySelectorAll('manifest > item')];
  let item = items.find((i) => (i.getAttribute('properties') || '').split(/\s+/).includes('cover-image'));
  if (!item) {
    const meta = opf.querySelector('metadata > meta[name="cover"]');
    if (meta) item = items.find((i) => i.getAttribute('id') === meta.getAttribute('content'));
  }
  if (!item) item = items.find((i) => /cover/i.test(i.getAttribute('id') || '') && (i.getAttribute('media-type') || '').startsWith('image/'));
  if (!item) item = items.find((i) => /cover/i.test(i.getAttribute('href') || '') && (i.getAttribute('media-type') || '').startsWith('image/'));

  let cover = null;
  if (item && (item.getAttribute('media-type') || '').startsWith('image/')) {
    const f = zip.file(resolvePath(base, item.getAttribute('href')));
    if (f) cover = await downscale(await f.async('blob'));
  }
  return { title, author, pages: null, cover };
}

/** Lê um arquivo e devolve { kind, title, author, pages, cover }. Nunca lança por falta de capa. */
export async function readBookFile(file) {
  const kind = kindOf(file);
  if (!kind) throw new Error('Formato não suportado. Use PDF, EPUB ou uma imagem.');
  let info = { title: '', author: '', pages: null, cover: null };
  try {
    if (kind === 'pdf') info = await fromPdf(file);
    else if (kind === 'epub') info = await fromEpub(file);
    else info.cover = await downscale(file);
  } catch (e) {
    console.warn('Falha ao ler arquivo', e);
    info.error = e.message;
  }
  if (!info.title && kind !== 'image') info.title = cleanName(file.name);
  return { kind, ...info };
}
