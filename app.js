// Ponto de entrada: roteador (#/ano/tela), layout responsivo e ciclo de renderização.
import * as store from './store.js';
import { h, icon, openSheet } from './ui.js';
import { applyTheme } from './theme.js';
import * as home from './views/home.js';
import * as livros from './views/livros.js';
import * as metas from './views/metas.js';
import * as meses from './views/meses.js';
import * as agenda from './views/agenda.js';
import * as favoritos from './views/favoritos.js';
import * as bingo from './views/bingo.js';
import * as cores from './views/cores.js';
import * as az from './views/az.js';
import * as roleta from './views/roleta.js';
import * as ajustes from './views/ajustes.js';

const NAV = [
  { id: 'livros', label: 'Livros', icon: 'book', view: livros },
  { id: 'metas', label: 'Desafios', icon: 'trophy', view: metas },
  { id: 'meses', label: '12 Meses', icon: 'layers', view: meses },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', view: agenda },
  { id: 'favoritos', label: 'Favoritos', icon: 'heart', view: favoritos },
  { id: 'bingo', label: 'Bingo', icon: 'grid', view: bingo },
  { id: 'cores', label: 'Cores', icon: 'palette', view: cores },
  { id: 'az', label: 'A–Z', icon: 'type', view: az },
  { id: 'roleta', label: 'Roleta', icon: 'spin', view: roleta },
  { id: 'ajustes', label: 'Ajustes', icon: 'settings', view: ajustes },
];
const TABS = ['livros', 'metas', 'agenda', 'roleta'];

const root = document.getElementById('app');
let route = null;
let mainEl = null;
let pillEl = null;

function parseHash() {
  const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const year = parseInt(p[0], 10);
  if (!p.length || Number.isNaN(year)) return { home: true };
  const id = NAV.some((n) => n.id === p[1]) ? p[1] : 'livros';
  return { year, id };
}
const go = (year, id) => { location.hash = `#/${year}/${id}`; };

function statusPill() {
  const s = store.getStatus();
  const label = s.user ? (s.message || 'Conectado') : s.message;
  return [h('span', { class: `dot ${s.state === 'local' ? '' : s.state}` }), h('span', {}, label)];
}
function refreshPill() { if (pillEl) { pillEl.innerHTML = ''; pillEl.append(...statusPill()); } }

function buildShell() {
  root.innerHTML = '';
  const { year, id } = route;
  const links = NAV.map((n) => h('a', { class: `nav-link ${n.id === id ? 'active' : ''}`, href: `#/${year}/${n.id}` }, icon(n.icon, 20), n.label));
  pillEl = h('div', { class: 'sync-pill' }, ...statusPill());
  const sidebar = h('nav', { class: 'sidebar', 'aria-label': 'Principal' },
    h('div', { class: 'brand serif', onclick: () => { location.hash = '#/'; } }, 'Cosmic Bloom'),
    h('div', { class: 'year-switch' },
      h('button', { 'aria-label': 'Ano anterior', onclick: () => go(year - 1, id) }, icon('chevL')),
      h('strong', {}, year),
      h('button', { 'aria-label': 'Próximo ano', onclick: () => go(year + 1, id) }, icon('chevR'))),
    links, pillEl);

  mainEl = h('main', { id: 'main' });

  const tabs = TABS.map((t) => { const n = NAV.find((x) => x.id === t); return h('a', { href: `#/${year}/${n.id}`, class: n.id === id ? 'active' : '' }, icon(n.icon, 22), n.label); });
  const moreActive = !TABS.includes(id);
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Navegação' }, ...tabs,
    h('button', { class: moreActive ? 'active' : '', onclick: openMore }, icon('more', 22), 'Mais'));
  root.append(sidebar, mainEl, tabbar);
}

function openMore() {
  const { year, id } = route;
  const sheet = openSheet({
    title: `Cosmic Bloom · ${year}`,
    body: h('div', { class: 'list' },
      h('button', { class: 'row', onclick: () => { sheet.close(); location.hash = '#/'; } }, icon('home'), h('div', { class: 'grow' }, h('b', {}, 'Escolher outro ano'))),
      h('div', { class: 'row', style: { justifyContent: 'center', gap: '16px' } },
        h('button', { class: 'btn icon', onclick: () => { sheet.close(); go(year - 1, id); } }, icon('chevL')), h('strong', {}, year),
        h('button', { class: 'btn icon', onclick: () => { sheet.close(); go(year + 1, id); } }, icon('chevR'))),
      NAV.filter((n) => !TABS.includes(n.id)).map((n) => h('a', { class: 'row', href: `#/${year}/${n.id}`, style: { textDecoration: 'none', color: 'inherit' }, onclick: () => sheet.close() }, icon(n.icon), h('div', { class: 'grow' }, h('b', {}, n.label))))),
  });
}

function renderView(keepScroll = false) {
  if (!route) return;
  if (route.home) { root.innerHTML = ''; root.append(h('main', {}, home.render())); return; }
  const nav = NAV.find((n) => n.id === route.id);
  const top = keepScroll && mainEl ? mainEl.scrollTop : 0;
  mainEl.innerHTML = '';
  try {
    mainEl.append(nav.view.render({ year: route.year }));
  } catch (e) {
    console.error(e);
    mainEl.append(h('div', { class: 'empty' }, 'Algo deu errado ao abrir esta tela. Recarregue a página.'));
  }
  mainEl.scrollTop = top;
}

function onRoute() {
  const next = parseHash();
  const sameShell = route && !route.home && !next.home && route.year === next.year && route.id === next.id;
  route = next;
  if (route.home) { renderView(); return; }
  if (!sameShell) { buildShell(); renderView(); }
}

let rerenderTimer;
store.onChange((type) => {
  if (type === 'status') { refreshPill(); if (route && (route.home || route.id === 'ajustes')) scheduleRender(); return; }
  applyTheme();
  scheduleRender();
});
function scheduleRender() {
  clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => {
    const a = document.activeElement;
    const typing = a && a.closest && a.closest('main') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if (typing && a.value) return; // não atrapalha quem está digitando
    const ph = typing ? a.getAttribute('placeholder') : null;
    renderView(true);
    if (ph) { const again = mainEl && [...mainEl.querySelectorAll('input')].find((i) => i.getAttribute('placeholder') === ph); if (again) again.focus(); }
  }, 60);
}

window.addEventListener('hashchange', onRoute);
window.addEventListener('cb:rerender', () => renderView(true));

(async function boot() {
  await store.init();
  applyTheme();
  if (!location.hash) history.replaceState(null, '', '#/');
  onRoute();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
