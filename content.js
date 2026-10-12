// Draws the loaded subtitle cues over the page's video, synced to video.currentTime.
(() => {
  'use strict';
  if (window.__assSubOverlay) return;
  window.__assSubOverlay = true;

  const CSS = `
    .box {
      position: absolute; left: 4%; right: 4%;
      display: flex; align-items: center; gap: 0.12em;
      text-align: center; line-height: 1.3;
      font-family: var(--font); font-size: var(--fs); font-weight: var(--weight);
      color: var(--color);
    }
    .bottom {
      bottom: var(--bottom); flex-direction: column-reverse;
      left: calc(4% + var(--x, 0%)); right: calc(4% - var(--x, 0%));
    }
    .drag .line { pointer-events: auto; cursor: grab; }
    .drag .line:hover { outline: 1px dashed rgba(255, 255, 255, 0.5); outline-offset: 2px; }
    .dragging .line { cursor: grabbing; outline: 1px dashed rgba(255, 255, 255, 0.8); outline-offset: 2px; }
    .top { top: 4%; flex-direction: column; font-size: calc(var(--fs) * 0.8); }
    .line {
      white-space: pre-wrap; text-shadow: var(--ts);
      background: var(--bg); padding: 0 0.3em; border-radius: 0.15em;
      -webkit-box-decoration-break: clone; box-decoration-break: clone;
    }
    .toast {
      position: absolute; top: 16px; right: 16px;
      font: 600 14px/1.2 system-ui, sans-serif; color: #fff;
      background: rgba(0, 0, 0, 0.75); padding: 7px 11px; border-radius: 6px;
      opacity: 0; transition: opacity 0.2s;
    }
    .toast.show { opacity: 1; }
  `;

  let settings = { ...SUB_DEFAULTS };
  let cues = [];
  let video = null;
  let host = null;
  let topBox = null;
  let bottomBox = null;
  let toastEl = null;
  let toastTimer = 0;
  let rafId = 0;
  let lastKey = null;   // which cues are currently drawn
  let lastLayout = '';  // video rect + settings the CSS vars were computed for
  let nativeTrack = null;
  let nativeVideo = null;
  let nativeStyle = null;

  // ---------- state ----------

  // If a change arrives before the initial read returns, that read is stale; keep the newer data.
  let changedSinceLoad = false;

  chrome.storage.local.get(['settings', 'subtitle'], (data) => {
    if (changedSinceLoad) return;
    applySettings(data.settings);
    cues = (data.subtitle && data.subtitle.cues) || [];
    refresh();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    changedSinceLoad = true;
    if (changes.settings) applySettings(changes.settings.newValue);
    if (changes.subtitle) cues = (changes.subtitle.newValue && changes.subtitle.newValue.cues) || [];
    lastKey = null;
    refresh();
  });

  // After the extension is updated or reloaded, scripts already in open tabs lose access to chrome.*.
  const contextAlive = () => { try { return !!chrome.runtime?.id; } catch { return false; } };

  function saveSettings(next) {
    if (!contextAlive()) return;
    try { chrome.storage.local.set({ settings: next }); } catch { /* context gone */ }
  }

  function applySettings(s) {
    settings = { ...SUB_DEFAULTS, ...(s || {}) };
    lastLayout = '';
    lastKey = null;
  }

  function isActive() {
    return settings.enabled && cues.length > 0;
  }

  function refresh() {
    // Tells fullscreen-main.js (page world) to fullscreen a wrapper instead of the bare video.
    document.documentElement.toggleAttribute('data-subov-active', isActive());
    if (isActive()) {
      if (!video || !video.isConnected) pickVideo();
      // The loop only runs while there's a video; play events and the 1s check below restart it.
      if (video && video.isConnected && !rafId) rafId = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafId);
      rafId = 0;
      clearBoxes();
      clearNative();
    }
  }

  // ---------- video tracking ----------

  function setVideo(v) {
    if (v === video) return;
    clearNative();
    video = v;
    lastKey = null;
    lastLayout = '';
  }

  // Prefer the biggest video on the page, and strongly prefer one that is playing.
  function pickVideo() {
    let best = null;
    let bestScore = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const score = r.width * r.height * (v.paused ? 1 : 4);
      if (score > bestScore) { best = v; bestScore = score; }
    }
    if (best) setVideo(best);
  }

  // Media events don't bubble, but capture-phase listeners still see them.
  document.addEventListener('play', (e) => {
    if (e.target instanceof HTMLVideoElement) { setVideo(e.target); refresh(); }
  }, true);
  document.addEventListener('loadedmetadata', (e) => {
    if (e.target instanceof HTMLVideoElement && (!video || !video.isConnected)) { setVideo(e.target); refresh(); }
  }, true);
  setInterval(() => {
    if (isActive() && (!video || !video.isConnected)) { pickVideo(); refresh(); }
  }, 1000);

  // ---------- render loop ----------

  function tick() {
    rafId = 0;
    if (!video || !video.isConnected) pickVideo();
    if (!video || !video.isConnected) { clearBoxes(); return; }
    rafId = requestAnimationFrame(tick);

    const t = video.currentTime - settings.offset;
    const now = cues.filter((c) => c.start <= t && t < c.end && (settings.showSigns || c.pos === 'bottom'));
    const key = now.map((c) => c.id).join(',');

    if (isNativeFullscreen()) {
      if (host) host.style.display = 'none';
      renderNative(now, key);
      return;
    }
    clearNative();
    ensureHost();
    layout();
    if (key !== lastKey) {
      lastKey = key;
      renderCues(now);
    }
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  // When the <video> element itself is fullscreen nothing can be drawn on top of it,
  // so we fall back to a native text track for that case.
  function isNativeFullscreen() {
    return !!video && fullscreenElement() === video;
  }

  function ensureHost() {
    if (!host) {
      host = document.createElement('div');
      host.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;margin:0;padding:0;border:0;overflow:visible;';
      host.setAttribute('data-subov-host', '');
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${CSS}</style><div class="box top"></div><div class="box bottom"></div><div class="toast"></div>`;
      topBox = root.querySelector('.top');
      bottomBox = root.querySelector('.bottom');
      toastEl = root.querySelector('.toast');
      bottomBox.addEventListener('pointerdown', startDrag);
      // Keep clicks on the subtitles from reaching the player (e.g. pausing it).
      for (const type of ['click', 'dblclick', 'mousedown', 'mouseup']) {
        bottomBox.addEventListener(type, (e) => e.stopPropagation());
      }
    }
    // In fullscreen, only the fullscreen element's subtree is visible, so live inside it.
    const fs = fullscreenElement();
    const parent = fs && video && fs !== video && fs.contains(video) ? fs : document.documentElement;
    if (host.parentNode !== parent) {
      parent.appendChild(host);
      lastLayout = '';
    }
    host.style.display = '';
  }

  function textShadow(w, color, drop, fs) {
    const parts = [];
    if (w > 0) {
      const rings = w > 2 ? [w, w / 2] : [w];
      for (const r of rings) {
        for (let i = 0; i < 16; i++) {
          const a = (i * Math.PI) / 8;
          parts.push(`${(Math.cos(a) * r).toFixed(2)}px ${(Math.sin(a) * r).toFixed(2)}px 0 ${color}`);
        }
      }
    }
    if (drop) parts.push(`0 ${(fs * 0.05 + w * 0.5).toFixed(1)}px ${(fs * 0.1).toFixed(1)}px rgba(0,0,0,0.8)`);
    return parts.length ? parts.join(', ') : 'none';
  }

  function styleVars(height) {
    const fs = Math.max(8, (height * SUB_BASE_FONT * settings.size) / 10000);
    const w = (settings.outline * fs) / 50;
    return {
      fs,
      font: SUB_FONTS[settings.fontFamily] || SUB_FONTS.gothic,
      weight: settings.bold ? '700' : '400',
      color: settings.color,
      ts: textShadow(w, settings.outlineColor, settings.shadow, fs),
      bg: `rgba(0, 0, 0, ${settings.bgOpacity / 100})`
    };
  }

  function layout() {
    const r = video.getBoundingClientRect();
    const key = `${r.left}|${r.top}|${r.width}|${r.height}`;
    if (key === lastLayout) return;
    lastLayout = key;

    const s = host.style;
    s.left = `${r.left}px`;
    s.top = `${r.top}px`;
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;

    const v = styleVars(r.height);
    s.setProperty('--fs', `${v.fs}px`);
    s.setProperty('--font', v.font);
    s.setProperty('--weight', v.weight);
    s.setProperty('--color', v.color);
    s.setProperty('--ts', v.ts);
    s.setProperty('--bg', v.bg);
    s.setProperty('--bottom', `${settings.bottom}%`);
    s.setProperty('--x', `${settings.x || 0}%`);
    bottomBox.classList.toggle('drag', !!settings.draggable);
  }

  // ---------- drag to move ----------

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function startDrag(e) {
    if (!settings.draggable || e.button !== 0 || !e.target.closest('.line')) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = host.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, bottom: settings.bottom, off: settings.x || 0 };
    const next = { bottom: start.bottom, x: start.off };
    bottomBox.classList.add('dragging');

    const move = (ev) => {
      next.bottom = clamp(start.bottom - ((ev.clientY - start.y) / rect.height) * 100, 0, 85);
      next.x = clamp(start.off + ((ev.clientX - start.x) / rect.width) * 100, -40, 40);
      if (Math.abs(next.x) < 1.5) next.x = 0; // snap back to center
      host.style.setProperty('--bottom', `${next.bottom}%`);
      host.style.setProperty('--x', `${next.x}%`);
    };
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      bottomBox.classList.remove('dragging');
      const round = (v) => Math.round(v * 2) / 2;
      saveSettings({ ...settings, bottom: round(next.bottom), x: round(next.x) });
    };
    // Listen on the window so the drag keeps working when the pointer leaves the text.
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  function renderCues(now) {
    clearBoxes();
    for (const c of now) {
      const row = document.createElement('div');
      const line = document.createElement('span');
      line.className = 'line';
      for (const seg of c.segs) {
        const span = document.createElement('span');
        span.textContent = seg.text;
        if (seg.i) span.style.fontStyle = 'italic';
        const deco = [seg.u && 'underline', seg.s && 'line-through'].filter(Boolean).join(' ');
        if (deco) span.style.textDecoration = deco;
        if (settings.useAssStyle) {
          if (seg.c) span.style.color = seg.c;
          if (seg.b) span.style.fontWeight = '700';
        }
        line.appendChild(span);
      }
      row.appendChild(line);
      (c.pos === 'top' ? topBox : bottomBox).appendChild(row);
    }
  }

  function clearBoxes() {
    if (topBox) topBox.textContent = '';
    if (bottomBox) bottomBox.textContent = '';
    lastKey = null;
  }

  // ---------- fullscreen wrapper ----------
  // fullscreen-main.js fullscreens the video's parent (marked data-subov-fs) instead of the bare video.
  // Style it like a video-only fullscreen: black, video centered, the rest of the player hidden.

  const WRAPPER_CSS = `
    [data-subov-fs]:fullscreen {
      display: flex !important; align-items: center !important; justify-content: center !important;
      width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important;
      margin: 0 !important; padding: 0 !important; transform: none !important; background: #000 !important;
    }
    [data-subov-fs]:fullscreen > :not(video[data-subov-video]):not([data-subov-host]) { display: none !important; }
    [data-subov-fs]:fullscreen > video[data-subov-video] {
      width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important;
      object-fit: contain !important; position: static !important; transform: none !important; margin: 0 !important;
    }
  `;

  function injectWrapperCss() {
    if (document.getElementById('subov-fullscreen-css')) return;
    const style = document.createElement('style');
    style.id = 'subov-fullscreen-css';
    style.textContent = WRAPPER_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  function onFullscreenChange() {
    const fs = fullscreenElement();
    if (fs && fs.hasAttribute('data-subov-fs')) {
      injectWrapperCss();
      // The player's own controls are hidden, so show the browser's video controls meanwhile.
      const v = fs.querySelector(':scope > video[data-subov-video]');
      if (v && !v.controls) { v.controls = true; v.setAttribute('data-subov-controls', ''); }
    } else if (fs && fs === video && isActive() && video.parentElement && video.parentElement !== document.documentElement) {
      // The video went fullscreen by itself (e.g. the browser's own fullscreen button): try to switch to its parent.
      const wrapper = video.parentElement;
      video.setAttribute('data-subov-video', '');
      wrapper.setAttribute('data-subov-fs', '');
      injectWrapperCss();
      Promise.resolve(wrapper.requestFullscreen()).catch(() => {
        wrapper.removeAttribute('data-subov-fs');
        video.removeAttribute('data-subov-video');
      });
    } else if (!fs) {
      for (const el of document.querySelectorAll('[data-subov-controls]')) {
        el.controls = false;
        el.removeAttribute('data-subov-controls');
      }
      for (const el of document.querySelectorAll('[data-subov-fs]')) el.removeAttribute('data-subov-fs');
      for (const el of document.querySelectorAll('[data-subov-video]')) el.removeAttribute('data-subov-video');
    }
    lastLayout = '';
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  // ---------- native fullscreen fallback ----------

  const escapeVtt = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function renderNative(now, key) {
    if (!nativeTrack || nativeVideo !== video) {
      nativeTrack = video.addTextTrack('subtitles', 'Subtitle Overlay', 'ko');
      nativeVideo = video;
    }
    nativeTrack.mode = 'showing';

    if (!nativeStyle) {
      nativeStyle = document.createElement('style');
      (document.head || document.documentElement).appendChild(nativeStyle);
    }
    const layoutKey = `native|${screen.height}`;
    if (lastLayout !== layoutKey) {
      lastLayout = layoutKey;
      const v = styleVars(screen.height);
      nativeStyle.textContent = `video::cue { font-size: ${v.fs}px; font-family: ${v.font}; font-weight: ${v.weight};
        color: ${v.color}; background-color: ${v.bg}; text-shadow: ${v.ts}; }`;
    }

    if (key === lastKey) return;
    lastKey = key;
    for (const c of Array.from(nativeTrack.cues || [])) nativeTrack.removeCue(c);

    const toVtt = (c) => c.segs.map((s) => (s.i ? `<i>${escapeVtt(s.text)}</i>` : escapeVtt(s.text))).join('');
    const bottom = now.filter((c) => c.pos === 'bottom').reverse().map(toVtt);
    const top = now.filter((c) => c.pos === 'top').map(toVtt);

    if (bottom.length) {
      const cue = new VTTCue(0, 1e7, bottom.join('\n'));
      cue.snapToLines = false;
      cue.line = 100 - settings.bottom;
      cue.lineAlign = 'end';
      nativeTrack.addCue(cue);
    }
    if (top.length) {
      const cue = new VTTCue(0, 1e7, top.join('\n'));
      cue.line = 0;
      nativeTrack.addCue(cue);
    }
  }

  function clearNative() {
    if (!nativeTrack) return;
    for (const c of Array.from(nativeTrack.cues || [])) nativeTrack.removeCue(c);
    nativeTrack.mode = 'disabled';
    if (lastLayout.startsWith('native|')) lastLayout = '';
  }

  // ---------- keyboard shortcuts ----------
  // Alt+[ / Alt+]  : subtitles 0.1s earlier / later (hold Shift for 1s)
  // Alt+\          : toggle subtitles on/off

  function toast(msg) {
    if (!video || isNativeFullscreen()) return;
    ensureHost();
    layout();
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1500);
  }

  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || !cues.length || !contextAlive()) return;
    // Don't steal keys while the user is typing (Alt+[ types a quote mark on macOS).
    const t = e.composedPath()[0];
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    let next;
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
      const step = (e.shiftKey ? 1 : 0.1) * (e.code === 'BracketLeft' ? -1 : 1);
      const offset = Math.round((settings.offset + step) * 10) / 10;
      next = { ...settings, offset };
      toast(`Subtitle delay: ${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`);
    } else if (e.code === 'Backslash') {
      next = { ...settings, enabled: !settings.enabled };
      toast(next.enabled ? 'Subtitles on' : 'Subtitles off');
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    saveSettings(next);
  }, true);
})();
