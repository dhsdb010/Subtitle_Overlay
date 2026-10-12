// Popup: a compact player-style menu. Settings and the loaded subtitle live in chrome.storage.local,
// which the content script watches.
const app = document.getElementById('app');
const fileInput = document.getElementById('file');
let settings = { ...SUB_DEFAULTS };
let subtitle = null;
let view = 'main';
let message = null; // { text, error }
let pickerOpen = false;
let pickerHsv = null; // remembered so hue survives grays / re-renders
let about = null;

const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  cc: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 12.5h4M13 12.5h4M7 15.5h7"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 17.5v-6M9.5 14 12 11.5l2.5 2.5"/>',
  size: '<path d="M5 6.5V4h14v2.5M12 4v16M9 20h6"/>',
  timing: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  position: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7.5 16h9M12 7.5v5M9.8 10.5 12 12.7l2.2-2.2"/>',
  color: '<path d="M12 3.5s6 6.4 6 10.7a6 6 0 0 1-12 0c0-4.3 6-10.7 6-10.7z"/>',
  outline: '<path d="M5 20 12 4l7 16M8 13.5h8"/>',
  background: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h10"/>',
  font: '<path d="M3 18 8 6l5 12M4.8 14h6.4"/><circle cx="17.5" cy="15" r="3"/><path d="M20.5 12v6"/>',
  style: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  eyedropper: '<path d="m14.5 6.5 3 3M16 5l3 3-9.5 9.5H6.5v-3z"/><path d="M15 4.5a2.1 2.1 0 0 1 3 0l1.5 1.5a2.1 2.1 0 0 1 0 3"/>'
};

// Option-list sub-pages. Options are [value, label]; `isSel` / `patch` override the plain key match.
const LISTS = {
  size: { title: 'Subtitle Size', key: 'size', options: [50, 75, 90, 100, 110, 125, 150, 175, 200].map((v) => [v, `${v}%`]) },
  position: {
    title: 'Position', key: 'bottom', custom: true,
    options: [[2, 'Lowest'], [5, 'Low'], [8, 'Default'], [14, 'Raised'], [22, 'High']],
    // Presets also undo any sideways drag.
    isSel: (v) => settings.bottom === v && !settings.x,
    patch: (v) => ({ bottom: v, x: 0 })
  },
  color: {
    title: 'Text Color', key: 'color', swatches: true, custom: true,
    options: [['#ffffff', 'White'], ['#fff35c', 'Yellow'], ['#7cecff', 'Cyan'], ['#a6ff8f', 'Green'], ['#ffb8dc', 'Pink']]
  },
  outline: { title: 'Outline', key: 'outline', options: [[0, 'None'], [1.5, 'Thin'], [3, 'Normal'], [5, 'Thick']] },
  background: { title: 'Background', key: 'bgOpacity', options: [[0, 'Off'], [25, '25%'], [50, '50%'], [75, '75%'], [100, 'Solid']] },
  font: { title: 'Font', key: 'fontFamily', options: [['gothic', 'Gothic'], ['myeongjo', 'Myeongjo'], ['rounded', 'Rounded']] }
};

const STYLE_TOGGLES = [
  ['bold', 'Bold'],
  ['shadow', 'Drop shadow'],
  ['useAssStyle', 'Colors from file'],
  ['showSigns', 'Sign / top text'],
  ['draggable', 'Drag to move']
];

// ---------- tiny DOM helper ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c);
  return el;
}
const icon = (name, cls = 'icon') => h('span', { class: cls, html: svg(ICONS[name]) });

// ---------- state ----------

function save(patch) {
  settings = { ...settings, ...patch };
  chrome.storage.local.set({ settings });
  render();
}

function go(next) {
  view = next;
  message = null;
  render();
}

const fmtOffset = (o) => `${o > 0 ? '+' : ''}${o.toFixed(1)}s`;

const isSel = (list, value) => (list.isSel ? list.isSel(value) : settings[list.key] === value);
const patchFor = (list, value) => (list.patch ? list.patch(value) : { [list.key]: value });

