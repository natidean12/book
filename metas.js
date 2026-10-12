// Desafios do ano: meta de livros, ritmo, estatísticas e desafios personalizados.
import * as store from '../store.js';
import { h, icon, field, openSheet, toast, confirmDialog, MONTHS_SHORT, parts } from '../ui.js';
import { booksOfYear } from '../bookkit.js';

const goalId = (y) => `goal-${y}`;

export function render({ year }) {
  const goal = store.getData(goalId(year), { target: 50, pagesTarget: 0 });
  const lidos = booksOfYear(year).filter((r) => r.data.status === 'lido');
  const n = lidos.length;
  const pct = goal.target ? Math.min(100, Math.round((n / goal.target) * 100)) : 0;
  const pages = lidos.reduce((s, r) => s + (r.data.pages || 0), 0);

  // ritmo
  const now = new Date();
  let pace = null;
  if (goal.target) {
    if (year === now.getFullYear()) {
      const start = new Date(year, 0, 1);
      const days = Math.floor((now - start) / 86400000) + 1;
      const total = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
      const expected = (goal.target * days) / total;
      const diff = Math.round(n - expected);
      pace = n >= goal.target ? 'Meta alcançada! 🎉' : diff >= 1 ? `${diff} ${diff === 1 ? 'livro' : 'livros'} à frente do ritmo` : diff <= -1 ? `${-diff} ${-diff === 1 ? 'livro' : 'livros'} atrás do ritmo` : 'Exatamente no ritmo';
    } else if (year < now.getFullYear()) pace = n >= goal.target ? 'Meta alcançada! 🎉' : `Terminou com ${n} de ${goal.target}`;
  }

  const perMonth = Array(12).fill(0);
  lidos.forEach((r) => { if (r.data.endDate) perMonth[parts(r.data.endDate).m - 1]++; });
  const maxM = Math.max(1, ...perMonth);
  const bestM = perMonth.indexOf(Math.max(...perMonth));

  const genres = {};
  lidos.forEach((r) => { const g = r.data.genre; if (g) genres[g] = (genres[g] || 0) + 1; });
  const topGenre = Object.entries(genres).sort((a, b) => b[1] - a[1])[0];
  const longest = [...lidos].sort((a, b) => (b.data.pages || 0) - (a.data.pages || 0))[0];
  const top = [...lidos].filter((r) => r.data.rating).sort((a, b) => b.data.rating - a.data.rating)[0];

  const R = 82, C = 2 * Math.PI * R;
  const ring = h('div', { class: 'ring' },
    h('div', { html: `<svg width="190" height="190" viewBox="0 0 190 190"><circle cx="95" cy="95" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="14"/><circle cx="95" cy="95" r="${R}" fill="none" stroke="url(#g)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)"/></linearGradient></defs></svg>` }),
    h('div', { class: 'c' }, h('b', {}, n), h('span', { class: 'muted small' }, goal.target ? `de ${goal.target} livros` : 'livros lidos')));

  const custom = store.list('challenge', year).sort((a, b) => a.updated_at - b.updated_at);

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Desafios de ', h('span', {}, year)), h('p', {}, 'Quantos livros você vai ler neste ano?')),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => editGoal(year, goal) }, icon('edit', 18), 'Editar meta'))),
    h('div', { class: 'card', style: { display: 'flex', gap: '28px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '20px' } },
      ring,
      h('div', { style: { flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '12px' } },
        h('h2', {}, pace || (goal.target ? `${pct}% da meta` : 'Defina uma meta para o ano')),
        goal.target ? h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })) : null,
        h('p', { class: 'muted', style: { margin: 0 } }, goal.target ? `Faltam ${Math.max(0, goal.target - n)} livros.` : 'Toque em “Editar meta”.'),
        goal.pagesTarget ? h('div', {}, h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, Math.round(pages / goal.pagesTarget * 100)) + '%' } })), h('span', { class: 'small muted' }, `${pages.toLocaleString('pt-BR')} de ${goal.pagesTarget.toLocaleString('pt-BR')} páginas`)) : null)),
    h('div', { class: 'card', style: { marginBottom: '20px' } },
      h('h3', { style: { marginBottom: '14px' } }, 'Livros por mês'),
      h('div', { class: 'months-chart' }, perMonth.map((v, i) => h('div', {}, h('b', {}, v || ''), h('i', { style: { height: `${(v / maxM) * 100}%`, opacity: v ? 1 : .25 } }), MONTHS_SHORT[i])))),
    h('div', { class: 'stats' },
      stat(pages.toLocaleString('pt-BR'), 'páginas lidas'),
      stat(n && perMonth[bestM] ? MONTHS_SHORT[bestM] : '—', 'melhor mês'),
      stat(topGenre ? topGenre[0] : '—', 'gênero mais lido'),
      stat(longest && longest.data.pages ? longest.data.pages : '—', longest && longest.data.pages ? `maior: ${longest.data.title}` : 'maior livro'),
      stat(top ? '★'.repeat(top.data.rating) : '—', top ? `melhor: ${top.data.title}` : 'melhor nota')),
    h('div', { class: 'page-head', style: { marginTop: '10px' } },
      h('div', {}, h('h2', {}, 'Outros desafios'), h('p', {}, 'Ex.: ler 5 clássicos, 10 livros de fantasia…')),
      h('button', { class: 'btn', onclick: () => editChallenge(year) }, icon('plus', 18), 'Novo desafio')),
    custom.length ? h('div', { class: 'grid' }, custom.map((r) => challengeCard(r, year))) : h('p', { class: 'muted' }, 'Nenhum desafio extra ainda.'));
}

