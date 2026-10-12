// Peças compartilhadas por várias telas: formulário de livro, detalhe, registro de leitura e seletor de livro.
import * as store from './store.js';
import { readBookFile } from './covers.js';
import { h, icon, stars, starInput, field, coverEl, openSheet, confirmDialog, toast, today, fmtDate, parts } from './ui.js';

export const STATUS = { lido: 'Lido', lendo: 'Lendo', quero: 'Quero ler', abandonado: 'Abandonado' };

export const allBooks = () => store.list('book');
export const booksOfYear = (year) => store.list('book', year);
export const bookById = (id) => (id ? store.get(id) : null);
export const yearOfDate = (s) => parts(s).y;

/* ---------- formulário (novo / editar) ---------- */
export function bookSheet({ year, rec, defaults = {}, onSaved }) {
  const b = rec
    ? structuredClone(rec.data)
    : { title: '', author: '', status: 'quero', pages: null, rating: 0, startDate: '', endDate: '', genre: '', review: '', favorite: false, cover: null, log: [], pagesRead: 0, ...defaults };
  let pending = null; // arquivo PDF/EPUB escolhido agora

  const coverBox = h('div', { style: { width: '92px', flex: 'none' } });
  const drawCover = () => { coverBox.innerHTML = ''; coverBox.append(coverEl(b)); };
  drawCover();

  const dropMsg = h('span', {}, 'Toque para enviar PDF, EPUB ou foto da capa');
  const fileInput = h('input', { type: 'file', accept: '.pdf,.epub,application/pdf,application/epub+zip,image/*', class: 'hidden' });
  const drop = h('div', { class: 'drop', onclick: () => fileInput.click() }, icon('upload', 24), dropMsg,
    h('small', {}, 'A capa, o título e o autor são lidos do arquivo automaticamente.'));
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); fileInput.value = ''; });

  const title = h('input', { type: 'text', value: b.title, placeholder: 'Título do livro', autocomplete: 'off' });
  const author = h('input', { type: 'text', value: b.author, placeholder: 'Autor(a)', autocomplete: 'off' });
  const pages = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: b.pages || '' });
  const genre = h('input', { type: 'text', value: b.genre, placeholder: 'Ex.: Romance, Fantasia…' });
  const status = h('select', { value: b.status }, Object.entries(STATUS).map(([k, v]) => h('option', { value: k }, v)));
  const start = h('input', { type: 'date', value: b.startDate });
  const end = h('input', { type: 'date', value: b.endDate });
  const review = h('textarea', { placeholder: 'O que você achou? Frases favoritas, sentimentos…' }, b.review);
  review.value = b.review;
  const fav = h('input', { type: 'checkbox', checked: !!b.favorite, style: { width: '20px', height: '20px', accentColor: 'var(--accent)' } });

  async function handleFile(file) {
    dropMsg.textContent = 'Lendo arquivo…';
    try {
      const info = await readBookFile(file);
      if (info.cover) b.cover = info.cover;
      if (info.kind !== 'image') {
        pending = { file, kind: info.kind };
        if (info.title && !title.value.trim()) title.value = info.title;
        if (info.author && !author.value.trim()) author.value = info.author;
        if (info.pages && !pages.value) pages.value = info.pages;
        dropMsg.textContent = `${file.name} — ${info.cover ? 'capa extraída ✓' : 'sem capa no arquivo (envie uma foto)'}`;
      } else {
        dropMsg.textContent = 'Capa atualizada ✓';
      }
      if (info.error) toast('Li o arquivo, mas houve um problema: ' + info.error);
      b.title = title.value;
      drawCover();
    } catch (e) {
      dropMsg.textContent = 'Toque para enviar PDF, EPUB ou foto da capa';
      toast(e.message);
    }
  }

  const rate = starInput(b.rating, (v) => { b.rating = v; });
  const body = h('div', { class: 'grid', style: { gap: '16px' } },
    h('div', { style: { display: 'flex', gap: '16px', alignItems: 'flex-start' } }, coverBox, h('div', { style: { flex: 1 } }, drop, fileInput)),
    h('div', { class: 'form-grid' },
      field('Título *', title, 'full'),
      field('Autor(a)', author),
      field('Gênero', genre),
      field('Status', status),
      field('Páginas', pages),
      field('Início da leitura', start),
      field('Fim da leitura', end),
      field('Nota', rate, 'full'),
      field('Resenha / anotações', review, 'full'),
      h('label', { class: 'field full', style: { flexDirection: 'row', alignItems: 'center', gap: '10px' } }, fav, 'Marcar como favorito')));

  const sheet = openSheet({
    title: rec ? 'Editar livro' : 'Novo livro',
    body,
    foot: [
      h('button', { class: 'btn', onclick: () => sheet.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: save }, 'Salvar'),
    ],
  });

  async function save() {
    if (!title.value.trim()) { toast('Dê um título ao livro'); title.focus(); return; }
    const d = {
      ...b, title: title.value.trim(), author: author.value.trim(), genre: genre.value.trim(), status: status.value,
      pages: Number(pages.value) || null, startDate: start.value, endDate: end.value, review: review.value.trim(), favorite: fav.checked,
    };
    if (d.status === 'lido' && !d.endDate) d.endDate = today();
    if (d.status === 'lendo' && !d.startDate) d.startDate = today();
    if (pending) {
      d.fileId = await store.putFile(pending.file);
      d.fileName = pending.file.name; d.fileType = pending.kind; d.filePath = null;
    }
    let y = rec ? rec.year : year;
    if (d.endDate && d.status === 'lido') y = yearOfDate(d.endDate);
    const saved = await store.save('book', rec ? rec.id : null, d, y);
    sheet.close();
    toast(rec ? 'Livro atualizado' : 'Livro adicionado');
    if (onSaved) onSaved(saved);
  }
  return sheet;
}