function optionLabel(id) {
  const list = LISTS[id];
  const opt = list.options.find(([value]) => isSel(list, value));
  if (opt) return opt[1];
  return list.custom ? 'Custom' : String(settings[list.key]);
}

// ---------- color math ----------

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let hue = 0;
  if (d) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return [hue, max ? d / max : 0, max];
}

function hsvToRgb([hue, s, v]) {
  const f = (n) => {
    const k = (n + hue / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return [f(5), f(3), f(1)];
}

function stepOffset(delta) {
  save({ offset: Math.round((settings.offset + delta) * 10) / 10 });
}

// ---------- views ----------

function row({ iconName, label, labelClass, value, valueClass, chevron = true, onclick, right }) {
  return h('button', { class: 'row', onclick },
    iconName && icon(iconName),
    h('span', { class: `label ${labelClass || ''}` }, label),
    value != null && h('span', { class: `value ${valueClass || ''}`, title: value }, value),
    right,
    chevron && icon('chevron', 'chev'));
}

function page(title, ...content) {
  return h('div', { class: 'view' },
    h('div', { class: 'head' },
      h('button', { class: 'back', title: 'Back', html: svg(ICONS.back), onclick: () => go('main') }),
      h('h1', {}, title)),
    content);
}

function renderMain() {
  return h('div', { class: 'view' },
    row({
      iconName: 'cc', label: 'Subtitles', chevron: false,
      onclick: () => save({ enabled: !settings.enabled }),
      right: h('span', { class: `switch ${settings.enabled ? 'on' : ''}`, role: 'switch', 'aria-checked': String(!!settings.enabled) })
    }),
    row({
      iconName: 'file', label: 'Subtitle File', value: subtitle ? subtitle.name : 'Upload',
      onclick: () => (subtitle ? go('file') : fileInput.click())
    }),
    row({ iconName: 'size', label: 'Subtitle Size', value: `${settings.size}%`, onclick: () => go('size') }),
    row({ iconName: 'timing', label: 'Subtitle Timing', value: fmtOffset(settings.offset), onclick: () => go('timing') }),
    row({ iconName: 'position', label: 'Position', value: optionLabel('position'), onclick: () => go('position') }),
    row({ iconName: 'color', label: 'Text Color', value: optionLabel('color'), onclick: () => go('color') }),
    row({ iconName: 'outline', label: 'Outline', value: optionLabel('outline'), onclick: () => go('outline') }),
    row({ iconName: 'background', label: 'Background', value: optionLabel('background'), onclick: () => go('background') }),
    row({ iconName: 'font', label: 'Font', value: optionLabel('font'), onclick: () => go('font') }),
    row({
      iconName: 'style', label: 'Style',
      value: `${STYLE_TOGGLES.filter(([k]) => settings[k]).length} on`, onclick: () => go('style')
    }),
    message && h('div', { class: `msg ${message.error ? 'error' : ''}` }, message.text),
    about && h('div', { class: 'footer', title: about.description },
      `${about.name} v${about.version} · Made by ${about.author}`));
}

function renderList(id) {
  const list = LISTS[id];
  const items = list.options.map(([value, label]) =>
    h('button', {
      class: `row opt ${isSel(list, value) ? 'sel' : ''}`,
      onclick: () => { pickerOpen = false; save(patchFor(list, value)); }
    },
      list.swatches && h('span', { class: 'swatch', style: `background:${value}` }),
      h('span', { class: 'label' }, label)));

  const isCustom = !list.options.some(([value]) => isSel(list, value));
  if (id === 'color') {
    items.push(h('button', {
      class: `row opt ${isCustom ? 'sel' : ''}`,
      onclick: () => { pickerOpen = !pickerOpen; render(); }
    },
      h('span', { class: 'swatch wheel' }),
      h('span', { class: 'label' }, 'Custom…'),
      h('span', { class: `chev ${pickerOpen ? 'open' : ''}`, html: svg(ICONS.chevron) })));
    if (pickerOpen) items.push(colorPicker(settings.color, (hex, commit) => {
      settings = { ...settings, color: hex };
      chrome.storage.local.set({ settings });
      if (commit) render();
    }));
  } else if (id === 'position' && isCustom) {
    items.push(h('div', { class: 'row opt sel' }, h('span', { class: 'label' }, 'Custom (dragged)')));
  }

  if (id === 'position') {
    items.push(h('p', { class: 'hint' }, 'Tip: drag the subtitles on the video to move them anywhere.'));
  }

  if (id === 'outline') {
    items.push(
      h('div', { class: 'sub-label' }, 'Outline color'),
      h('div', { class: 'pills' },
        [['#000000', 'Black'], ['#ffffff', 'White']].map(([value, label]) =>
          h('button', { class: `pill ${settings.outlineColor === value ? 'sel' : ''}`, onclick: () => save({ outlineColor: value }) },
            h('span', { class: 'swatch', style: `background:${value}` }), label))));
  }
  return page(list.title, items);
}

// Built-in color picker: saturation/value square, hue bar, eyedropper and RGB fields.
function colorPicker(hex, onChange) {
  let [hue, sat, val] = pickerHsv && toHex(hsvToRgb(pickerHsv)) === hex ? pickerHsv : rgbToHsv(hexToRgb(hex));
  const current = () => toHex(hsvToRgb([hue, sat, val]));

  const svThumb = h('span', { class: 'cp-thumb' });
  const sv = h('div', { class: 'cp-sv' }, svThumb);
  const hueThumb = h('span', { class: 'cp-thumb' });
  const hueBar = h('div', { class: 'cp-hue' }, hueThumb);
  const preview = h('span', { class: 'cp-preview' });
  const inputs = ['R', 'G', 'B'].map(() => h('input', { type: 'number', min: 0, max: 255 }));

  function paint() {
    const color = current();
    pickerHsv = [hue, sat, val];
    sv.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;
    svThumb.style.left = `${sat * 100}%`;
    svThumb.style.top = `${(1 - val) * 100}%`;
    svThumb.style.background = color;
    hueThumb.style.left = `${(hue / 360) * 100}%`;
    hueThumb.style.background = `hsl(${hue}, 100%, 50%)`;
    preview.style.background = color;
    hexToRgb(color).forEach((v, i) => { if (document.activeElement !== inputs[i]) inputs[i].value = v; });
    return color;
  }

  function dragOn(el, update) {
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = el.getBoundingClientRect();
        update(clamp01((ev.clientX - r.left) / r.width), clamp01((ev.clientY - r.top) / r.height));
        onChange(paint(), false);
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        onChange(current(), true);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      move(e);
    });
  }
  dragOn(sv, (x, y) => { sat = x; val = 1 - y; });
  dragOn(hueBar, (x) => { hue = Math.min(359.9, x * 360); });

  for (const input of inputs) {
    input.addEventListener('change', () => {
      const rgb = inputs.map((el) => Math.min(255, Math.max(0, parseInt(el.value, 10) || 0)));
      [hue, sat, val] = rgbToHsv(rgb);
      onChange(paint(), true);
    });
  }

  const eyedropper = window.EyeDropper && h('button', {
    class: 'cp-eye', title: 'Pick a color from the screen', html: svg(ICONS.eyedropper),
    onclick: async () => {
      try {
        const { sRGBHex } = await new EyeDropper().open();
        [hue, sat, val] = rgbToHsv(hexToRgb(sRGBHex));
        onChange(paint(), true);
      } catch { /* cancelled */ }
    }
  });

  paint();
  return h('div', { class: 'cp' },
    sv,
    h('div', { class: 'cp-row' }, eyedropper, preview, hueBar),
    h('div', { class: 'cp-rgb' }, inputs.map((el, i) => h('label', {}, el, h('span', {}, 'RGB'[i])))));
}

