// Desafio dos 12 meses: um livro planejado por mês + o favorito do mês.
import * as store from '../store.js';
import { h, icon, coverEl, MONTHS, parts } from '../ui.js';
import { STATUS, pickBook, bookById, bookDetail, booksOfYear } from '../bookkit.js';

const rid = (y) => `mensal-${y}`;

export function render({ year }) {
  const data = store.getData(rid(year), { planned: {}, fav: {} });
  const books = booksOfYear(year);
  const set = (key, m, v) => store.save('mensal', rid(year), { planned: data.planned, fav: data.fav, [key]: { ...data[key], [m]: v } }, year);

  const cards = MONTHS.map((name, i) => {
    const m = i + 1;
    const planned = bookById(data.planned[m]);
    const read = books.filter((r) => r.data.status === 'lido' && r.data.endDate && parts(r.data.endDate).m === m);
    const favRec = bookById(data.fav[m]);
    const choosePlanned = async () => {
      const id = await pickBook({ title: `Livro de ${name}`, year, current: !!planned, newStatus: 'quero', suggest: (r) => r.data.status !== 'lido' });
      if (id !== null) set('planned', m, id || null);
    };
    return h('div', { class: 'card' },
      h('div', { class: 'month-card' },
        planned
          ? h('button', { class: 'book', style: { width: '84px', flex: 'none' }, onclick: choosePlanned, 'aria-label': 'Trocar livro' }, coverEl(planned.data))
          : h('button', { class: 'cover', style: { width: '84px', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }, onclick: choosePlanned, 'aria-label': `Escolher livro de ${name}` }, icon('plus', 26)),
        h('div', { class: 'body' },
          h('h3', { style: { color: 'var(--accent)' } }, name),
          planned
            ? h('div', {}, h('b', { style: { fontSize: '.9rem' } }, planned.data.title), h('div', { class: 'small muted' }, planned.data.author || ''),
                h('button', { class: `badge ${planned.data.status}`, style: { border: 0, marginTop: '4px', color: 'inherit' }, onclick: () => bookDetail(planned) }, STATUS[planned.data.status]))
            : h('span', { class: 'small muted' }, 'Escolha o livro do mês'),
          h('div', { style: { marginTop: 'auto' } },
            h('div', { class: 'small muted', style: { marginBottom: '6px' } }, read.length ? (favRec && read.some((r) => r.id === favRec.id) ? `★ Favorito: ${favRec.data.title}` : 'Toque numa capa para eleger o favorito do mês') : 'Livros lidos em ' + name.toLowerCase() + ' aparecem aqui'),
            read.length ? h('div', { class: 'minis' }, read.map((r) => h('button', { class: r.id === data.fav[m] ? 'fav' : '', title: r.data.title, onclick: () => set('fav', m, r.id === data.fav[m] ? null : r.id) }, coverEl(r.data)))) : null))));
  });

  const done = MONTHS.filter((_, i) => books.some((r) => r.data.status === 'lido' && r.data.endDate && parts(r.data.endDate).m === i + 1)).length;
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, '12 Meses de ', h('span', {}, year)), h('p', {}, `${done} de 12 meses com leitura concluída`))),
    h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))' } }, cards));
}
