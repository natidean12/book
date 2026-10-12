// Roleta de livros: roda de verdade, várias roletas, importa "Quero ler" da biblioteca.
import * as store from '../store.js';
import { h, icon, field, openSheet, toast, confirmDialog } from '../ui.js';
import { hexToHsl } from '../theme.js';
import { allBooks, bookById, bookDetail, bookSheet } from '../bookkit.js';

const ui = { id: null, rot: 0, spinning: false, seeded: false };
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function wheels() { return store.list('wheel').sort((a, b) => a.updated_at - b.updated_at || a.id.localeCompare(b.id)); }

function seedIfEmpty() {
  if (ui.seeded || wheels().length) return;
  ui.seeded = true;
  store.save('wheel', null, { name: 'Livros únicos', items: [] }, null);
  store.save('wheel', null, { name: 'Séries', items: [] }, null);
}

export function render({ year }) {
  seedIfEmpty();
  const ws = wheels();
  if (!ws.length) return h('div', { class: 'page' });
  const cur = ws.find((w) => w.id === ui.id) || ws[0];
  ui.id = cur.id;
  const items = cur.data.items || [];
  const write = (patch) => store.save('wheel', cur.id, { ...cur.data, ...patch }, null);

  const canvas = h('canvas', { width: 900, height: 900, role: 'img', 'aria-label': 'Roleta de livros' });
  const draw = () => drawWheel(canvas, items, ui.rot);

  const input = h('input', { type: 'text', placeholder: 'Adicionar título…', autocomplete: 'off' });
  const add = () => { const t = input.value.trim(); if (!t) return; write({ items: [...items, { text: t }] }); input.value = ''; };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

  const spinBtn = h('button', { class: 'btn primary', style: { width: '100%', maxWidth: '440px', padding: '14px', fontSize: '1rem' }, onclick: () => spin(), disabled: items.length < 2 }, icon('spin', 20), items.length < 2 ? 'Adicione pelo menos 2 itens' : 'Girar roleta');

  function spin() {
    if (ui.spinning || items.length < 2) return;
    ui.spinning = true; spinBtn.disabled = true;
    const n = items.length, seg = (Math.PI * 2) / n;
    const k = Math.floor(Math.random() * n);
    const jitter = (Math.random() - 0.5) * seg * 0.7;
    const target = -((k + 0.5) * seg) + jitter;
    const mod = (x) => ((x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const from = ui.rot;
    const to = from + Math.PI * 2 * (5 + Math.floor(Math.random() * 3)) + mod(target - from);
    const dur = 5200, t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      ui.rot = from + (to - from) * (1 - Math.pow(1 - p, 4));
      draw();
      if (p < 1) requestAnimationFrame(step);
      else { ui.spinning = false; spinBtn.disabled = false; if (navigator.vibrate) navigator.vibrate(60); result(k); }
    };
    requestAnimationFrame(step);
  }

  function result(k) {
    const it = items[k];
    const sheet = openSheet({
      title: 'O destino escolheu…',
      body: h('div', { style: { textAlign: 'center', padding: '10px 0 4px' } },
        h('div', { class: 'serif', style: { fontSize: '1.9rem', color: 'var(--accent)', lineHeight: 1.2 } }, it.text),
        h('p', { class: 'muted' }, 'Hora de começar essa leitura?')),
      foot: [
        h('button', { class: 'btn', onclick: () => { write({ items: items.filter((_, i) => i !== k) }); sheet.close(); } }, 'Tirar da roleta'),
        h('button', { class: 'btn', onclick: () => sheet.close() }, 'Fechar'),
        h('button', { class: 'btn primary', onclick: async () => {
          sheet.close();
          const ex = it.bookId ? bookById(it.bookId) : null;
          if (ex) { await store.patch(ex.id, (d) => { d.status = 'lendo'; d.startDate = d.startDate || new Date().toISOString().slice(0, 10); }); toast('Boa leitura! Marcado como “Lendo”'); }
          else bookSheet({ year, defaults: { title: it.text, status: 'lendo' } });
        } }, 'Começar a ler')],
    });
  }

  const tabs = h('div', { class: 'chips', style: { justifyContent: 'center' } },
    ws.map((w) => h('button', { class: `chip ${w.id === cur.id ? 'on' : ''}`, onclick: () => { ui.id = w.id; window.dispatchEvent(new Event('cb:rerender')); } }, w.data.name)),
    h('button', { class: 'chip', onclick: () => nameSheet(null) }, '+ Nova roleta'));

  function nameSheet(rec) {
    const name = h('input', { type: 'text', value: rec ? rec.data.name : '', placeholder: 'Ex.: Fantasia, Clássicos…' });
    const sheet = openSheet({
      title: rec ? 'Renomear roleta' : 'Nova roleta',
      body: field('Nome', name),
      foot: [
        rec && ws.length > 1 ? h('button', { class: 'btn danger', onclick: async () => { if (await confirmDialog(`Excluir a roleta “${rec.data.name}”?`)) { store.remove(rec.id); ui.id = null; sheet.close(); } } }, 'Excluir') : null,
        h('button', { class: 'btn', onclick: () => sheet.close() }, 'Cancelar'),
        h('button', { class: 'btn primary', onclick: async () => {
          const v = name.value.trim(); if (!v) return;
          if (rec) await store.patch(rec.id, (d) => { d.name = v; });
          else { const r = await store.save('wheel', null, { name: v, items: [] }, null); ui.id = r.id; }
          sheet.close();
        } }, 'Salvar')],
    });
  }

  const importWant = () => {
    const have = new Set(items.map((i) => i.bookId).filter(Boolean));
    const add = allBooks().filter((r) => r.data.status === 'quero' && !have.has(r.id)).map((r) => ({ text: r.data.title, bookId: r.id }));
    if (!add.length) { toast('Nenhum livro “Quero ler” novo na biblioteca'); return; }
    write({ items: [...items, ...add] }); toast(`${add.length} livros adicionados`);
  };

  requestAnimationFrame(draw);
  return h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Roleta de ', h('span', {}, 'livros')), h('p', {}, 'Sem saber o que ler? Deixe a sorte decidir')),
      h('button', { class: 'btn', onclick: () => nameSheet(cur) }, icon('edit', 18), 'Renomear / excluir')),
    tabs,
    h('div', { style: { margin: '22px 0 18px' } }, h('div', { class: 'wheel-wrap' }, h('div', { class: 'pointer' }), canvas)),
    h('div', { style: { display: 'flex', justifyContent: 'center', marginBottom: '26px' } }, spinBtn),
    h('div', { class: 'card', style: { maxWidth: '640px', margin: '0 auto' } },
      h('div', { style: { display: 'flex', gap: '10px' } }, input, h('button', { class: 'btn primary icon', 'aria-label': 'Adicionar', onclick: add }, icon('plus', 18))),
      h('div', { class: 'actions', style: { margin: '12px 0' } }, h('button', { class: 'btn sm', onclick: importWant }, icon('book', 16), 'Importar “Quero ler”'),
        items.length ? h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmDialog('Esvaziar esta roleta?', 'Esvaziar')) write({ items: [] }); } }, 'Esvaziar') : null),
      h('div', { class: 'chips' }, items.length ? items.map((it, i) => h('span', { class: 'tag' }, clip(it.text, 34), h('button', { 'aria-label': 'Remover', onclick: () => write({ items: items.filter((_, k) => k !== i) }) }, icon('x', 12)))) : h('span', { class: 'muted small' }, 'Adicione livros ou séries para girar.'))));
}

