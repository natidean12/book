// Bingo de leitura: cartela 5x5 com casa livre, linhas detectadas automaticamente.
import * as store from '../store.js';
import { h, icon, coverEl, field, openSheet, toast, confirmDialog } from '../ui.js';
import { pickBook, bookById } from '../bookkit.js';

const PROMPTS = [
  'Livro de capa azul', 'Livro com mais de 500 páginas', 'Autor(a) brasileiro(a)', 'Um clássico', 'Livro de fantasia',
  'Romance de época', 'Livro de um autor que nunca li', 'Livro que virou filme', 'Primeiro livro de uma série', 'Livro de poesia',
  'Livro com menos de 150 páginas', 'Recomendação de amigo(a)', 'Livro de não ficção', 'Livro com animal na capa', 'Ficção científica',
  'Livro de terror ou suspense', 'Livro que está há anos na estante', 'Título com uma cor', 'Livro de contos', 'Biografia ou memórias',
  'Livro com mapa', 'Livro de uma autora mulher', 'Livro lido em um só dia', 'Livro traduzido', 'Livro do meu gênero favorito',
  'Livro com final feliz', 'Livro de um autor(a) estrangeiro(a)', 'Romance contemporâneo', 'Livro de capa rosa', 'Livro de um prêmio literário',
];
const LINES = [];
for (let i = 0; i < 5; i++) { LINES.push([0, 1, 2, 3, 4].map((j) => i * 5 + j)); LINES.push([0, 1, 2, 3, 4].map((j) => j * 5 + i)); }
LINES.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);

const rid = (y) => `bingo-${y}`;
const ui = { edit: false };
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

function newCard() {
  const p = shuffle(PROMPTS).slice(0, 24);
  const cells = [];
  for (let i = 0; i < 25; i++) cells.push(i === 12 ? { text: 'LIVRE', free: true } : { text: p.shift(), done: false, bookId: null });
  return { cells };
}

export function render({ year }) {
  const rec = store.get(rid(year));
  const card = rec ? rec.data : null;
  const saveCard = (c) => store.save('bingo', rid(year), c, year);

  if (!card) {
    return h('div', { class: 'page' },
      head(year), h('div', { class: 'empty' }, icon('grid', 34), h('p', {}, 'Crie sua cartela de bingo de leitura. Os desafios são sorteados e você pode trocar todos.'),
        h('button', { class: 'btn primary', onclick: () => saveCard(newCard()) }, icon('shuffle', 18), 'Sortear cartela')));
  }

  const isDone = (c) => c.free || c.done || (c.bookId && (bookById(c.bookId) || { data: {} }).data.status === 'lido');
  const lines = LINES.filter((l) => l.every((i) => isDone(card.cells[i])));
  const win = new Set(lines.flat());
  const all = card.cells.every(isDone);
  const count = card.cells.filter((c) => !c.free && isDone(c)).length;

  const grid = h('div', { class: 'bingo' }, card.cells.map((c, i) => {
    const book = c.bookId ? bookById(c.bookId) : null;
    return h('button', {
      class: `cell ${isDone(c) ? 'done' : ''} ${c.free ? 'free' : ''} ${win.has(i) ? 'win' : ''}`,
      'aria-label': c.text,
      onclick: () => {
        if (c.free) return;
        if (ui.edit) return cellSheet(card, i, year, saveCard);
        if (book && book.data.status === 'lido') { toast('Esta casa está marcada porque o livro foi lido'); return; }
        const cells = card.cells.map((x, k) => (k === i ? { ...x, done: !x.done } : x));
        saveCard({ ...card, cells });
      },
    }, book && book.data.cover ? coverEl(book.data) : null, h('span', {}, c.text));
  }));

  return h('div', { class: 'page' },
    head(year),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, `${count}/24`), h('span', {}, 'casas marcadas')),
      h('div', { class: 'stat' }, h('b', {}, lines.length), h('span', {}, lines.length === 1 ? 'linha completa' : 'linhas completas'))),
    all ? h('div', { class: 'banner' }, '🎉 CARTELA COMPLETA!') : lines.length ? h('div', { class: 'banner' }, `BINGO! ${lines.length} ${lines.length === 1 ? 'linha' : 'linhas'}`) : null,
    h('div', { class: 'actions', style: { justifyContent: 'center', marginBottom: '16px' } },
      h('div', { class: 'chips' },
        h('button', { class: `chip ${!ui.edit ? 'on' : ''}`, onclick: () => { ui.edit = false; window.dispatchEvent(new Event('cb:rerender')); } }, 'Jogar'),
        h('button', { class: `chip ${ui.edit ? 'on' : ''}`, onclick: () => { ui.edit = true; window.dispatchEvent(new Event('cb:rerender')); } }, 'Editar casas')),
      h('button', { class: 'btn sm', onclick: async () => { if (await confirmDialog('Sortear uma nova cartela apaga as marcações atuais.', 'Sortear')) saveCard(newCard()); } }, icon('shuffle', 16), 'Nova cartela')),
    h('p', { class: 'muted small', style: { textAlign: 'center', margin: '0 0 14px' } }, ui.edit ? 'Toque numa casa para trocar o desafio ou vincular um livro.' : 'Toque numa casa para marcar. Casas com livro vinculado marcam sozinhas quando o livro é concluído.'),
    grid);
}

function head(year) { return h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Bingo de ', h('span', {}, year)), h('p', {}, 'Complete linhas, colunas ou diagonais'))); }

function cellSheet(card, i, year, saveCard) {
  const c = card.cells[i];
  const text = h('input', { type: 'text', value: c.text });
  const book = c.bookId ? bookById(c.bookId) : null;
  const write = (patch) => saveCard({ ...card, cells: card.cells.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const sheet = openSheet({
    title: 'Casa do bingo',
    body: h('div', { class: 'grid' }, field('Desafio', text),
      h('div', { class: 'row' }, book ? coverEl(book.data) : icon('book'), h('div', { class: 'grow' }, h('b', {}, book ? book.data.title : 'Nenhum livro vinculado')),
        h('button', { class: 'btn sm', onclick: async () => {
          const id = await pickBook({ title: 'Livro para esta casa', year, current: !!book, newStatus: 'lendo' });
          if (id !== null) { write({ text: text.value.trim() || c.text, bookId: id || null }); sheet.close(); }
        } }, book ? 'Trocar' : 'Vincular'))),
    foot: [h('button', { class: 'btn', onclick: () => sheet.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: () => { write({ text: text.value.trim() || c.text }); sheet.close(); } }, 'Salvar')],
  });
}
