// Tema personalizável: o usuário escolhe 3 cores; o resto é calculado.
import * as store from './store.js';

export const PRESETS = [
  { name: 'Rosa Cósmico', bg: '#2a1519', accent: '#fcaec1', accent2: '#c9a7ff' },
  { name: 'Lavanda Noturna', bg: '#1d1633', accent: '#c4b5fd', accent2: '#f9a8d4' },
  { name: 'Floresta', bg: '#12261f', accent: '#86efac', accent2: '#fde68a' },
  { name: 'Oceano', bg: '#0f2433', accent: '#7dd3fc', accent2: '#a5b4fc' },
  { name: 'Grafite', bg: '#17181c', accent: '#f4f4f5', accent2: '#a1a1aa' },
  { name: 'Café com Leite', bg: '#f6efe7', accent: '#b4543a', accent2: '#7a5c3e' },
  { name: 'Algodão Doce', bg: '#fff1f6', accent: '#e0558a', accent2: '#8b5cf6' },
  { name: 'Menta', bg: '#eef8f3', accent: '#1f9d74', accent2: '#2b7fb8' },
];

export const DEFAULT_SETTINGS = { name: '', theme: { bg: PRESETS[0].bg, accent: PRESETS[0].accent, accent2: PRESETS[0].accent2 }, years: [] };

export function getSettings() {
  const d = store.getData('settings', {}) || {};
  return { ...DEFAULT_SETTINGS, ...d, theme: { ...DEFAULT_SETTINGS.theme, ...(d.theme || {}) } };
}
export const saveSettings = (s) => store.save('settings', 'settings', s, null);

export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hh = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh *= 60;
  }
  return { h: hh, s: s * 100, l: l * 100 };
}

export function applyTheme() {
  const t = getSettings().theme;
  const root = document.documentElement.style;
  const light = luminance(t.bg) > 0.45;
  root.setProperty('--bg', t.bg);
  root.setProperty('--accent', t.accent);
  root.setProperty('--accent2', t.accent2);
  root.setProperty('--text', light ? '#2b1f22' : '#fff2f5');
  root.setProperty('--accent-ink', luminance(t.accent) > 0.42 ? '#2b1f22' : '#ffffff');
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t.bg);
}
