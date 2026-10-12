// Subtitle parser for .ass/.ssa, .srt and .smi (SAMI). Every format becomes the same cue list:
// { id, start, end, pos: 'bottom' | 'top', segs: [{ text, c?, b?, i?, u?, s? }] }
(function (global) {
  'use strict';

  // ---------- shared helpers ----------

  const PLAIN = { c: null, b: false, i: false, u: false, s: false };
  const sameStyle = (a, b) => a.c === b.c && a.b === b.b && a.i === b.i && a.u === b.u && a.s === b.s;

  function appendSeg(segs, cur, text) {
    if (!text) return;
    const prev = segs[segs.length - 1];
    if (prev && sameStyle(prev, cur)) prev.text += text;
    else segs.push({ text, c: cur.c, b: cur.b, i: cur.i, u: cur.u, s: cur.s });
  }

  // Trim the whole line, tidy spaces around line breaks, and drop falsy style flags to keep storage small.
  function finishSegs(segs) {
    for (const s of segs) s.text = s.text.replace(/[ \t]*\n[ \t]*/g, '\n');
    while (segs.length && !segs[0].text.trim()) segs.shift();
    while (segs.length && !segs[segs.length - 1].text.trim()) segs.pop();
    if (!segs.length) return null;
    segs[0].text = segs[0].text.replace(/^\s+/, '');
    segs[segs.length - 1].text = segs[segs.length - 1].text.replace(/\s+$/, '');
    return segs.map((s) => {
      const o = { text: s.text };
      for (const k of ['c', 'b', 'i', 'u', 's']) if (s[k]) o[k] = s[k];
      return o;
    });
  }

  // Drop duplicate lines, sort by start time (stable, so file order wins ties) and number them.
  function finalize(cues) {
    const seen = new Set();
    const out = [];
    for (const cue of cues) {
      if (!(cue.end > cue.start)) continue;
      const sig = `${cue.start}|${cue.end}|${cue.pos}|${cue.segs.map((s) => s.text).join('')}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(cue);
    }
    out.sort((a, b) => a.start - b.start);
    out.forEach((c, i) => { c.id = i; });
    return { cues: out };
  }

  const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

  function decodeEntities(str) {
    return str.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e) => {
      if (e[0] === '#') {
        const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return n ? String.fromCodePoint(n) : m; } catch { return m; }
      }
      const v = ENTITIES[e.toLowerCase()];
      return v !== undefined ? v : m;
    });
  }

  function htmlColor(raw) {
    const v = raw.trim().replace(/^["']|["']$/g, '');
    if (/^#?[0-9a-f]{6}$/i.test(v)) return '#' + v.replace('#', '');
    if (/^[a-z]+$/i.test(v)) return v.toLowerCase();
    return null;
  }

  // HTML-like inline markup used by SRT and SMI: <i> <b> <u> <s> <font color> <br>.
  function parseMarkup(str, keepNewlines) {
    const segs = [];
    const stack = [];
    let cur = { ...PLAIN };
    const pushText = (raw) => {
      const text = decodeEntities(keepNewlines ? raw : raw.replace(/\s+/g, ' '));
      appendSeg(segs, cur, text);
    };

    const re = /<(\/?)([a-z]+)([^>]*)>/gi;
    let last = 0;
    let m;
    while ((m = re.exec(str))) {
      pushText(str.slice(last, m.index));
      last = re.lastIndex;
      const closing = !!m[1];
      const tag = m[2].toLowerCase();
      if (tag === 'br') { appendSeg(segs, cur, '\n'); continue; }
      if (!['i', 'b', 'u', 's', 'font'].includes(tag)) continue;
      if (closing) {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k].tag === tag) { cur = stack[k].prev; stack.length = k; break; }
        }
      } else {
        stack.push({ tag, prev: cur });
        cur = { ...cur };
        if (tag === 'font') {
          const cm = /color\s*=\s*["']?([#\w]+)/i.exec(m[3]);
          if (cm) cur.c = htmlColor(cm[1]) || cur.c;
        } else {
          cur[tag] = true;
        }
      }
    }
    pushText(str.slice(last));
    return finishSegs(segs);
  }

  // ---------- .ass / .ssa ----------

  const DEFAULT_EVENT_FORMAT = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
  const DEFAULT_STYLE = { ...PLAIN, align: 2 };
  // SSA v4 "legacy" alignment -> numpad alignment used by v4+.
  const LEGACY_ALIGN = { 1: 1, 2: 2, 3: 3, 5: 7, 6: 8, 7: 9, 9: 4, 10: 5, 11: 6 };

  function parseTime(str) {
    const m = /^(\d+):(\d+):(\d+)(?:[.:](\d+))?$/.exec((str || '').trim());
    if (!m) return NaN;
    return +m[1] * 3600 + +m[2] * 60 + +m[3] + (m[4] ? Number('0.' + m[4]) : 0);
  }

  // ASS colors are &HAABBGGRR (or decimal in old SSA files).
  function parseColor(str) {
    if (!str) return null;
    const s = str.trim();
    let v;
    const hex = /^&?H([0-9a-f]+)&?$/i.exec(s);
    if (hex) v = parseInt(hex[1], 16);
    else if (/^-?\d+$/.test(s)) v = Number(s) >>> 0;
    else return null;
    return `rgb(${v & 255}, ${(v >>> 8) & 255}, ${(v >>> 16) & 255})`;
  }

  const isTrue = (v) => v !== undefined && v !== '' && Number(v) !== 0;

  // Split into n fields; the last field keeps any remaining commas (Dialogue text).
  function splitFields(str, n) {
    const out = [];
    let rest = str;
    for (let i = 0; i < n - 1; i++) {
      const k = rest.indexOf(',');
      if (k < 0) { out.push(rest.trim()); rest = ''; continue; }
      out.push(rest.slice(0, k).trim());
      rest = rest.slice(k + 1);
    }
    out.push(rest);
    return out;
  }

  function toRecord(format, value) {
    const fields = splitFields(value, format.length);
    const rec = {};
    format.forEach((name, i) => { rec[name] = fields[i]; });
    return rec;
  }

  function makeStyle(rec, legacy) {
    let align = parseInt(rec.alignment, 10) || 2;
    if (legacy) align = LEGACY_ALIGN[align] || 2;
    return {
      c: parseColor(rec.primarycolour),
      b: isTrue(rec.bold),
      i: isTrue(rec.italic),
      u: isTrue(rec.underline),
      s: isTrue(rec.strikeout),
      align
    };
  }

  function buildAssCue(ev, styles, playResY) {
    const lookup = (name) => styles[(name || '').replace(/^\*/, '').toLowerCase()];
    const base = lookup(ev.style) || styles.default || DEFAULT_STYLE;
    let cur = { c: base.c, b: base.b, i: base.i, u: base.u, s: base.s };
    let align = base.align;
    let pos = null;
    let moved = false;
    let drawing = false;
    const segs = [];

    const pushText = (raw) => {
      if (drawing || !raw) return;
      appendSeg(segs, cur, raw.replace(/\\N/g, '\n').replace(/\\n/g, ' ').replace(/\\h/g, ' '));
    };

    const applyTags = (block) => {
      // Anything before the first backslash is a comment, e.g. {TL note}.
      for (const raw of block.split('\\').slice(1)) {
        const tok = raw.trim();
        let m;
        if ((m = /^i([01])$/.exec(tok))) cur.i = m[1] === '1';
        else if ((m = /^b(\d+)$/.exec(tok))) cur.b = +m[1] === 1 || +m[1] >= 600;
        else if ((m = /^u([01])$/.exec(tok))) cur.u = m[1] === '1';
        else if ((m = /^s([01])$/.exec(tok))) cur.s = m[1] === '1';
        else if ((m = /^1?c(&?H[0-9a-fA-F]+&?)?$/.exec(tok))) cur.c = m[1] ? parseColor(m[1]) : base.c;
        else if ((m = /^r(.*)$/.exec(tok))) {
          const st = (m[1] && lookup(m[1])) || base;
          cur = { c: st.c, b: st.b, i: st.i, u: st.u, s: st.s };
        }
        else if ((m = /^an([1-9])$/.exec(tok))) align = +m[1];
        else if ((m = /^a(\d+)$/.exec(tok))) align = LEGACY_ALIGN[+m[1]] || align;
        else if ((m = /^pos\(\s*([-\d.]+)\s*,\s*([-\d.]+)/.exec(tok))) pos = { x: +m[1], y: +m[2] };
        else if (/^move\(/.test(tok)) moved = true;
        else if ((m = /^p(\d+)$/.exec(tok))) drawing = +m[1] > 0;
      }
    };

    const text = ev.text || '';
    const re = /\{([^}]*)\}/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      pushText(text.slice(last, m.index));
      applyTags(m[1]);
      last = re.lastIndex;
    }
    pushText(text.slice(last));

    const finished = finishSegs(segs);
    if (!finished) return null;

    // Dialogue is bottom-aligned; top/middle/moving/positioned-high text is treated as a "sign".
    const sign = align > 3 || moved || (pos && pos.y < playResY * 0.66);
    return { start: parseTime(ev.start), end: parseTime(ev.end), pos: sign ? 'top' : 'bottom', segs: finished };
  }

  function parseAss(input) {
    const lines = input.replace(/^﻿/, '').split(/\r\n|\r|\n/);
    let section = '';
    let styleFormat = null;
    let eventFormat = null;
    const info = {};
    const styles = {};
    const events = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(';')) continue;
      if (line.startsWith('[') && line.endsWith(']')) { section = line.toLowerCase(); continue; }
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();

      if (section === '[script info]') {
        info[key.toLowerCase()] = value;
      } else if (section.includes('styles')) {
        if (key === 'Format') styleFormat = value.split(',').map((s) => s.trim().toLowerCase());
        else if (key === 'Style' && styleFormat) {
          const rec = toRecord(styleFormat, value);
          styles[(rec.name || '').replace(/^\*/, '').toLowerCase()] = makeStyle(rec, section === '[v4 styles]');
        }
      } else if (section === '[events]') {
        if (key === 'Format') eventFormat = value.split(',').map((s) => s.trim().toLowerCase());
        else if (key === 'Dialogue') events.push(toRecord(eventFormat || DEFAULT_EVENT_FORMAT, value));
      }
    }

    const playResY = parseFloat(info.playresy) || 288;
    return finalize(events.map((ev) => buildAssCue(ev, styles, playResY)).filter(Boolean));
  }

  // ---------- .srt ----------

  const SRT_TIME = /(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;
  const toSeconds = (h, m, s, f) => +h * 3600 + +m * 60 + +s + Number('0.' + f);

  function parseSrt(input) {
    const blocks = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/);
    const cues = [];
    for (const block of blocks) {
      const lines = block.split('\n');
      const ti = lines.findIndex((l) => SRT_TIME.test(l));
      if (ti < 0) continue;
      const t = SRT_TIME.exec(lines[ti]);
      let text = lines.slice(ti + 1).join('\n');
      // Some SRTs carry ASS-style alignment like {\an8}.
      const an = /\{\\an?(\d+)\}/.exec(text);
      const pos = an && +an[1] > 3 ? 'top' : 'bottom';
      text = text.replace(/\{\\[^}]*\}/g, '');
      const segs = parseMarkup(text, true);
      if (!segs) continue;
      cues.push({ start: toSeconds(t[1], t[2], t[3], t[4]), end: toSeconds(t[5], t[6], t[7], t[8]), pos, segs });
    }
    return finalize(cues);
  }

  // ---------- .smi (SAMI) ----------

  function parseSmi(input) {
    const src = input.replace(/^﻿/, '').replace(/<!--[\s\S]*?-->/g, '');
    const syncs = [];
    for (const part of src.split(/<sync\b/i).slice(1)) {
      const sm = /^[^>]*?start\s*=\s*["']?(-?\d+)/i.exec(part);
      if (!sm) continue;
      const body = part.slice(part.indexOf('>') + 1).replace(/<\/?(body|sami|html)\b[^>]*>/gi, '');
      // One SYNC can hold several <P Class=...> blocks, one per language.
      const pieces = body.split(/<p\b/i);
      const entries = [];
      if (pieces[0].trim()) entries.push({ cls: '', html: pieces[0] });
      for (const p of pieces.slice(1)) {
        const k = p.indexOf('>');
        const cm = /class\s*=\s*["']?([\w-]+)/i.exec(p.slice(0, k));
        entries.push({ cls: cm ? cm[1].toLowerCase() : '', html: p.slice(k + 1).replace(/<\/p>/gi, '') });
      }
      syncs.push({ start: Math.max(0, +sm[1]) / 1000, entries });
    }
    syncs.sort((a, b) => a.start - b.start);

    // Prefer the Korean track (e.g. KRCC) when the file has several languages.
    const classes = [...new Set(syncs.flatMap((s) => s.entries.map((e) => e.cls)))];
    const lang = classes.find((c) => /kr|ko/.test(c)) ?? classes[0];
    const entryFor = (sync) => sync.entries.find((e) => e.cls === lang);

    const cues = [];
    syncs.forEach((sync, i) => {
      const entry = entryFor(sync);
      if (!entry) return;
      const segs = parseMarkup(entry.html, false);
      if (!segs) return; // "&nbsp;" blocks just clear the previous line
      // A line lasts until the next SYNC for the same language.
      let end = sync.start + 5;
      for (let j = i + 1; j < syncs.length; j++) {
        if (syncs[j].start > sync.start && entryFor(syncs[j])) { end = syncs[j].start; break; }
      }
      cues.push({ start: sync.start, end, pos: 'bottom', segs });
    });
    return finalize(cues);
  }

  // ---------- entry point ----------

  function parse(input, filename = '') {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (ext === 'srt') return parseSrt(input);
    if (ext === 'smi' || ext === 'sami') return parseSmi(input);
    if (ext === 'ass' || ext === 'ssa') return parseAss(input);
    if (/<sync\b/i.test(input)) return parseSmi(input);
    if (/^\s*\[script info\]/im.test(input) || /^dialogue:/im.test(input)) return parseAss(input);
    return parseSrt(input);
  }

  const api = { parse, parseAss, parseSrt, parseSmi };
  global.SubtitleParser = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
