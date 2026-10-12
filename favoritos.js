// Favoritos: livros marcados com coração + o favorito de cada mês.
import * as store from '../store.js';
import { h, stars, coverEl, empty, MONTHS } from '../ui.js';
import { allBooks, bookById, bookDetail } from '../bookkit.js';

const ui = { all: false };

export function render({ year }) {
  const draw = () => {
    const favs = allBooks().filter((r) => r.data.favorite && (ui.all || r.year === year))
      .sort((a, b) => (b.data.rating || 0) - (a.data.rating || 0) || b.updated_at - a.updated_at);
    const mensal = store.getData(`mensal-${year}`, { fav: {} });
    const months = MONTHS.map((n, i) => ({ n, rec: bookById(mensal.fav[i + 1]) })).filter((x) => x.rec);

    body.innerHTML = '';
    body.append(
      favs.length
        ? h('div', { class: 'books' }, favs.map((r) => h('button', { class: 'book', onclick: () => bookDetail(r) },
            coverEl(r.data), h('div', { class: 't' }, r.data.title), h('div', { class: 'a' }, r.data.author || ' '), r.data.rating ? stars(r.data.rating, 12) : null)))
        : empty('heart', 'Você ainda não favoritou nenhum livro. Abra um livro e toque em “Favoritar”.'),
      months.length ? h('div', { style: { marginTop: '34px' } },
        h('h2', { style: { marginBottom: '14px' } }, `Favoritos de cada mês · ${year}`),
        h('div', { class: 'books' }, months.map((x) => h('button', { class: 'book', onclick: () => bookDetail(x.rec) },
          coverEl(x.rec.data), h('div', { class: 't' }, x.rec.data.title), h('div', { class: 'a' }, x.n))))) : null);
  };
  const body = h('div');
  const toggle = h('div', { class: 'chips' },
    h('button', { class: `chip ${!ui.all ? 'on' : ''}`, onclick: (e) => { ui.all = false; sync(); draw(); } }, `Só ${year}`),
    h('button', { class: `chip ${ui.all ? 'on' : ''}`, onclick: () => { ui.all = true; sync(); draw(); } }, 'Todos os anos'));
  function sync() { [...toggle.children].forEach((c, i) => c.classList.toggle('on', (i === 1) === ui.all)); }
  draw();
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Favoritos de ', h('span', {}, year)), h('p', {}, 'Os livros que ficaram no coração')), toggle), body);
}
