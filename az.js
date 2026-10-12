// Desafio A–Z: um livro para cada letra do alfabeto.
import * as store from '../store.js';
import { h, icon, coverEl, openSheet, toast } from '../ui.js';
import { pickBook, bookById, booksOfYear } from '../bookkit.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const rid = (y) => `az-${y}`;
const letterOf = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^[^A-Za-z]+/, '').charAt(0).toUpperCase();

export function render({ year }) {
  const data = store.getData(rid(year), { map: {} });
  const map = data.map || {};
  const save = (m) => store.save('az', rid(year), { map: m }, year);
  const done = LETTERS.filter((l) => { const b = bookById(map[l]); return b && b.data.status === 'lido'; }).length;
  const filled = LETTERS.filter((l) => bookById(map[l])).length;

  const autofill = () => {
    const used = new Set(Object.values(map));
    const next = { ...map };
    let added = 0;
    booksOfYear(year).forEach((r) => {
      const l = letterOf(r.data.title);
      if (l && LETTERS.includes(l) && !bookById(next[l]) && !used.has(r.id)) { next[l] = r.id; used.add(r.id); added++; }
    });
    if (added) { save(next); toast(`${added} ${added === 1 ? 'letra preenchida' : 'letras preenchidas'}`); } else toast('Nenhum livro novo combina com letras vazias');
  };

  const tiles = LETTERS.map((l) => {
    const b = bookById(map[l]);
    const ok = b && b.data.status === 'lido';
    return h('button', {
      class: `tile ${ok ? 'done' : ''}`, 'aria-label': `Letra ${l}`,
      onclick: async () => {
        const id = await pickBook({ title: `Livro com a letra ${l}`, year, current: !!b, newStatus: 'quero', suggest: (r) => letterOf(r.data.title) === l });
        if (id !== null) { const next = { ...map }; if (id) next[l] = id; else delete next[l]; save(next); }
      },
    }, ok ? h('span', { class: 'ck' }, icon('check', 14)) : null,
    h('div', { class: 'letter' }, l),
    b ? coverEl(b.data) : h('div', { class: 'cover', style: { width: '62%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', border: '1px dashed var(--border)' } }, icon('plus', 22)),
    h('span', { class: 'nm' }, b ? b.data.title : 'Escolher livro'));
  });

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'A–Z de ', h('span', {}, year)), h('p', {}, 'Uma leitura para cada letra do alfabeto')),
      h('button', { class: 'btn', onclick: autofill }, icon('sparkle', 18), 'Preencher com meus livros')),
    h('div', { class: 'card', style: { marginBottom: '20px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' } }, h('b', {}, 'Progresso'), h('span', { class: 'muted' }, `${done} lidos · ${filled} escolhidos · 26 letras`)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${(done / 26) * 100}%` } }))),
    h('div', { class: 'tiles' }, tiles));
}
