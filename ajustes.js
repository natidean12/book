// Ajustes: conta/sincronização, aparência, backup.
import * as store from '../store.js';
import { h, icon, field, toast, download, confirmDialog } from '../ui.js';
import { PRESETS, getSettings, saveSettings } from '../theme.js';

export function render({ year }) {
  const s = getSettings();
  const st = store.getStatus();
  const setTheme = (patch) => saveSettings({ ...getSettings(), theme: { ...getSettings().theme, ...patch } });

  const name = h('input', { type: 'text', value: s.name, placeholder: 'Como devo te chamar?' });
  name.addEventListener('change', () => saveSettings({ ...getSettings(), name: name.value.trim() }));

  const presets = h('div', { class: 'presets' }, PRESETS.map((p) => {
    const on = p.bg === s.theme.bg && p.accent === s.theme.accent && p.accent2 === s.theme.accent2;
    return h('button', { class: `preset ${on ? 'on' : ''}`, style: { background: 'var(--surface)', color: 'var(--text)' }, onclick: () => setTheme({ bg: p.bg, accent: p.accent, accent2: p.accent2 }) },
      h('i', {}, h('b', { style: { background: p.bg } }), h('b', { style: { background: p.accent } }), h('b', { style: { background: p.accent2 } })), p.name);
  }));

  const colorInput = (label, key) => {
    const i = h('input', { type: 'color', value: s.theme[key], 'aria-label': label });
    i.addEventListener('change', () => setTheme({ [key]: i.value }));
    return h('label', { class: 'field', style: { alignItems: 'center' } }, i, label);
  };

  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    try { const n = await store.importAll(await f.text()); toast(`${n} registros importados`); } catch (e) { toast(e.message); }
    fileIn.value = '';
  });

  let account;
  if (!st.configured) {
    account = h('div', {}, h('p', { style: { margin: '0 0 8px' } }, 'O banco de dados online ainda não foi configurado, então seus dados ficam só neste aparelho.'),
      h('p', { class: 'muted small', style: { margin: 0 } }, 'Siga o passo a passo do arquivo LEIA-ME.md (leva uns 10 minutos). Depois disso, basta entrar com Google em cada aparelho.'));
  } else if (st.user) {
    account = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, h('span', { class: `dot ${st.state}` }), h('span', {}, `${st.user.email || 'Conta Google'} — ${st.message}`)),
      st.last ? h('span', { class: 'muted small' }, 'Última sincronização: ' + new Date(st.last).toLocaleTimeString('pt-BR')) : null,
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => store.sync() }, icon('cloud', 18), 'Sincronizar agora'),
        h('button', { class: 'btn', onclick: () => store.signOut() }, 'Sair da conta')));
  } else {
    account = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      h('p', { style: { margin: 0 } }, 'Entre com sua conta Google para levar seus livros, PDFs e desafios para qualquer aparelho.'),
      h('div', {}, h('button', { class: 'btn primary', onclick: () => store.signIn() }, icon('cloud', 18), 'Entrar com Google')));
  }

  return h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Ajustes'), h('p', {}, 'Conta, aparência e backup'))),
    h('div', { class: 'grid' },
      card('Sincronização entre aparelhos', account),
      card('Seu nome', field('Aparece na tela de entrada', name)),
      card('Aparência', h('div', { class: 'grid' }, presets,
        h('div', {}, h('p', { class: 'muted small', style: { margin: '0 0 10px' } }, 'Ou monte as suas próprias cores:'),
          h('div', { class: 'color-row' }, colorInput('Fundo', 'bg'), colorInput('Destaque', 'accent'), colorInput('Detalhe', 'accent2'))))),
      card('Backup', h('div', { class: 'grid' }, h('p', { class: 'muted small', style: { margin: 0 } }, 'Salva todos os seus registros num arquivo (os PDFs/EPUBs ficam fora; eles vão para a nuvem ao sincronizar).'),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: () => download(`cosmic-bloom-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportAll()) }, icon('upload', 18), 'Exportar backup'),
          h('button', { class: 'btn', onclick: () => fileIn.click() }, 'Importar backup'), fileIn))),
      h('p', { class: 'muted small', style: { textAlign: 'center' } }, 'Cosmic Bloom · diário de leitura')));
}

function card(title, ...body) { return h('div', { class: 'card' }, h('h3', { style: { marginBottom: '14px' } }, title), ...body); }