/* ---------- abrir arquivo ---------- */
export async function openBookFile(b) {
  const w = window.open('', '_blank');
  const url = await store.fileUrl(b);
  if (!url) {
    if (w) w.close();
    toast('Arquivo indisponível neste aparelho. Entre com Google no aparelho de origem e sincronize.');
    return;
  }
  if (w) w.location.href = url; else location.href = url;
}

/* ---------- registro de leitura ---------- */
export function logSheet(rec, after, presetDate) {
  const b = rec.data;
  const date = h('input', { type: 'date', value: presetDate || today() });
  const pg = h('input', { type: 'number', min: 1, inputmode: 'numeric', placeholder: 'Ex.: 30' });
  const note = h('input', { type: 'text', placeholder: 'Anotação (opcional)' });
  const left = b.pages ? Math.max(0, b.pages - (b.pagesRead || 0)) : null;
  const sheet = openSheet({
    title: 'Registrar leitura',
    body: h('div', { class: 'grid' },
      h('p', { class: 'muted', style: { margin: 0 } }, b.title + (left != null ? ` — faltam ${left} páginas` : '')),
      h('div', { class: 'form-grid' }, field('Dia', date), field('Páginas lidas', pg), field('Nota', note, 'full'))),
    foot: [
      h('button', { class: 'btn', onclick: () => sheet.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => {
        const n = Number(pg.value);
        if (!n || n < 1) { toast('Informe quantas páginas você leu'); return; }
        const updated = await store.patch(rec.id, (d) => {
          d.log = [...(d.log || []), { date: date.value || today(), pages: n, note: note.value.trim() }];
          d.pagesRead = d.log.reduce((s, l) => s + l.pages, 0);
          if (d.status === 'quero') { d.status = 'lendo'; d.startDate = d.startDate || date.value; }
        });
        sheet.close();
        toast('Leitura registrada');
        if (after) after(updated);
        if (updated.data.pages && updated.data.status !== 'lido' && updated.data.pagesRead >= updated.data.pages) {
          if (await confirmDialog('Você chegou ao fim do livro. Marcar como lido?', 'Marcar como lido')) finishBook(updated);
        }
      } }, 'Salvar'),
    ],
  });
}

export async function finishBook(rec) {
  const end = today();
  const updated = await store.patch(rec.id, (d) => { d.status = 'lido'; d.endDate = d.endDate || end; }, yearOfDate(rec.data.endDate || end));
  toast('Livro concluído! Dê uma nota 💛');
  bookSheet({ rec: updated });
}

