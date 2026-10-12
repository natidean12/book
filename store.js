// Camada de dados: guarda tudo no aparelho (IndexedDB) e sincroniza com o Supabase quando há login.
// Modelo: uma tabela genérica de "registros" (kind + year + data JSON). Última edição vence.
import { CONFIG } from './config.js';

const listeners = new Set();
const cache = new Map();
let db = null;
let meta = {};
let sb = null;
let session = null;
let syncing = false;
let syncTimer = null;
let status = { configured: false, user: null, state: 'local', message: 'Salvo só neste aparelho', last: null };

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (type = 'data') => listeners.forEach((fn) => { try { fn(type); } catch (e) { console.error(e); } });
export const getStatus = () => status;
function setStatus(patch) { status = { ...status, ...patch }; emit('status'); }

/* ---------- IndexedDB ---------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('cosmic-bloom', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('records', { keyPath: 'id' });
      d.createObjectStore('files', { keyPath: 'id' });
      d.createObjectStore('meta', { keyPath: 'k' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function run(store, mode, fn) {
  if (!db) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const persist = (rec) => run('records', 'readwrite', (s) => s.put(rec)).catch((e) => console.error('IDB', e));
const setMeta = (k, v) => { meta[k] = v; return run('meta', 'readwrite', (s) => s.put({ k, v })).catch(() => {}); };

export async function init() {
  try {
    db = await openDB();
    const recs = await run('records', 'readonly', (s) => s.getAll());
    (recs || []).forEach((r) => cache.set(r.id, r));
    const ms = await run('meta', 'readonly', (s) => s.getAll());
    (ms || []).forEach((m) => { meta[m.k] = m.v; });
  } catch (e) {
    console.warn('IndexedDB indisponível; usando memória.', e);
    setStatus({ message: 'Armazenamento do navegador indisponível' });
  }
  await initAuth();
}

/* ---------- CRUD ---------- */
export const list = (kind, year) => [...cache.values()].filter((r) => !r.deleted && r.kind === kind && (year === undefined || r.year === year));
export const get = (id) => { const r = cache.get(id); return r && !r.deleted ? r : null; };
export const getData = (id, fallback = null) => { const r = get(id); return r ? r.data : fallback; };

export async function save(kind, id, data, year = null) {
  const rec = { id: id || uid(), kind, year, data, updated_at: Date.now(), deleted: false, dirty: true };
  cache.set(rec.id, rec);
  await persist(rec);
  emit(); scheduleSync();
  return rec;
}
export async function patch(id, fn, newYear) {
  const r = get(id);
  if (!r) return null;
  const data = structuredClone(r.data);
  const out = fn(data) || data;
  return save(r.kind, id, out, newYear === undefined ? r.year : newYear);
}
export async function remove(id) {
  const r = cache.get(id);
  if (!r) return;
  const rec = { ...r, deleted: true, data: {}, updated_at: Date.now(), dirty: true };
  cache.set(id, rec);
  await persist(rec);
  emit(); scheduleSync();
}
export function years() {
  const ys = new Set();
  cache.forEach((r) => { if (!r.deleted && r.year) ys.add(r.year); });
  return [...ys].sort((a, b) => b - a);
}

