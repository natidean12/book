// Tela de entrada: escolher o ano. Sem login obrigatório.
import * as store from '../store.js';
import { h, icon, openSheet, field, toast } from '../ui.js';
import { getSettings, saveSettings } from '../theme.js';

export function render() {
  const now = new Date().getFullYear();
  const s = getSettings();
  const ys = new Set([now, ...store.years(), ...(s.years || [])]);
  const years = [...ys].sort((a, b) => b - a);
  const st = store.getStatus();

  const cards = years.map((y) => {
    const books = store.list('book', y);
    const lidos = books.filter((r) => r.data.status === 'lido').length;
    return h('a', { class: `year-card ${y === now ? 'now' : ''}`, href: `#/${y}/livros` },
      h('b', {}, y), h('span', { class: 'muted small' }, `${lidos} ${lidos === 1 ? 'livro lido' : 'livros lidos'}`));
  });
  cards.push(h('button', { class: 'year-card', style: { border: '1px dashed var(--border)', color: 'var(--text)' }, onclick: addYear },
    icon('plus', 30), h('span', { class: 'muted small' }, 'Novo ano')));

  return h('div', { class: 'page home' },
    h('div', {},
      h('p', { class: 'muted', style: { margin: '0 0 6px', letterSpacing: '.18em', textTransform: 'uppercase', fontSize: '.74rem' } }, s.name ? `Olá, ${s.name}` : 'Seu diário de leitura'),
      h('h1', { class: 'serif' }, 'Cosmic Bloom'),
      h('p', { class: 'muted', style: { margin: '8px 0 0' } }, 'Escolha o ano para abrir seu journal')),
    h('div', { class: 'years' }, cards),
    h('div', { class: 'actions', style: { justifyContent: 'center' } },
      st.configured && !st.user ? h('button', { class: 'btn primary', onclick: () => store.signIn() }, icon('cloud', 18), 'Entrar com Google para sincronizar') : null,
      st.user ? h('span', { class: 'chip' }, '☁ Sincronizado como ' + (st.user.email || 'conta Google')) : null,
      h('a', { class: 'btn', href: `#/${now}/ajustes` }, icon('settings', 18), 'Ajustes e cores')));
}

function addYear() {
  const input = h('input', { type: 'number', min: 1990, max: 2200, value: new Date().getFullYear() + 1, inputmode: 'numeric' });
  const sheet = openSheet({
    title: 'Novo ano',
    body: field('Qual ano você quer abrir?', input),
    foot: [
      h('button', { class: 'btn', onclick: () => sheet.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => {
        const y = parseInt(input.value, 10);
        if (!y || y < 1990 || y > 2200) { toast('Digite um ano válido'); return; }
        const s = getSettings();
        await saveSettings({ ...s, years: [...new Set([...(s.years || []), y])] });
        sheet.close();
        location.hash = `#/${y}/livros`;
      } }, 'Abrir'),
    ],
  });
}