function renderTiming() {
  const o = settings.offset;
  const state = o === 0 ? 'IN SYNC' : o > 0 ? 'SUBTITLES LATER' : 'SUBTITLES EARLIER';
  return page('Subtitle Timing',
    h('div', { class: 'timing' },
      h('button', { class: 'round', title: '0.1s earlier', html: svg(ICONS.minus), onclick: () => stepOffset(-0.1) }),
      h('div', { class: 'tval' }, h('b', {}, fmtOffset(o)), h('small', {}, state)),
      h('button', { class: 'round', title: '0.1s later', html: svg(ICONS.plus), onclick: () => stepOffset(0.1) })),
    h('div', { class: 'pills' },
      h('button', { class: 'pill', onclick: () => stepOffset(-1) }, '−1s'),
      h('button', { class: 'pill', onclick: () => save({ offset: 0 }) }, 'Reset'),
      h('button', { class: 'pill', onclick: () => stepOffset(1) }, '+1s')),
    h('p', { class: 'hint', html: 'On the video: <kbd>⌥ [</kbd> <kbd>⌥ ]</kbd> ±0.1s, add <kbd>⇧</kbd> for ±1s<br><kbd>⌥ \\</kbd> hide / show' }));
}

function renderFile() {
  const fmt = subtitle.name.split('.').pop().toUpperCase();
  return page('Subtitle File',
    h('div', { class: 'file-info' },
      h('div', { class: 'name' }, subtitle.name),
      h('div', { class: 'meta' }, `${fmt} · ${subtitle.cues.length} lines`)),
    row({ label: 'Upload another file', onclick: () => fileInput.click() }),
    row({
      label: 'Remove subtitle', labelClass: 'danger', chevron: false,
      onclick: async () => { await chrome.storage.local.remove('subtitle'); subtitle = null; go('main'); }
    }),
    message && h('div', { class: `msg ${message.error ? 'error' : ''}` }, message.text));
}