/* ---------- arquivos (PDF/EPUB) ---------- */
export async function putFile(file) {
  const id = uid();
  await run('files', 'readwrite', (s) => s.put({ id, blob: file, name: file.name, type: file.type }));
  return id;
}
export async function fileUrl(book) {
  if (book.fileId) {
    const f = await run('files', 'readonly', (s) => s.get(book.fileId));
    if (f && f.blob) return URL.createObjectURL(f.blob);
  }
  if (book.filePath && sb && session) {
    const { data, error } = await sb.storage.from('books').createSignedUrl(book.filePath, 3600);
    if (!error) return data.signedUrl;
  }
  return null;
}
async function uploadPendingFiles() {
  const uidUser = session.user.id;
  for (const r of list('book')) {
    const b = r.data;
    if (!b.fileId || b.filePath) continue;
    const f = await run('files', 'readonly', (s) => s.get(b.fileId));
    if (!f) continue;
    const ext = (f.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${uidUser}/${b.fileId}.${ext}`;
    const { error } = await sb.storage.from('books').upload(path, f.blob, { upsert: true, contentType: f.type || undefined });
    if (error) { console.warn('upload', error.message); continue; }
    await patch(r.id, (d) => { d.filePath = path; });
  }
}

/* ---------- autenticação ---------- */
async function initAuth() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) return;
  status.configured = true;
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
    });
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (new URL(location.href).searchParams.has('code')) history.replaceState(null, '', location.pathname + location.hash);
    sb.auth.onAuthStateChange((_e, s) => {
      session = s;
      applyAuthStatus();
      if (s) sync();
    });
    applyAuthStatus();
    if (session) sync();
    window.addEventListener('online', () => sync());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  } catch (e) {
    console.warn('Supabase indisponível', e);
    setStatus({ configured: true, state: 'err', message: 'Sem conexão com o servidor — salvo neste aparelho' });
  }
}
function applyAuthStatus() {
  if (session) setStatus({ configured: true, user: session.user, state: 'ok', message: 'Conectado' });
  else setStatus({ configured: true, user: null, state: 'local', message: 'Entre com Google para sincronizar' });
}
export const signIn = () => sb && sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
export async function signOut() { if (sb) await sb.auth.signOut(); }

/* ---------- sincronização ---------- */
function scheduleSync() {
  if (!sb || !session) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(sync, 1200);
}

export async function sync() {
  if (!sb || !session || syncing) return;
  if (!navigator.onLine) { setStatus({ state: 'err', message: 'Offline — vai sincronizar quando voltar' }); return; }
  syncing = true;
  setStatus({ state: 'busy', message: 'Sincronizando…' });
  try {
    await uploadPendingFiles();

    // 1) enviar o que mudou aqui
    const dirty = [...cache.values()].filter((r) => r.dirty);
    for (let i = 0; i < dirty.length; i += 200) {
      const chunk = dirty.slice(i, i + 200);
      const rows = chunk.map((r) => ({
        user_id: session.user.id, id: r.id, kind: r.kind, year: r.year, data: r.data,
        deleted: !!r.deleted, updated_at: new Date(r.updated_at).toISOString(),
      }));
      const { error } = await sb.from('records').upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
      for (const r of chunk) {
        const cur = cache.get(r.id);
        if (cur && cur.updated_at === r.updated_at) { cur.dirty = false; await persist(cur); }
      }
    }

    // 2) trazer o que mudou em outros aparelhos
    const since = meta.lastPull || '1970-01-01T00:00:00Z';
    let from = 0, maxSeen = since, changed = false;
    for (;;) {
      const { data, error } = await sb.from('records').select('*').gt('synced_at', since)
        .order('synced_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999);
      if (error) throw error;
      for (const row of data) {
        if (row.synced_at > maxSeen) maxSeen = row.synced_at;
        const local = cache.get(row.id);
        const remoteTime = Date.parse(row.updated_at);
        if (local && (local.dirty || local.updated_at >= remoteTime)) continue;
        const rec = { id: row.id, kind: row.kind, year: row.year, data: row.data, deleted: row.deleted, updated_at: remoteTime, dirty: false };
        cache.set(rec.id, rec);
        await persist(rec);
        changed = true;
      }
      if (data.length < 1000) break;
      from += 1000;
    }
    await setMeta('lastPull', maxSeen);
    setStatus({ state: 'ok', message: 'Tudo sincronizado', last: Date.now() });
    if (changed) emit();
  } catch (e) {
    console.error('sync', e);
    setStatus({ state: 'err', message: 'Falha ao sincronizar: ' + (e.message || e) });
  } finally {
    syncing = false;
  }
}

/* ---------- backup ---------- */
export function exportAll() {
  return JSON.stringify({ app: 'cosmic-bloom', version: 1, exported: new Date().toISOString(), records: [...cache.values()].filter((r) => !r.deleted).map(({ dirty, ...r }) => r) }, null, 1);
}
export async function importAll(text) {
  const obj = JSON.parse(text);
  if (obj.app !== 'cosmic-bloom' || !Array.isArray(obj.records)) throw new Error('Arquivo de backup inválido');
  for (const r of obj.records) {
    const rec = { ...r, updated_at: Date.now(), dirty: true, deleted: false };
    cache.set(rec.id, rec);
    await persist(rec);
  }
  emit(); scheduleSync();
  return obj.records.length;
}
