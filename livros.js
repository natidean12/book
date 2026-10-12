// Biblioteca do ano.
import * as store from '../store.js';
import { h, icon, stars, coverEl, empty } from '../ui.js';
import { STATUS, bookSheet, bookDetail, booksOfYear } from '../bookkit.js';

const ui = { filter: 'todos', q: '' };

export function render({ year }) {
  const all = booksOfYear(year);
  const lidos = all.filter((r) => r.data.status === 'lido');
  const pages = lidos.reduce((s, r) => s + (r.data.pages || 0), 0);
  const rated = lidos.filter((r) => r.data.rating);
  const avg = rated.length ? (rated.reduce((s, r) => s + r.data.rating, 0) / rated.length).toFixed(1) : '—';

  const grid = h('div');
  const q = h('input', { type: 'search', placeholder: 'Buscar por título ou autor…', value: ui.q, 'aria-label': 'Buscar' });
  q.addEventListener('input', () => { ui.q = q.value; draw(); });

  const chips = h('div', { class: 'chips' });
  const drawChips = () => {
    chips.innerHTML = '';
    [['todos', 'Todos'], ...Object.entries(STATUS)].forEach(([k, v]) => {
      const n = k === 'todos' ? all.length : all.filter((r) => r.data.status === k).length;
      chips.append(h('button', { class: `chip ${ui.filter === k ? 'on' : ''}`, onclick: () => { ui.filter = k; drawChips(); draw(); } }, `${v} · ${n}`));
    });
  };

  function draw() {
    const term = ui.q.trim().toLowerCase();
    const items = all
      .filter((r) => ui.filter === 'todos' || r.data.status === ui.filter)
      .filter((r) => !term || (r.data.title + ' ' + r.data.author).toLowerCase().includes(term))
      .sort((a, b) => (b.data.endDate || '').localeCompare(a.data.endDate || '') || b.updated_at - a.updated_at);
    grid.innerHTML = '';
    if (!items.length) {
      grid.append(empty('book', all.length ? 'Nenhum livro com esse filtro.' : `Sua estante de ${year} está vazia. Que tal começar pelo primeiro livro?`,
        all.length ? null : h('button', { class: 'btn primary', onclick: () => bookSheet({ year }) }, icon('plus', 18), 'Adicionar livro')));
      return;
    }
    grid.append(h('div', { class: 'books' }, items.map((r) => {
      const b = r.data;
      return h('button', { class: 'book', onclick: () => bookDetail(r), 'aria-label': b.title },
        h('div', { style: { position: 'relative' } }, coverEl(b),
          b.favorite ? h('span', { style: { position: 'absolute', top: '6px', right: '6px', color: 'var(--accent)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' } }, (() => { const i = icon('heart', 18); i.firstChild.setAttribute('fill', 'currentColor'); return i; })()) : null,
          b.fileId || b.filePath ? h('span', { class: 'badge', style: { position: 'absolute', left: '6px', top: '6px', background: 'rgba(0,0,0,.55)', color: '#fff' } }, (b.fileType || 'pdf').toUpperCase()) : null),
        h('div', { class: 't' }, b.title),
        h('div', { class: 'a' }, b.author || ' '),
        h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } }, h('span', { class: `badge ${b.status}` }, STATUS[b.status]), b.rating ? stars(b.rating, 12) : null));
    })));
  }
  drawChips(); draw();

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Livros de ', h('span', {}, year)), h('p', {}, 'Sua estante e o registro de cada leitura')),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => bookSheet({ year }) }, icon('plus', 18), 'Adicionar livro'))),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, lidos.length), h('span', {}, 'livros lidos')),
      h('div', { class: 'stat' }, h('b', {}, all.filter((r) => r.data.status === 'lendo').length), h('span', {}, 'lendo agora')),
      h('div', { class: 'stat' }, h('b', {}, pages.toLocaleString('pt-BR')), h('span', {}, 'páginas lidas')),
      h('div', { class: 'stat' }, h('b', {}, avg), h('span', {}, 'nota média'))),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' } }, q, chips),
    grid);
}