/* ---------- detalhe ---------- */
export function bookDetail(recIn) {
  let rec = recIn;
  const body = h('div');
  const sheet = openSheet({ title: 'Livro', body, wide: false, onClose: () => unsub() });
  const unsub = store.onChange(() => { const r = store.get(rec.id); if (!r) { sheet.close(); return; } rec = r; draw(); });

  function draw() {
    const b = rec.data;
    body.innerHTML = '';
    const info = [];
    if (b.pages) info.push(`${b.pages} páginas`);
    if (b.genre) info.push(b.genre);
    if (b.startDate) info.push('início ' + fmtDate(b.startDate));
    if (b.endDate) info.push('fim ' + fmtDate(b.endDate));
    const pct = b.pages ? Math.min(100, Math.round(((b.pagesRead || 0) / b.pages) * 100)) : null;
    body.append(
      h('div', { style: { display: 'flex', gap: '16px', alignItems: 'flex-start' } },
        h('div', { style: { width: '110px', flex: 'none' } }, coverEl(b)),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('h3', { style: { fontSize: '1.25rem', marginBottom: '2px' } }, b.title),
          h('p', { class: 'muted', style: { margin: '0 0 8px' } }, b.author || 'Autor desconhecido'),
          h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' } },
            h('span', { class: `badge ${b.status}` }, STATUS[b.status]), b.rating ? stars(b.rating, 16) : null),
          h('p', { class: 'small muted', style: { margin: 0 } }, info.join(' · ')),
          pct != null && b.status !== 'quero' ? h('div', { style: { marginTop: '10px' } }, h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })), h('span', { class: 'small muted' }, `${b.pagesRead || 0} de ${b.pages} páginas (${pct}%)`)) : null)),
      b.review ? h('div', { class: 'card', style: { marginTop: '16px', whiteSpace: 'pre-wrap' } }, b.review) : null,
      h('div', { class: 'actions', style: { marginTop: '18px' } },
        (b.fileId || b.filePath) ? h('button', { class: 'btn primary', onclick: () => openBookFile(b) }, icon('file', 18), `Abrir ${b.fileType === 'epub' ? 'EPUB' : 'PDF'}`) : null,
        b.status !== 'lido' ? h('button', { class: 'btn', onclick: () => logSheet(rec) }, icon('plus', 18), 'Registrar leitura') : null,
        b.status !== 'lido' ? h('button', { class: 'btn', onclick: () => { sheet.close(); finishBook(rec); } }, icon('check', 18), 'Marcar como lido') : null,
        h('button', { class: 'btn', onclick: () => store.patch(rec.id, (d) => { d.favorite = !d.favorite; }) }, icon('heart', 18), b.favorite ? 'Desfavoritar' : 'Favoritar'),
        h('button', { class: 'btn', onclick: () => { sheet.close(); bookSheet({ rec }); } }, icon('edit', 18), 'Editar'),
        h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog(`Excluir “${b.title}”? Isso também tira o livro dos desafios.`)) { sheet.close(); store.remove(rec.id); toast('Livro excluído'); } } }, icon('trash', 18), 'Excluir')),
      (b.log && b.log.length) ? h('div', { style: { marginTop: '18px' } },
        h('h3', { style: { fontSize: '.95rem', marginBottom: '8px' } }, 'Diário de leitura'),
        h('div', { class: 'list' }, [...b.log].reverse().slice(0, 8).map((l) => h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', {}, `${l.pages} páginas`), h('span', { class: 'small muted' }, l.note || '')), h('span', { class: 'small muted' }, fmtDate(l.date)))))) : null);
  }
  draw();
  return sheet;
}

/* ---------- seletor de livro (A-Z, 12 meses, bingo, cores) ---------- */
export function pickBook({ title = 'Escolher livro', year, current, newStatus = 'lendo', suggest }) {
  return new Promise((resolve) => {
    let done = false, handoff = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const q = h('input', { type: 'search', placeholder: 'Buscar na sua biblioteca…', autocomplete: 'off' });
    const listEl = h('div', { class: 'list', style: { marginTop: '12px' } });
    const draw = () => {
      const term = q.value.trim().toLowerCase();
      let books = allBooks().filter((r) => !term || (r.data.title + ' ' + r.data.author).toLowerCase().includes(term));
      if (suggest) books.sort((a, b) => (suggest(b) ? 1 : 0) - (suggest(a) ? 1 : 0) || b.updated_at - a.updated_at);
      else books.sort((a, b) => b.updated_at - a.updated_at);
      listEl.innerHTML = '';
      if (!books.length) listEl.append(h('p', { class: 'muted', style: { textAlign: 'center' } }, 'Nenhum livro encontrado. Adicione um novo acima.'));
      books.slice(0, 60).forEach((r) => listEl.append(h('button', { class: 'row', onclick: () => { finish(r.id); sheet.close(); } },
        coverEl(r.data), h('div', { class: 'grow' }, h('b', {}, r.data.title), h('span', { class: 'small muted' }, `${r.data.author || '—'} · ${STATUS[r.data.status]}${r.year ? ' · ' + r.year : ''}`)))));
    };
    q.addEventListener('input', draw);
    const sheet = openSheet({
      title,
      body: h('div', {},
        h('div', { class: 'actions' },
          h('button', { class: 'btn primary', onclick: () => { handoff = true; sheet.close(); bookSheet({ year, defaults: { status: newStatus }, onSaved: (r) => finish(r.id) }); } }, icon('plus', 18), 'Novo livro / enviar arquivo'),
          current ? h('button', { class: 'btn danger', onclick: () => { finish(''); sheet.close(); } }, 'Tirar escolha') : null),
        h('div', { style: { marginTop: '12px' } }, q), listEl),
      onClose: () => { if (!handoff) finish(null); },
    });
    draw();
  });
}
