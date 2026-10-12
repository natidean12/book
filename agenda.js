// Agenda: calendário de leituras. Tudo é calculado a partir dos livros e do diário de leitura.
import * as store from '../store.js';
import { h, icon, coverEl, MONTHS, pad, ymd, fmtDate, openSheet, stars } from '../ui.js';
import { allBooks, bookDetail, logSheet, pickBook, bookById } from '../bookkit.js';

const cur = { y: null, m: null };

function collect() {
  const finished = {}, logs = {};
  allBooks().forEach((r) => {
    const b = r.data;
    if (b.status === 'lido' && b.endDate) (finished[b.endDate] = finished[b.endDate] || []).push(r);
    (b.log || []).forEach((l) => { (logs[l.date] = logs[l.date] || []).push({ rec: r, ...l }); });
  });
  return { finished, logs };
}

function streak(finished, logs) {
  const has = (d) => finished[d] || logs[d];
  const d = new Date();
  if (!has(ymd(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function render({ year }) {
  const now = new Date();
  if (cur.y !== year) { cur.y = year; cur.m = year === now.getFullYear() ? now.getMonth() : 0; }
  const wrap = h('div', { class: 'page' });

  function draw() {
    const { finished, logs } = collect();
    const first = new Date(year, cur.m, 1);
    const daysIn = new Date(year, cur.m + 1, 0).getDate();
    const lead = first.getDay();
    const todayStr = ymd(now);

    const cells = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => h('div', { class: 'dow' }, d));
    for (let i = 0; i < lead; i++) cells.push(h('div', { class: 'day out', style: { visibility: 'hidden' } }));
    let monthBooks = 0, monthPages = 0, monthDays = 0;
    for (let d = 1; d <= daysIn; d++) {
      const key = `${year}-${pad(cur.m + 1)}-${pad(d)}`;
      const f = finished[key] || [], l = logs[key] || [];
      const pg = l.reduce((s, x) => s + x.pages, 0);
      monthBooks += f.length; monthPages += pg; if (f.length || l.length) monthDays++;
      cells.push(h('button', { class: `day ${key === todayStr ? 'today' : ''}`, onclick: () => daySheet(key), 'aria-label': `Dia ${d}` },
        h('span', { class: 'n' }, d),
        h('div', {},
          f.length ? h('div', { class: 'covers' }, f.slice(0, 2).map((r) => coverEl(r.data)), f.length > 2 ? h('em', {}, `+${f.length - 2}`) : null) : null,
          pg ? h('div', { class: 'pg' }, `${pg} pg`) : null)));
    }

    const nav = (delta) => {
      const m = cur.m + delta;
      if (m < 0) { cur.y = year - 1; cur.m = 11; location.hash = `#/${year - 1}/agenda`; return; }
      if (m > 11) { cur.y = year + 1; cur.m = 0; location.hash = `#/${year + 1}/agenda`; return; }
      cur.m = m; draw();
    };

    wrap.innerHTML = '';
    wrap.append(
      h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Agenda de ', h('span', {}, year)), h('p', {}, 'Toque num dia para ver ou registrar leituras'))),
      h('div', { class: 'stats' },
        stat(monthBooks, 'livros concluídos no mês'),
        stat(monthPages.toLocaleString('pt-BR'), 'páginas registradas'),
        stat(monthDays, 'dias com leitura'),
        stat(streak(finished, logs), 'dias seguidos (sequência)')),
      h('div', { class: 'card' },
        h('div', { class: 'cal-head' },
          h('button', { class: 'btn icon', 'aria-label': 'Mês anterior', onclick: () => nav(-1) }, icon('chevL')),
          h('h2', {}, `${MONTHS[cur.m]} ${year}`),
          h('button', { class: 'btn icon', 'aria-label': 'Próximo mês', onclick: () => nav(1) }, icon('chevR'))),
        h('div', { class: 'cal' }, cells)));
  }
  draw();
  return wrap;
}

function stat(v, label) { return h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, label)); }

function daySheet(key) {
  const { finished, logs } = collect();
  const f = finished[key] || [], l = logs[key] || [];
  const body = h('div', { class: 'grid' },
    f.length ? h('div', {}, h('h3', { style: { fontSize: '.95rem', marginBottom: '8px' } }, 'Terminei de ler'),
      h('div', { class: 'list' }, f.map((r) => h('button', { class: 'row', onclick: () => { sheet.close(); bookDetail(r); } }, coverEl(r.data), h('div', { class: 'grow' }, h('b', {}, r.data.title), h('span', { class: 'small muted' }, r.data.author || '')), r.data.rating ? stars(r.data.rating, 12) : null)))) : null,
    l.length ? h('div', {}, h('h3', { style: { fontSize: '.95rem', marginBottom: '8px' } }, 'Leituras registradas'),
      h('div', { class: 'list' }, l.map((x) => h('button', { class: 'row', onclick: () => { sheet.close(); bookDetail(x.rec); } }, coverEl(x.rec.data), h('div', { class: 'grow' }, h('b', {}, x.rec.data.title), h('span', { class: 'small muted' }, x.note || '')), h('b', {}, `${x.pages} pg`))))) : null,
    !f.length && !l.length ? h('p', { class: 'muted', style: { margin: 0 } }, 'Nada registrado neste dia.') : null);
  const sheet = openSheet({
    title: fmtDate(key), body,
    foot: [h('button', { class: 'btn primary', onclick: async () => {
      sheet.close();
      const id = await pickBook({ title: 'Qual livro você leu?', current: false, newStatus: 'lendo', suggest: (r) => r.data.status === 'lendo' });
      if (id) { const rec = bookById(id); if (rec) logSheet(rec, null, key); }
    } }, icon('plus', 18), 'Registrar leitura neste dia')],
  });
}