function renderStyle() {
  return page('Style',
    STYLE_TOGGLES.map(([key, label]) =>
      row({
        label, chevron: false, onclick: () => save({ [key]: !settings[key] }),
        right: h('span', { class: `switch ${settings[key] ? 'on' : ''}` })
      })),
    row({
      label: 'Reset all settings', chevron: false,
      onclick: () => save({ ...SUB_DEFAULTS, enabled: settings.enabled, offset: settings.offset })
    }));
}

function render() {
  let el;
  if (view === 'timing') el = renderTiming();
  else if (view === 'style') el = renderStyle();
  else if (view === 'file' && subtitle) el = renderFile();
  else if (LISTS[view]) el = renderList(view);
  else { view = 'main'; el = renderMain(); }
  app.replaceChildren(el);
}

// ---------- file loading ----------

// Files may be UTF-8, UTF-16 (with BOM) or legacy Korean CP949/EUC-KR (common for .smi).
function decode(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

async function loadFile(file) {
  try {
    const { cues } = SubtitleParser.parse(decode(await file.arrayBuffer()), file.name);
    if (!cues.length) throw new Error('no subtitle lines found');
    subtitle = { name: file.name, cues };
    // Reset the delay for a new file; keep appearance settings.
    settings = { ...settings, offset: 0 };
    await chrome.storage.local.set({ subtitle, settings });
    view = 'main';
    message = { text: `Loaded ${cues.length} lines` };
  } catch (err) {
    message = { text: `Couldn't load ${file.name}: ${err.message}`, error: true };
  }
  render();
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (file) loadFile(file);
});

// Drag & drop a file onto the popup.
document.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('drag'); });
document.addEventListener('dragleave', () => document.body.classList.remove('drag'));
document.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

// Keep in sync with changes made on the page (keyboard shortcuts).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  let changed = false;
  if (changes.settings) {
    const next = { ...SUB_DEFAULTS, ...changes.settings.newValue };
    // Ignore echoes of our own writes so an open color picker isn't torn down.
    if (JSON.stringify(next) !== JSON.stringify(settings)) { settings = next; changed = true; }
  }
  if (changes.subtitle) { subtitle = changes.subtitle.newValue || null; changed = true; }
  if (changed) render();
});

// Version / maker info lives in about.json.
fetch('about.json')
  .then((r) => r.json())
  .then((data) => { about = data; if (view === 'main') render(); })
  .catch(() => {});

chrome.storage.local.get(['settings', 'subtitle'], (data) => {
  settings = { ...SUB_DEFAULTS, ...(data.settings || {}) };
  subtitle = data.subtitle || null;
  render();
});
