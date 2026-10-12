// Runs in the page's own JS world. When a site asks for the bare <video> to go fullscreen, nothing can be
// drawn on top of it, so the subtitles couldn't be shown (or dragged) there. While subtitles are active we
// fullscreen the video's parent instead; content.js styles that wrapper to look like a video-only fullscreen.
(() => {
  'use strict';
  if (window.__subovFullscreenPatched) return;
  window.__subovFullscreenPatched = true;

  const active = () => document.documentElement.hasAttribute('data-subov-active');

  function wrapperFor(el) {
    if (!(el instanceof HTMLVideoElement) || !active()) return null;
    const parent = el.parentElement;
    if (!parent || parent === document.documentElement) return null;
    el.setAttribute('data-subov-video', '');
    parent.setAttribute('data-subov-fs', '');
    return parent;
  }

  for (const name of ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen']) {
    const original = Element.prototype[name];
    if (typeof original !== 'function') continue;
    Element.prototype[name] = function (...args) {
      return original.apply(wrapperFor(this) || this, args);
    };
  }

  // Old WebKit-only entry points on <video>.
  for (const name of ['webkitEnterFullscreen', 'webkitEnterFullScreen']) {
    const original = HTMLVideoElement.prototype[name];
    if (typeof original !== 'function') continue;
    HTMLVideoElement.prototype[name] = function (...args) {
      const wrapper = wrapperFor(this);
      if (wrapper) return wrapper.requestFullscreen();
      return original.apply(this, args);
    };
  }

  // Sites often check `document.fullscreenElement === video`; keep that answer true for the wrapper.
  for (const prop of ['fullscreenElement', 'webkitFullscreenElement', 'webkitCurrentFullScreenElement']) {
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, prop);
    if (!desc || !desc.get) continue;
    Object.defineProperty(Document.prototype, prop, {
      ...desc,
      get() {
        const el = desc.get.call(this);
        if (el && el.hasAttribute('data-subov-fs')) {
          return el.querySelector(':scope > video[data-subov-video]') || el;
        }
        return el;
      }
    });
  }
})();
