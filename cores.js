// Desafio das cores: um livro para cada cor.
import * as store from '../store.js';
import { h, icon, coverEl, field, openSheet, toast, confirmDialog } from '../ui.js';
import { pickBook, bookById } from '../bookkit.js';

const DEFAULT = [['Vermelho', '#d94a4a'], ['Laranja', '#f08a3c'], ['Amarelo', '#f2cf4a'], ['Verde', '#4fa86a'], ['Azul', '#3f7fd0'], ['Roxo', '#8a5cc7'],
  ['Rosa', '#ef7fb0'], ['Preto', '#1e1e22'], ['Branco', '#f4f1ec'], ['Cinza', '#8b8f96'], ['Marrom', '#8a5a3b'], ['Dourado', '#d4a73a']];
const rid = (y) => `cores-${y}`;
const seed = () => ({ slots: DEFAULT.map(([name, hex]) => ({ name, hex, bookId: null })) });

export function render({ year }) {
  const rec = store.get(rid(year));
  const data = rec ? rec.data : seed();
  const save = (d) => store.save('cores', rid(year), d, year);
  const done = data.slots.filter((s) => { const b = bookById(s.bookId); return b && b.data.status === 'lido'; }).length;

  const tiles = data.slots.map((s, i) => {
    const b = bookById(s.bookId);
    const ok = b && b.data.status === 'lido';
    return h('button', { class: `tile ${ok ? 'done' : ''}`, onclick: () => slotSheet(data, i, year, save), 'aria-label': s.name },
      ok ? h('span', { class: 'ck' }, icon('check', 14)) : null,
      h('div', { class: 'swatch', style: { background: s.hex } }),
      b ? coverEl(b.data) : h('div', { class: 'cover', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '62%', color: 'var(--muted)', border: '1px dashed var(--border)' } }, icon('plus', 22)),
      h('b', { style: { fontSize: '.84rem' } }, s.name),
      h('span', { class: 'nm' }, b ? b.data.title : 'Escolher livro'));
  });

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Cores de ', h('span', {}, year)), h('p', {}, 'Um livro para cada cor da paleta')),
      h('button', { class: 'btn', onclick: () => save({ slots: [...data.slots, { name: 'Nova cor', hex: '#6ec6c6', bookId: null }] }) }, icon('plus', 18), 'Adicionar cor')),
    h('div', { class: 'card', style: { marginBottom: '20px' } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' } }, h('b', {}, 'Progresso'), h('span', { class: 'muted' }, `${done} de ${data.slots.length}`)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${data.slots.length ? (done / data.slots.length) * 100 : 0}%` } }))),
    h('div', { class: 'tiles' }, tiles));
}

function slotSheet(data, i, year, save) {
  const s = data.slots[i];
  const name = h('input', { type: 'text', value: s.name });
  const hex = h('input', { type: 'color', value: s.hex });
  const book = bookById(s.bookId);
  const write = (patch) => save({ slots: data.slots.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const sheet = openSheet({
    title: `Cor: ${s.name}`,
    body: h('div', { class: 'grid' },
      h('div', { class: 'form-grid' }, field('Nome da cor', name), field('Tom', hex)),
      h('div', { class: 'row' }, book ? coverEl(book.data) : icon('book'), h('div', { class: 'grow' }, h('b', {}, book ? book.data.title : 'Nenhum livro escolhido')),
        h('button', { class: 'btn sm', onclick: async () => {
          const id = await pickBook({ title: `Livro ${s.name.toLowerCase()}`, year, current: !!book, newStatus: 'quero' });
          if (id !== null) { write({ name: name.value.trim() || s.name, hex: hex.value, bookId: id || null }); sheet.close(); }
        } }, book ? 'Trocar' : 'Escolher'))),
    foot: [
      h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog(`Remover a cor “${s.name}”?`, 'Remover')) { save({ slots: data.slots.filter((_, k) => k !== i) }); sheet.close(); } } }, 'Remover cor'),
      h('button', { class: 'btn primary', onclick: () => { write({ name: name.value.trim() || s.name, hex: hex.value }); sheet.close(); } }, 'Salvar')],
  });
}