function drawWheel(canvas, items, rot) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, c = W / 2, R = c - 14;
  ctx.clearRect(0, 0, W, W);
  const cs = getComputedStyle(document.documentElement);
  const accent = cs.getPropertyValue('--accent').trim() || '#fcaec1';
  const accent2 = cs.getPropertyValue('--accent2').trim() || '#c9a7ff';
  const ink = cs.getPropertyValue('--accent-ink').trim() || '#2b1f22';
  const bg = cs.getPropertyValue('--bg').trim() || '#2a1519';
  const a = hexToHsl(accent), b = hexToHsl(accent2);
  const n = items.length;

  // aro externo
  ctx.beginPath(); ctx.arc(c, c, R + 10, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
  if (!n) {
    ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
    ctx.fillStyle = accent; ctx.font = '600 44px Poppins, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Adicione itens', c, c);
    return;
  }
  const seg = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    const s0 = -Math.PI / 2 + rot + i * seg;
    // alterna entre tons das duas cores do tema
    const base = i % 2 === 0 ? a : b;
    const l = Math.min(86, Math.max(40, base.l + ((i % 3) - 1) * 7));
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, s0, s0 + seg); ctx.closePath();
    ctx.fillStyle = `hsl(${base.h} ${Math.max(35, base.s)}% ${l}%)`; ctx.fill();
    ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.stroke();
    // texto
    ctx.save(); ctx.translate(c, c); ctx.rotate(s0 + seg / 2);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillStyle = l > 58 ? '#2b1f22' : '#ffffff';
    const size = Math.max(20, Math.min(40, 360 / Math.max(n, 6)));
    ctx.font = `600 ${size}px Poppins, sans-serif`;
    ctx.fillText(clip(items[i].text, n > 14 ? 14 : 22), R - 30, 0);
    ctx.restore();
  }
  // miolo
  ctx.beginPath(); ctx.arc(c, c, 46, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = accent; ctx.stroke();
}