function stat(v, label) { return h('div', { class: 'stat' }, h('b', { style: { fontSize: '1.35rem' } }, v), h('span', {}, label)); }

function challengeCard(r, year) {
  const c = r.data;
  const pct = c.target ? Math.min(100, Math.round((c.count / c.target) * 100)) : 0;
  const step = (d) => store.patch(r.id, (x) => { x.count = Math.max(0, (x.count || 0) + d); });
  return h('div', { class: 'card', style: { display: 'flex', gap: '14px', alignItems: 'center' } },
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('b', {}, c.name), h('div', { class: 'bar', style: { margin: '8px 0 4px' } }, h('i', { style: { width: pct + '%' } })),
      h('span', { class: 'small muted' }, `${c.count || 0} de ${c.target}`)),
    h('button', { class: 'btn icon', 'aria-label': 'Menos um', onclick: () => step(-1) }, '–'),
    h('button', { class: 'btn icon primary', 'aria-label': 'Mais um', onclick: () => step(1) }, icon('plus', 18)),
    h('button', { class: 'btn icon', 'aria-label': 'Editar', onclick: () => editChallenge(year, r) }, icon('edit', 16)));
}

function editGoal(year, goal) {
  const t = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: goal.target || '' });
  const p = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: goal.pagesTarget || '', placeholder: 'Opcional' });
  const sheet = openSheet({
    title: `Meta de ${year}`,
    body: h('div', { class: 'form-grid' }, field('Quantos livros?', t), field('Páginas (opcional)', p)),
    foot: [h('button', { class: 'btn', onclick: () => sheet.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => { await store.save('goal', goalId(year), { target: Number(t.value) || 0, pagesTarget: Number(p.value) || 0 }, year); sheet.close(); toast('Meta salva'); } }, 'Salvar')],
  });
}

function editChallenge(year, rec) {
  const c = rec ? rec.data : { name: '', target: 5, count: 0 };
  const name = h('input', { type: 'text', value: c.name, placeholder: 'Ex.: Ler 5 clássicos' });
  const t = h('input', { type: 'number', min: 1, inputmode: 'numeric', value: c.target });
  const sheet = openSheet({
    title: rec ? 'Editar desafio' : 'Novo desafio',
    body: h('div', { class: 'form-grid' }, field('Nome', name, 'full'), field('Meta', t)),
    foot: [
      rec ? h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog('Excluir este desafio?')) { store.remove(rec.id); sheet.close(); } } }, 'Excluir') : null,
      h('button', { class: 'btn', onclick: () => sheet.close() }, 'Cancelar'),
      h('button', { class: 'btn primary', onclick: async () => {
        if (!name.value.trim()) { toast('Dê um nome ao desafio'); return; }
        await store.save('challenge', rec ? rec.id : null, { ...c, name: name.value.trim(), target: Number(t.value) || 1 }, year);
        sheet.close();
      } }, 'Salvar')],
  });
}
